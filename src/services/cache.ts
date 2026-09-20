import { getRedis, REDIS_KEY_PREFIX } from "./redis.js";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MAX_MEMORY_ENTRIES = 5_000;

/**
 * Cache de leitura da API.
 *
 * Usa Redis (compartilhado entre instâncias) quando configurado e cai para um
 * Map em memória quando o Redis não está disponível — assim o ambiente
 * serverless continua funcionando, porém com cache por instância.
 */
export class CacheService {
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  private defaultTtlSeconds: number;

  constructor(defaultTtlSeconds: number = 60) {
    this.defaultTtlSeconds = defaultTtlSeconds;

    // Limpeza periódica da memória (apenas fora de Serverless para evitar
    // manter o event-loop acordado).
    if (!process.env.VERCEL) {
      setInterval(() => {
        this.sweepMemoryCache();
      }, 120_000).unref();
    }
  }

  private sweepMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key);
      }
    }

    // Evita crescimento ilimitado caso os TTLs sejam longos.
    while (this.memoryCache.size > MAX_MEMORY_ENTRIES) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey === undefined) break;
      this.memoryCache.delete(oldestKey);
    }
  }

  private redisKey(key: string): string {
    return `${REDIS_KEY_PREFIX}${key}`;
  }

  public async get<T>(key: string): Promise<T | null> {
    const redis = await getRedis();
    if (redis) {
      try {
        const raw = await redis.get(this.redisKey(key));
        if (raw !== null) return JSON.parse(raw) as T;
        return null;
      } catch {
        // segue para o fallback em memória
      }
    }

    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  public async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = this.defaultTtlSeconds
  ): Promise<void> {
    const redis = await getRedis();
    if (redis) {
      try {
        await redis.set(this.redisKey(key), JSON.stringify(value), "EX", ttlSeconds);
        return;
      } catch {
        // segue para o fallback em memória
      }
    }

    if (this.memoryCache.size >= MAX_MEMORY_ENTRIES) {
      this.sweepMemoryCache();
    }

    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  public async del(key: string): Promise<void> {
    const redis = await getRedis();
    if (redis) {
      try {
        await redis.del(this.redisKey(key));
      } catch {
        // ignora e limpa a memória abaixo
      }
    }
    this.memoryCache.delete(key);
  }

  /** Remove todas as chaves que começam com o prefixo informado. */
  public async delPattern(prefix: string): Promise<void> {
    const redis = await getRedis();
    if (redis) {
      try {
        let cursor = "0";
        do {
          const [nextCursor, keys] = await redis.scan(
            cursor,
            "MATCH",
            `${this.redisKey(prefix)}*`,
            "COUNT",
            100
          );
          cursor = nextCursor;
          if (keys.length > 0) {
            await redis.del(...keys);
          }
        } while (cursor !== "0");
      } catch {
        // ignora e limpa a memória abaixo
      }
    }

    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }
  }

  /** Invalida somente as chaves geradas por esta API. */
  public async flush(): Promise<void> {
    const redis = await getRedis();
    if (redis) {
      try {
        let cursor = "0";
        do {
          const [nextCursor, keys] = await redis.scan(
            cursor,
            "MATCH",
            `${REDIS_KEY_PREFIX}*`,
            "COUNT",
            200
          );
          cursor = nextCursor;
          if (keys.length > 0) {
            await redis.del(...keys);
          }
        } while (cursor !== "0");
      } catch {
        // ignora e limpa a memória abaixo
      }
    }

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
