// TTL + LRU cache with single-flight.
//
// TMDB's terms allow caching responses; they also rate limit at roughly 50
// requests per second per key, so a shared cache is the difference between a
// usable site and one that 429s under a handful of visitors.
//
//   list responses   30 minutes   (fresh enough for "trending")
//   detail responses 6 hours      (a title's credits do not move)
//   genres           24 hours     (they change a few times a year)
//   search           5 minutes    (cheap, but no reason to hammer)
//   player probes    10 minutes   (availability is what actually moves)
export class TtlCache {
  constructor({ max = 800 } = {}) {
    this.max = max;
    this.map = new Map();
    this.inflight = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // refresh recency
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key, value, ttlMs) {
    if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expires: Date.now() + ttlMs });
  }

  /** Cache-or-compute. Concurrent callers for one key share a single promise. */
  async wrap(key, ttlMs, producer) {
    const cached = this.get(key);
    if (cached !== undefined) {
      this.hits += 1;
      return cached;
    }
    const running = this.inflight.get(key);
    if (running) return running;

    this.misses += 1;
    const promise = (async () => {
      try {
        const value = await producer();
        this.set(key, value, ttlMs);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise);
    return promise;
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      entries: this.map.size,
      max: this.max,
      hits: this.hits,
      misses: this.misses,
      hitRate: total ? Math.round((this.hits / total) * 100) / 100 : 0,
    };
  }
}

export const TTL = {
  list: 30 * 60 * 1000,
  detail: 6 * 60 * 60 * 1000,
  genre: 24 * 60 * 60 * 1000,
  search: 5 * 60 * 1000,
  player: 10 * 60 * 1000,
  config: 60 * 1000,
};
