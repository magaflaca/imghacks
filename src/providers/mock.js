import { crc32, deflateSync } from 'node:zlib';
import { createQueue } from '../core/queue.js';

const SIZES = { '1:1': [256, 256], '3:4': [240, 320], '4:3': [320, 240], '9:16': [216, 384], '16:9': [384, 216] };

const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const frame = Buffer.alloc(body.length + 8);
  frame.writeUInt32BE(data.length, 0);
  body.copy(frame, 4);
  frame.writeUInt32BE(crc32(body), body.length + 4);
  return frame;
};

function gradientPng(width, height) {
  const [r, g, b] = [0, 0, 0].map(() => 120 + Math.random() * 110);
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1) + 1;
    for (let x = 0; x < width; x++) {
      const shade = 0.75 + 0.25 * Math.sin((x >> 4) + (y >> 4));
      raw.set([r * shade, g * (y / height / 2 + 0.5), b * (x / width / 2 + 0.5)], row + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Proveedor de desarrollo: imita latencias y fallos sin tocar servicios reales.
export function createMockProvider() {
  const queue = createQueue(2);
  const base = { aspects: Object.keys(SIZES), styles: [] };
  return {
    id: 'mock',
    queue,
    models: [
      { ...base, id: 'nano-banana-2.1', name: 'Nano Banana 2.1', description: 'Gemini rapido y equilibrado', maxImages: 4, adult: false },
      { ...base, id: 'nano-banana-pro', name: 'Nano Banana Pro', description: 'Gemini de maxima calidad', maxImages: 4, adult: false },
      {
        ...base,
        id: 'hacks',
        name: 'Hacks',
        description: 'Sin filtros, apto para +18. Varios estilos',
        maxImages: 6,
        adult: true,
        styles: [
          { id: 'none', name: 'Libre' },
          { id: 'anime', name: 'Anime' },
          { id: 'pixel-art', name: 'Pixel art' },
        ],
      },
    ],
    async generate({ prompt, n, aspect }, hooks) {
      await Promise.all(
        Array.from({ length: n }, () =>
          queue.run(async () => {
            hooks.onStart();
            await sleep(1500 + Math.random() * 2500);
            if (/\bfail\b/i.test(prompt)) throw new Error('Fallo simulado');
            await hooks.onImage(gradientPng(...SIZES[aspect]));
          }),
        ),
      );
    },
  };
}
