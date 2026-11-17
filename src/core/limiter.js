export class RateWindow {
  #hits = new Map();

  constructor(windowMs) {
    this.windowMs = windowMs;
    setInterval(() => this.#sweep(), windowMs).unref();
  }

  #recent(key) {
    const limit = Date.now() - this.windowMs;
    const recent = (this.#hits.get(key) ?? []).filter((at) => at > limit);
    this.#hits.set(key, recent);
    return recent;
  }

  used(key) {
    return this.#recent(key).length;
  }

  hit(key, amount = 1) {
    const recent = this.#recent(key);
    for (let i = 0; i < amount; i++) recent.push(Date.now());
  }

  #sweep() {
    for (const key of this.#hits.keys()) if (!this.#recent(key).length) this.#hits.delete(key);
  }
}
