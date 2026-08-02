/**
 * Test instrumentation.
 *
 * The shipped game exposes nothing on `window` — there is no debug seam, no
 * `?test=1` branch, no test-only code path in any file that reaches the
 * browser. The end-to-end suites still need to read game state and place the
 * heroine in front of a given interactable (walking her across the map with
 * timed key presses would make them flaky without testing anything more), so
 * the seam is injected here instead: Playwright intercepts the request for
 * `src/main.js`, fetches the real file the server is serving, and appends one
 * line to it. Nothing in the repository changes.
 */

import http from 'node:http';

const SEAM = '\nwindow.unwrittenPage = { game, config };\n';

/** Fetches a URL over plain HTTP, bypassing any ambient proxy configuration. */
function fetchText(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`${res.statusCode} for ${url}`));
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve(body));
      })
      .on('error', reject);
  });
}

/* -------------------------------------------------------------------------
   Unexpanded-token watchdog

   Every personalised string goes through `fill()`. If any string ever reaches
   the screen without it, the player reads a literal `{guide}` instead of a
   name. A MutationObserver watches every text node for the lifetime of each
   instrumented page and records anything that slips through; the suites assert
   the tally is empty at the end.
   ------------------------------------------------------------------------- */

const leaks = new Set();

/** Every literal token seen on screen so far, across all instrumented pages. */
export function tokenLeaks() {
  return [...leaks];
}

/** Drains the watchdog on a page that is still open. */
export async function collectTokenLeaks(page) {
  try {
    for (const text of await page.evaluate(() => window.__tokenLeaks || [])) leaks.add(text);
  } catch {
    /* page already gone */
  }
  return tokenLeaks();
}

function watchdog() {
  window.__tokenLeaks = [];
  const TOKEN = /\{(name|author|guide|endearment)\}/;
  const scan = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (TOKEN.test(node.data)) window.__tokenLeaks.push(node.data.trim().slice(0, 90));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    for (const key of ['aria-label', 'title', 'placeholder']) {
      const value = node.getAttribute?.(key);
      if (value && TOKEN.test(value)) window.__tokenLeaks.push(`[${key}] ${value.slice(0, 90)}`);
    }
    for (const child of node.childNodes) scan(child);
  };
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') scan(record.target);
      else if (record.type === 'attributes') scan(record.target);
      else for (const node of record.addedNodes) scan(node);
    }
  }).observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-label', 'title', 'placeholder'],
  });
}

/**
 * Appends the seam to `src/main.js` for this page and starts the token
 * watchdog. Call before `goto()`.
 */
export async function instrument(page) {
  await page.addInitScript(watchdog);

  const close = page.close.bind(page);
  page.close = async (...args) => {
    await collectTokenLeaks(page);
    return close(...args);
  };

  await page.route(/\/src\/main\.js(\?.*)?$/, async (route) => {
    try {
      const body = await fetchText(route.request().url());
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' },
        body: body + SEAM,
      });
    } catch (error) {
      await route.abort();
    }
  });
}
