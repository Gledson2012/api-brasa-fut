interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CacheService {
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  private defaultTtlSeconds: number;

  constructor(defaultTtlSeconds: number = 60) {
    this.defaultTtlSeconds = defaultTtlSeconds;

    // Limpeza periódica da memória a cada 2 minutos
    if (!process.env.VERCEL) {
      setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of this.memoryCache.entries()) {
          if (entry.expiresAt <= now) {
            this.memoryCache.delete(key);
          }
        }
      }, 120000).unref();
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  public async set<T>(key: string, value: T, ttlSeconds: number = this.defaultTtlSeconds): Promise<void> {
    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  public async del(key: string): Promise<void> {
    this.memoryCache.delete(key);
  }

  public async delPattern(prefix: string): Promise<void> {
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }
  }

  public async flush(): Promise<void> {
    this.memoryCache.clear();
  }

  /**
   * Helper que busca do cache ou calcula e armazena com TTL
   */
  public async wrap<T>(
    key: string,
    ttlSeconds: number,
    producer: () => Promise<T>
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const fresh = await producer();
    if (fresh !== null && fresh !== undefined) {
      await this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  }
}

export const cache = new CacheService(60);
