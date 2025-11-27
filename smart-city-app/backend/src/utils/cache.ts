type CacheEntry<V> = {
  value: V;
  expiresAt: number;
};

export class InMemoryCache<K, V> {
  private store = new Map<K, CacheEntry<V>>();

  constructor(private readonly ttlMs: number = 60_000) {}

  get(key: K): V | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: K, value: V): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  has(key: K): boolean {
    return this.get(key) !== null;
  }

  delete(key: K): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

