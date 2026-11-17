import { ICONS } from './sprites.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function drawSprite(ctx, rows, palette, scale = 1) {
  rows.forEach((row, y) => {
    [...row].forEach((key, x) => {
      if (!palette[key]) return;
      ctx.fillStyle = palette[key];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
  });
}

export function spriteCanvas(rows, palette, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length * scale;
  canvas.height = rows.length * scale;
  drawSprite(canvas.getContext('2d'), rows, palette, scale);
  return canvas;
}

// Icono monocromo como SVG: hereda currentColor y escala nitido a cualquier tamano.
export function icon(name) {
  const rows = ICONS[name];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${rows[0].length} ${rows.length}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  rows.forEach((row, y) => {
    for (const run of row.matchAll(/#+/g)) {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', run.index);
      rect.setAttribute('y', y);
      rect.setAttribute('width', run[0].length);
      rect.setAttribute('height', 1);
      rect.setAttribute('fill', 'currentColor');
      svg.appendChild(rect);
    }
  });
  return svg;
}

export function mountIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((host) => host.replaceChildren(icon(host.dataset.icon)));
}
