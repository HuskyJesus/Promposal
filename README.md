# The Unwritten Page

A cozy, hand-drawn fairytale adventure about finishing a story that lost its
final page. Roughly 10–15 minutes long, built for phones first and desktops
second.

**Play it:** https://huskyjesus.github.io/Promposal/

---

## What it is

A small top-down adventure game. You wander an enchanted forest, meet a very
self-important blue bear called Theo, gather three lost fragments of a story,
and finish writing its last page.

It is built from nothing but HTML, CSS and vanilla JavaScript modules. There is
**no build step, no framework, no backend, and not a single image file** — every
tree, character, lantern, mushroom and star is drawn at runtime with the Canvas
2D API or inline SVG, and all of the music and sound is synthesised on the fly
with the Web Audio API.

## Chapters

| Chapter | Place | What happens |
| --- | --- | --- |
| One | The Whispering Woods | Explore, meet Theo, gather three hidden moonflowers, and listen to woodland gossip. |
| Two | The Enchanted Cottage | Three guardians each tell you what beats them; win three rounds of Stone, Scroll and Shears. |
| Three | The Monochrome Hall | Join the halves of a divided mural to bring colour back, then answer the Storykeeper's three questions. |
| Finale | The Garden Beyond the Stars | Light three lanterns, watch the light make a journey, and read the last page. |

## Running it locally

The game is a static site; any web server will do.

```bash
npm start          # serves it at http://localhost:4173
```

Or with Python:

```bash
python3 -m http.server 4173
```

Opening `index.html` straight from the file system will **not** work, because
browsers block ES modules loaded over `file://`. Use a server.

## Tests

```bash
npm test               # puzzle rules and saved-progress logic
npm run test:e2e       # full playthrough in a real browser (needs Playwright)
npm run test:resilience # adversarial pass: tries to break the game
```

The unit tests check the things that matter for a game somebody only plays
once: that every puzzle is solvable, that every hint matches the real answer,
that a wrong answer never breaks a puzzle, and that saving, continuing,
restarting a chapter and erasing progress all do what they claim.

The end-to-end suite drives a headless Chromium through the entire story from
the title screen to the final page, in both landscape and portrait.

The resilience suite tries to break it on purpose: hammering the dialogue box,
rotating the phone mid-sentence and mid-puzzle, refreshing in the instant
between collecting the last moonflower and being handed the fragment, pairing
every wrong mural panel, exhausting every hint, replaying the ending three
times, resetting a finished game, and loading saves written by an older build
or naming a chapter that no longer exists. It finishes by loading the page
exactly as a player would and checking that the shipped build exposes nothing
at all — no test seam, no globals, and no query string that unlocks anything.

The game itself contains no test-only code. The browser suites need to read
game state, so Playwright appends a single line to `src/main.js` as it is
served (`tests/e2e/instrument.mjs`); nothing in the repository changes, and
the last section of the resilience suite runs uninstrumented to prove it.

## Controls

* **Move** — arrow keys or `W A S D`; on a phone, hold and drag anywhere on the
  left half of the screen.
* **Interact** — `Space`, `Enter`, `E`, or the round button at the bottom right.
* **Menu / pause** — `Escape` or the button at the top left.
* **Hint** — the lamp button at the top right. Ask more than once and Theo gets
  progressively less mysterious.

## Accessibility

* Every menu, puzzle and dialogue choice is a real focusable button, reachable
  by keyboard and labelled for screen readers.
* No puzzle needs dragging, precise timing or fast reflexes.
* Nothing is communicated by colour alone — fragments, matched panels and
  puzzle feedback all carry a symbol or a label as well.
* A reduced-motion option (which also follows your system setting) removes the
  page-turn animation, the typewriter effect and the sweeping camera moves.
* Every meaningful sound is captioned on screen, and the game is fully playable
  with sound switched off.
* Text speed can be set to instant.
* Every primary control is at least 48x48 CSS pixels and clears the phone's
  safe areas; the thumb stick and action button step aside while she is
  reading so no dialogue is ever hidden behind a thumb.

## Project layout

```
index.html            the page itself
404.html              a themed fallback page
styles/main.css       all interface styling
assets/favicon.svg    the only static asset in the project
src/
  config.js           ← the one file to edit to personalise everything
  main.js             start-up: registers the scenes and opens the title screen
  engine/
    game.js           the loop, the scene stack, the pause menu
    worldScene.js     shared behaviour for the explorable chapters
    renderer.js       canvas, device pixel ratio, camera
    theme.js          the whole colour system in one place
    art.js            procedural scenery: trees, paths, lanterns, skies,
                      mist, light pools and foreground foliage
    foliage.js        tree sprite caching and woodland composition
    sprites.js        characters and dialogue portraits
    particles.js      fireflies, petals, sparks
    audio.js          procedural music, ambience and sound effects
    ui.js             dialogue box, panels, HUD, transitions
    input.js          keyboard, thumb stick, interaction button
    icons.js          inline SVG icons
    save.js           localStorage progress and settings
  scenes/             title, woods, cottage, hall, garden
  puzzles/            puzzle rules (pure logic) and their panels
  data/               all dialogue and optional gossip
tests/                unit tests and the end-to-end playthrough
```

## Deployment

GitHub Pages serves this repository directly from the `main` branch, so every
push is live within a minute or two. Every path in the project is relative,
so the site works from the `/Promposal/` subdirectory with no configuration,
and a `.nojekyll` file keeps Pages from filtering anything.

`.github/workflows/tests.yml` runs the puzzle and saved-progress tests on
every push and pull request.

If you would rather publish through Actions than from the branch, set
**Settings → Pages → Source** to **GitHub Actions** and add a job using
`actions/configure-pages`, `actions/upload-pages-artifact` (with `path: .`)
and `actions/deploy-pages`. Nothing in the project needs to change.

## Personalising it

See [CUSTOMIZE.md](CUSTOMIZE.md). Short version: edit `src/config.js`.
