import path from 'node:path';
import { createQueue } from '../../core/queue.js';
import { PerchanceClient } from './perchance.js';
import { ProxyPool } from './proxyPool.js';
import { RESOLUTIONS, STYLES, composePrompt } from './styles.js';

// Cada worker mantiene un Chrome caliente atado a un proxy. Si la generacion falla,
// descarta navegador y proxy y reintenta con el siguiente del pool.
class Worker {
  #client = null;
  #proxy = null;
  #idleTimer = null;

  constructor({ index, pool, settings, profilesDir }) {
    this.pool = pool;
    this.settings = settings;
    this.userDataDir = path.join(profilesDir, `hacks-${index}`);
  }

  async generate(request) {
    clearTimeout(this.#idleTimer);
    let lastError;
    for (let attempt = 0; attempt < this.settings.attempts; attempt++) {
      try {
        this.#launch();
        const buffer = await this.#client.generate({ ...request, timeoutMs: this.settings.timeoutMs });
        this.#idleTimer = setTimeout(() => this.#retire(true), this.settings.idleMs);
        return buffer;
      } catch (err) {
        lastError = err;
        await this.#retire(false);
      }
    }
    throw lastError;
  }

  #launch() {
    if (this.#client) return;
    const proxy = this.pool.acquire();
    if (proxy === undefined) throw new Error('No hay proxies disponibles en este momento');
    this.#proxy = proxy;
    this.#client = new PerchanceClient({
      proxy,
      userDataDir: this.userDataDir,
      browserPath: this.settings.browser,
      loadTimeoutMs: this.settings.loadTimeoutMs,
    });
  }

  async #retire(ok) {
    const client = this.#client;
    if (!client) return;
    this.#client = null;
    this.pool.release(this.#proxy, ok);
    await client.close();
  }

  shutdown() {
    clearTimeout(this.#idleTimer);
    return this.#retire(true);
  }
}

export function createHacksProvider(settings, { profilesDir, log }) {
  const pool = new ProxyPool({ ...settings.proxy, direct: settings.direct, log });
  const queue = createQueue(settings.workers);
  const workers = Array.from({ length: settings.workers }, (_, index) => new Worker({ index, pool, settings, profilesDir }));
  const free = [...workers];

  return {
    id: 'hacks',
    queue,
    models: [
      {
        id: 'hacks',
        name: 'Hacks',
        description: 'Sin filtros, apto para +18. Varios estilos',
        aspects: Object.keys(RESOLUTIONS),
        maxImages: 6,
        maxReferences: 0,
        adult: true,
        styles: Object.entries(STYLES).map(([id, { name }]) => ({ id, name })),
      },
    ],

    start: () => pool.start(),
    stop: () => Promise.all(workers.map((worker) => worker.shutdown())),

    async generate({ prompt, n, aspect, style, negative }, hooks) {
      const request = { ...composePrompt({ prompt, style, negative }), resolution: RESOLUTIONS[aspect] };
      const results = await Promise.allSettled(
        Array.from({ length: n }, () =>
          queue.run(async () => {
            hooks.onStart();
            const worker = free.pop();
            try {
              await hooks.onImage(await worker.generate(request));
            } finally {
              free.push(worker);
            }
          }),
        ),
      );
      const failure = results.find(({ status }) => status === 'rejected');
      if (failure) throw failure.reason;
    },
  };
}
