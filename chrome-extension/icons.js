// Original button icon paths for Select Summary, dedicated to the public domain
// under CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
// Icons belong inside controls only; they are never decorative title artwork.
const paths = {
  puzzle: [
    'M8 3h3a2.5 2.5 0 1 1 5 0h3v6a2.5 2.5 0 1 1 0 5v6h-6a2.5 2.5 0 1 0-5 0H3v-6a2.5 2.5 0 1 0 0-5V3h5Z'
  ],
  pin: ['M9 3h6l-1 6 4 4v2H6v-2l4-4-1-6Z', 'M12 15v6'],
  back: ['M20 12H4m6-6-6 6 6 6'],
  reload: ['M20 7v5h-5', 'M19 12a7 7 0 1 0-2 5M20 12l-3-5'],
  expand: ['M14 4h6v6M20 4l-8 8', 'M10 4H4v16h16v-6'],
  close: ['M6 6l12 12M18 6 6 18'],
  copy: ['M8 8h12v12H8z', 'M4 16V4h12'],
  arrow: ['M4 12h16m-6-6 6 6-6 6'],
  key: ['M14 9a5 5 0 1 0-4 5l4 4h3v3h4v-4l-7-7', 'M6 8h.01'],
  disconnect: ['M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0V8Z', 'M12 17v4'],
  eye: [
    'M2 12c5-8 15-8 20 0-5 8-15 8-20 0Z',
    'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'
  ],
  check: ['M4 12l5 5L20 6'],
  sun: [
    'M16 12a4 4 0 1 1-8 0 4 4 0 1 1 8 0Z',
    'M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4'
  ],
  moon: ['M20.9 13.2A9 9 0 1 1 10.8 3.1a7 7 0 0 0 10.1 10.1Z'],
  summary: [
    'M7 3h7l4 4v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
    'M14 3v5h4M8.5 12h6.5M8.5 16h6.5'
  ],
  clock: [
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
    'M12 7v5l3.5 2'
  ],
  streak: [
    'M13 2c.5 3-1.5 4.5-3 6-1.6 1.6-3 3.4-3 6a5 5 0 0 0 10 0c0-1.9-.8-3.5-2.2-4.8.1 2-1.1 3-2.2 3.3.7-3.1 3.4-5.8.4-10.5Z',
    'M12 14c-1 1-1.5 1.8-1.5 3a1.5 1.5 0 0 0 3 0c0-1-.5-2-1.5-3Z'
  ],
  trophy: [
    'M8 4h8v4a4 4 0 0 1-8 0V4ZM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4',
    'M12 12v5M9 17h6M8 20h8'
  ]
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
