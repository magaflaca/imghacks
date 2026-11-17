import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PREFIX = 'imh_';
const digestOf = (key) => createHash('sha256').update(key).digest('hex');

export class KeyStore {
  #entries = [];
  #loadedAt = -1;

  constructor(file) {
    this.file = file;
  }

  #load() {
    const mtime = existsSync(this.file) ? statSync(this.file).mtimeMs : 0;
    if (mtime === this.#loadedAt) return;
    this.#entries = mtime ? JSON.parse(readFileSync(this.file, 'utf8')) : [];
    this.#loadedAt = mtime;
  }

  #persist() {
    mkdirSync(path.dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.#entries, null, 2), { mode: 0o600 });
    this.#loadedAt = -1;
  }

  list() {
    this.#load();
    return this.#entries.map(({ id, name, createdAt }) => ({ id, name, createdAt }));
  }

  create(name) {
    this.#load();
    const key = PREFIX + randomBytes(24).toString('hex');
    const entry = { id: key.slice(0, 12), name, hash: digestOf(key), createdAt: new Date().toISOString() };
    this.#entries.push(entry);
    this.#persist();
    return { ...entry, key };
  }

  revoke(idOrName) {
    this.#load();
    const before = this.#entries.length;
    this.#entries = this.#entries.filter((entry) => entry.id !== idOrName && entry.name !== idOrName);
    this.#persist();
    return before - this.#entries.length;
  }

  verify(key) {
    if (!key?.startsWith(PREFIX)) return null;
    this.#load();
    const digest = digestOf(key);
    return this.#entries.find((entry) => entry.hash === digest) ?? null;
  }
}
