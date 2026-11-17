import { theme } from './theme.js';

const PIXEL = 4;
const FRAME_MS = 160;
const HILL_HEIGHTS = [0.2, 0.12, 0.065];

const PALETTES = {
  light: {
    sky: ['#a9d3f5', '#bccdf6', '#d7c4f0', '#f3c3dc', '#fbd3c4'],
    hills: ['#cbbdea', '#a8dcbd', '#86cba4'],
    cloud: ['#ffffff', '#e4d9f4'],
    specks: ['#f78fb3', '#fbe08a', '#ffffff'],
    sun: ['#fff6cf', '#ffe9a3'],
  },
  dark: {
    sky: ['#12102a', '#181530', '#1f1a3a', '#272043', '#2e254b'],
    hills: ['#2b2550', '#231f40', '#191630'],
    stars: ['#f0e7f7', '#f3d98b', '#a898e6'],
    moon: ['#f6ecc6', '#d8cb9c'],
    specks: ['#f3d98b', '#8fd6b5'],
  },
};

const CLOUD_SHAPES = [
  [[7, 0, 6], [4, 1, 12], [2, 2, 17], [0, 3, 22], [0, 4, 22], [2, 5, 18]],
  [[4, 0, 5], [2, 1, 10], [0, 2, 14], [0, 3, 14], [1, 4, 11]],
  [[8, 0, 5], [5, 1, 11], [3, 2, 16], [16, 1, 5], [0, 3, 24], [0, 4, 24], [3, 5, 19]],
];

const random = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

export function startScene(canvas) {
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let backdrop, width, height, clouds, stars, specks, tick = 0;

  const hillTop = (x, layer) => {
    const base = height - Math.max(8, height * HILL_HEIGHTS[layer]);
    const sway = layer ? 1 : 2.4;
    return Math.round(base + Math.sin(x * 0.045 + layer * 2.1) * 2 * sway + Math.sin(x * 0.013 + layer) * 4 * sway);
  };

  function paintBackdrop(palette) {
    backdrop = new OffscreenCanvas(width, height);
    const paint = backdrop.getContext('2d');
    const band = Math.ceil(height / palette.sky.length);
    palette.sky.forEach((color, index) => {
      paint.fillStyle = color;
      paint.fillRect(0, index * band, width, band);
      if (!index) return;
      for (let x = 0; x < width; x++) paint.fillRect(x, index * band - 1 - (x % 2), 1, 1);
    });
    palette.hills.forEach((color, layer) => {
      paint.fillStyle = color;
      for (let x = 0; x < width; x++) paint.fillRect(x, hillTop(x, layer), 1, height);
    });
    if (palette.moon) paintMoon(paint, palette.moon);
    if (palette.sun) paintSun(paint, palette.sun);
  }

  function paintSun(paint, [core, halo]) {
    const cx = Math.round(width * 0.86);
    const cy = Math.round(height * 0.2);
    for (let y = -11; y <= 11; y++) {
      for (let x = -11; x <= 11; x++) {
        const distance = x * x + y * y;
        if (distance > 121 || (distance > 49 && (x + y) % 2)) continue;
        paint.fillStyle = distance > 49 ? halo : core;
        paint.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }

  function paintMoon(paint, [lit, shade]) {
    const radius = 7;
    const cx = Math.round(width * 0.95);
    const cy = Math.round(height * 0.11);
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        if (x * x + y * y > radius * radius) continue;
        const carved = (x - 4) ** 2 + (y + 3) ** 2 < radius * radius * 0.72;
        if (carved) continue;
        paint.fillStyle = x + y > 5 ? shade : lit;
        paint.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }

  function scatter() {
    const next = random(width * 31 + height);
    clouds = Array.from({ length: Math.max(3, Math.round(width / 70)) }, (_, index) => ({
      x: next() * width,
      y: 6 + next() * height * 0.5,
      speed: 0.04 + next() * 0.07,
      shape: CLOUD_SHAPES[index % CLOUD_SHAPES.length],
    }));
    stars = Array.from({ length: Math.round((width * height) / 900) }, () => ({
      x: Math.floor(next() * width),
      y: Math.floor(next() * height * 0.8),
      phase: Math.floor(next() * 40),
      tone: Math.floor(next() * 3),
    }));
    specks = Array.from({ length: Math.round(width / 9) }, () => {
      const x = Math.floor(next() * width);
      return { x, y: hillTop(x, 2) + 2 + Math.floor(next() * 6), phase: Math.floor(next() * 30), tone: Math.floor(next() * 3) };
    });
  }

  function frame() {
    const dark = theme.current === 'dark';
    const palette = PALETTES[dark ? 'dark' : 'light'];
    ctx.drawImage(backdrop, 0, 0);

    if (dark) {
      for (const star of stars) {
        if ((tick + star.phase) % 40 < 4) continue;
        ctx.fillStyle = palette.stars[star.tone];
        ctx.fillRect(star.x, star.y, 1, 1);
      }
    } else {
      for (const cloud of clouds) {
        const x = Math.round(((cloud.x + tick * cloud.speed) % (width + 40)) - 20);
        cloud.shape.forEach(([dx, dy, length], row) => {
          ctx.fillStyle = palette.cloud[row === cloud.shape.length - 1 ? 1 : 0];
          ctx.fillRect(x + dx, Math.round(cloud.y) + dy, length, 1);
        });
      }
    }

    for (const speck of specks) {
      if (dark && (tick + speck.phase) % 30 < 14) continue;
      ctx.fillStyle = palette.specks[speck.tone % palette.specks.length];
      ctx.fillRect(speck.x, speck.y - (dark ? Math.round(Math.sin((tick + speck.phase) / 6) * 2) + 6 : 0), 1, 1);
    }
    tick++;
  }

  function rebuild() {
    width = canvas.width = Math.ceil(innerWidth / PIXEL);
    height = canvas.height = Math.ceil(innerHeight / PIXEL);
    scatter();
    repaint();
  }

  function repaint() {
    paintBackdrop(PALETTES[theme.current === 'dark' ? 'dark' : 'light']);
    frame();
  }

  let resizing;
  addEventListener('resize', () => {
    clearTimeout(resizing);
    resizing = setTimeout(rebuild, 150);
  });
  theme.onChange(repaint);
  rebuild();
  if (!still) setInterval(() => document.hidden || frame(), FRAME_MS);
}
