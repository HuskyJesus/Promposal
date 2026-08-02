/**
 * Inline SVG icons used inside panels. Written as small path strings so they
 * stay crisp at any size and need no image files.
 */

const ICONS = {
  moon: '<path d="M40 8a24 24 0 1 0 16 42A28 28 0 0 1 40 8Z"/><circle cx="52" cy="16" r="2.5"/><circle cx="60" cy="26" r="1.8"/>',
  sun: '<circle cx="32" cy="32" r="13"/><g stroke-width="4" stroke-linecap="round"><path d="M32 4v9M32 51v9M4 32h9M51 32h9M12 12l6 6M46 46l6 6M52 12l-6 6M18 46l-6 6"/></g>',
  // A figure and the long shape it throws, rather than an unreadable blob.
  shadow: '<ellipse cx="30" cy="52" rx="21" ry="6" opacity="0.55"/><path d="M32 52c-11-2-18-9-18-9l14-6 5-3Z"/><circle cx="38" cy="14" r="6"/><path d="M32 22h12l4 20H30Z"/>',
  // A hanging lantern: ring, cap, glazed body with a flame, and a base.
  lantern: '<path d="M28 4a4 4 0 0 1 8 0" fill="none" stroke-width="3"/><path d="M32 8v6" stroke-width="3"/><path d="M18 18h28l-4 6H22Z"/><path d="M22 24h20v26H22Z" fill="none" stroke-width="4"/><path d="M32 30c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11Z"/><path d="M18 50h28l-3 6H21Z"/>',
  ink: '<path d="M32 6c9 12 15 20 15 28a15 15 0 0 1-30 0c0-8 6-16 15-28Z"/>',
  page: '<path d="M16 8h24l10 10v38H16Z"/><path d="M40 8v10h10" fill="none" stroke-width="3"/><path d="M24 30h16M24 38h16M24 46h10" stroke-width="3" stroke-linecap="round"/>',
  bud: '<path d="M32 56V32" stroke-width="4" stroke-linecap="round"/><path d="M32 32c-7 0-11-7-11-13s5-11 11-11 11 5 11 11-4 13-11 13Z"/>',
  bloom: '<circle cx="32" cy="28" r="7"/><g><ellipse cx="32" cy="12" rx="7" ry="10"/><ellipse cx="32" cy="44" rx="7" ry="10"/><ellipse cx="16" cy="28" rx="10" ry="7"/><ellipse cx="48" cy="28" rx="10" ry="7"/></g><path d="M32 46v12" stroke-width="4" stroke-linecap="round"/>',
  star: '<path d="M32 4 38 24 58 32 38 40 32 60 26 40 6 32 26 24Z"/>',
  key: '<circle cx="20" cy="32" r="12" fill="none" stroke-width="6"/><path d="M32 32h26M50 32v10M58 32v8" stroke-width="6" stroke-linecap="round"/>',
  quill: '<path d="M52 8C30 12 16 30 12 52l8-4c4-16 16-28 32-32Z"/><path d="M12 56l10-10" stroke-width="4" stroke-linecap="round"/>',
  flourish: '<path d="M4 12c14 10 28 10 42 0M14 20c10 6 20 6 30 0" fill="none" stroke-width="3" stroke-linecap="round"/>'
};

/** Returns an <svg> element for the named icon. */
export function svgIcon(name, { color = 'currentColor', size = 48, stroke = 'currentColor' } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', color);
  svg.setAttribute('stroke', stroke);
  svg.setAttribute('stroke-width', '0');
  svg.innerHTML = ICONS[name] || ICONS.star;
  return svg;
}

