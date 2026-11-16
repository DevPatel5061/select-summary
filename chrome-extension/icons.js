// Original button icon paths for Select Summary, dedicated to the public domain
// under CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
// Icons belong inside controls only; they are never decorative title artwork.
const paths = {
  expand: ['M14 4h6v6M20 4l-8 8', 'M10 4H4v16h16v-6'],
  close: ['M6 6l12 12M18 6 6 18'],
  copy: ['M8 8h12v12H8z', 'M4 16V4h12'],
  arrow: ['M4 12h16m-6-6 6 6-6 6'],
  key: ['M14 9a5 5 0 1 0-4 5l4 4h3v3h4v-4l-7-7', 'M6 8h.01'],
  eye: ['M2 12c5-8 15-8 20 0-5 8-15 8-20 0Z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  check: ['M4 12l5 5L20 6']
};

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.7',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false'
  }))
    svg.setAttribute(key, value);
  for (const d of paths[name] || []) {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

export function decorateButtons(root = document) {
  root.querySelectorAll('button[data-icon]').forEach((button) => {
    if (!button.querySelector('svg')) button.prepend(icon(button.dataset.icon));
  });
}
