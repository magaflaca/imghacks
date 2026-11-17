import { randomBytes } from 'node:crypto';
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const FORMATS = [
  { ext: 'png', mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { ext: 'jpg', mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  { ext: 'webp', mime: 'image/webp', magic: [0x52, 0x49, 0x46, 0x46] },
];
const FALLBACK = FORMATS[1];

const sniff = (buffer) => FORMATS.find(({ magic }) => magic.every((byte, i) => buffer[i] === byte)) ?? FALLBACK;

export class ImageStore {
  constructor({ dir, ttlMs, publicUrl }) {
    this.dir = dir;
    this.ttlMs = ttlMs;
    this.publicUrl = publicUrl;
  }

  async start() {
    await mkdir(this.dir, { recursive: true });
    await this.sweep();
    setInterval(() => this.sweep().catch(() => {}), 60_000).unref();
  }

  async save(buffer) {
    const { ext, mime } = sniff(buffer);
    const name = `${randomBytes(16).toString('hex')}.${ext}`;
    await writeFile(path.join(this.dir, name), buffer);
    return { name, mime, url: `${this.publicUrl}/i/${name}`, expiresAt: Date.now() + this.ttlMs };
  }

  async sweep() {
    const limit = Date.now() - this.ttlMs;
    for (const name of await readdir(this.dir)) {
      const file = path.join(this.dir, name);
      const info = await stat(file).catch(() => null);
      if (info && info.mtimeMs < limit) await unlink(file).catch(() => {});
    }
  }
}
