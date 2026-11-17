import { ProxyAgent, fetch } from 'undici';

const LIVENESS_URL = 'https://www.google.com/generate_204';
const ADDRESS = /(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})/g;
const BATCH = 10;
export const DIRECT = '';

const shuffle = (items) => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

// Pool autoabastecido de listas publicas. Solo se valida que el proxy este vivo: el juez
// real es la generacion misma, que reporta cada resultado para rotar los que fallan.
export class ProxyPool {
  #entries = new Map();
  #leased = new Set();
  #refreshing = false;

  constructor({ seed, direct, target, maxFails, refreshMs, validateTimeoutMs, sources, log }) {
    Object.assign(this, { seed, direct, target, maxFails, refreshMs, validateTimeoutMs, sources, log });
  }

  start() {
    this.#seed();
    this.refresh();
    setInterval(() => {
      this.#seed();
      if (this.size < this.target) this.refresh();
    }, this.refreshMs).unref();
  }

  get size() {
    return this.#entries.size;
  }

  #seed() {
    if (this.direct) this.#add(DIRECT);
    if (this.seed) this.#add(this.seed);
  }

  #add(url) {
    if (!this.#entries.has(url)) this.#entries.set(url, 0);
  }

  acquire() {
    const free = [...this.#entries].filter(([url]) => !this.#leased.has(url)).sort(([, a], [, b]) => a - b);
    if (!free.length) return undefined;
    const [url] = free[0];
    this.#leased.add(url);
    return url;
  }

  release(url, ok) {
    this.#leased.delete(url);
    if (!this.#entries.has(url)) return;
    const fails = ok ? 0 : this.#entries.get(url) + 1;
    if (fails >= this.maxFails) this.#entries.delete(url);
    else this.#entries.set(url, fails);
  }

  async #alive(url) {
    const dispatcher = new ProxyAgent(url);
    try {
      const res = await fetch(LIVENESS_URL, { dispatcher, signal: AbortSignal.timeout(this.validateTimeoutMs) });
      return res.status === 204 || res.status === 200;
    } catch {
      return false;
    } finally {
      dispatcher.close().catch(() => {});
    }
  }

  async #candidates() {
    const found = new Set();
    await Promise.all(
      this.sources.map(async (source) => {
        try {
          const res = await fetch(source, { signal: AbortSignal.timeout(15_000) });
          if (!res.ok) return;
          for (const [, ip, port] of (await res.text()).matchAll(ADDRESS)) found.add(`http://${ip}:${port}`);
        } catch {}
      }),
    );
    return shuffle([...found].filter((url) => !this.#entries.has(url)));
  }

  async refresh() {
    if (this.#refreshing) return;
    this.#refreshing = true;
    try {
      const candidates = await this.#candidates();
      let added = 0;
      for (let i = 0; i < candidates.length && added < this.target; i += BATCH) {
        const batch = candidates.slice(i, i + BATCH);
        const alive = await Promise.all(batch.map((url) => this.#alive(url)));
        batch.filter((_, index) => alive[index]).forEach((url) => {
          this.#add(url);
          added++;
        });
      }
      this.log?.info({ added, total: this.size }, 'proxy pool refrescado');
    } finally {
      this.#refreshing = false;
    }
  }
}
