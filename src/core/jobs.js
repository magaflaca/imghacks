import { randomUUID } from 'node:crypto';

const ACTIVE = new Set(['queued', 'running']);

export class JobStore {
  #jobs = new Map();

  constructor({ ttlMs, images }) {
    this.ttlMs = ttlMs;
    this.images = images;
    setInterval(() => this.#sweep(), 60_000).unref();
  }

  create({ model, params, owner }) {
    const job = {
      id: randomUUID(),
      owner,
      model: model.id,
      params,
      references: params.references.length,
      status: 'queued',
      images: [],
      error: null,
      createdAt: Date.now(),
      finishedAt: null,
    };
    this.#jobs.set(job.id, job);
    job.done = this.#run(job, model);
    return job;
  }

  get(id) {
    return this.#jobs.get(id);
  }

  activeCount(owner) {
    let count = 0;
    for (const job of this.#jobs.values()) if (job.owner === owner && ACTIVE.has(job.status)) count++;
    return count;
  }

  async #run(job, model) {
    const hooks = {
      onStart: () => {
        job.status = 'running';
      },
      onImage: async (buffer) => {
        job.images.push(await this.images.save(buffer));
      },
    };
    try {
      await model.provider.generate({ ...job.params, model }, hooks);
    } catch (err) {
      job.error = err.message;
    }
    job.params.references = [];
    const produced = job.images.length > 0;
    job.status = produced ? 'done' : 'failed';
    if (!produced) job.error ??= 'No se genero ninguna imagen';
    job.finishedAt = Date.now();
    return job;
  }

  #sweep() {
    const limit = Date.now() - this.ttlMs;
    for (const [id, job] of this.#jobs) if (job.finishedAt && job.finishedAt < limit) this.#jobs.delete(id);
  }
}

export const presentJob = (job) => ({
  id: job.id,
  status: job.status,
  model: job.model,
  prompt: job.params.prompt,
  n: job.params.n,
  aspect: job.params.aspect,
  references: job.references,
  images: job.images.map(({ url, mime, expiresAt }) => ({ url, mime, expires_at: expiresAt })),
  error: job.error,
  created_at: job.createdAt,
  finished_at: job.finishedAt,
});
