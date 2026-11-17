import { spriteCanvas } from './pixels.js';
import { CURSORS, CURSOR_PALETTE } from './sprites.js';

const SCALE = 2;
const FALLBACK = { arrow: 'auto', pointer: 'pointer', text: 'text' };

export function installCursors() {
  if (!matchMedia('(pointer: fine)').matches) return;
  for (const [name, { rows, hotspot }] of Object.entries(CURSORS)) {
    const url = spriteCanvas(rows, CURSOR_PALETTE, SCALE).toDataURL();
    const [x, y] = hotspot.map((value) => value * SCALE);
    document.documentElement.style.setProperty(`--cursor-${name}`, `url(${url}) ${x} ${y}, ${FALLBACK[name]}`);
  }
}
