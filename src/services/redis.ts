import { Redis } from "ioredis";
import { cache } from "./cache.js";

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  retryStrategy?: (times: number) => number | null;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
}

class RedisCacheService {
  private client: Redis | null = null;
  private isConnected = false;
  private useMemoryFallback = false;
  private defaultTtlSeconds: number;

  constructor(defaultTtlSeconds: number = 60) {
    this.defaultTtlSeconds = defaultTtlSeconds;
  }

  async connect(config?: RedisConfig): Promise<void> {
    if (process.env.VERCEL || process.env.DISABLE_REDIS === "true") {
      console.log("[Redis] Modo serverless detectado - usando cache em memória");
      this.useMemoryFallback = true;
      return;
    }

    const redisConfig: RedisConfig = config || {
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: Number(process.env.REDIS_DB) || 0,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn("[Redis] Máximo de tentativas atingido - caindo para cache em memória");
          this.useMemoryFallback = true;
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      enableReadyCheck: true,
      lazyConnect: true,
    };

    try {
      this.client = new Redis(redisConfig);

      this.client.on("connect", () => {
        this.isConnected = true;
        console.log("[Redis] Conectado com sucesso");
      });

      this.client.on("error", (err: Error) => {
        console.error("[Redis] Erro:", err.message);
        this.isConnected = false;
      });

      this.client.on("close", () => {
        this.isConnected = false;
      });

      await this.client.connect();
      await this.client.ping();
    } catch (error) {
      console.warn("[Redis] Falha na conexão - usando cache em memória:", (error as Error).message);
      this.useMemoryFallback = true;
      if (this.client) {
        await this.client.quit().catch(() => {});
        this.client = null;
      }
    }
  }

  private async getFromMemory<T>(key: string): Promise<T | null> {
    return cache.get<T>(key);
  }

  private async setToMemory<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await cache.set(key, value, ttlSeconds);
  }

  private async delFromMemory(key: string): Promise<void> {
    await cache.del(key);
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.useMemoryFallback || !this.client || !this.isConnected) {
      return this.getFromMemory<T>(key);
    }

    try {
      const value = await this.client.get(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.warn("[Redis] Erro no GET, fallback para memória:", (error as Error).message);
      return this.getFromMemory<T>(key);
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number = this.defaultTtlSeconds): Promise<void> {
    if (this.useMemoryFallback || !this.client || !this.isConnected) {
      return this.setToMemory(key, value, ttlSeconds);
    }

    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.warn("[Redis] Erro no SET, fallback para memória:", (error as Error).message);
      await this.setToMemory(key, value, ttlSeconds);
    }
  }

  async del(key: string): Promise<void> {
    if (this.useMemoryFallback || !this.client || !this.isConnected) {
      return this.delFromMemory(key);
    }

    try {
      await this.client.del(key);
    } catch (error) {
      console.warn("[Redis] Erro no DEL, fallback para memória:", (error as Error).message);
      await this.delFromMemory(key);
    }
  }

  async delPattern(prefix: string): Promise<void> {
    if (this.useMemoryFallback || !this.client || !this.isConnected) {
      return cache.delPattern(prefix);
    }

    try {
      let cursor = "0";
      do {
        const [newCursor, keys] = await this.client.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
        cursor = newCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== "0");
    } catch (error) {
      console.warn("[Redis] Erro no DEL PATTERN, fallback para memória:", (error as Error).message);
      await cache.delPattern(prefix);
    }
  }

  async flush(): Promise<void> {
    if (this.useMemoryFallback || !this.client || !this.isConnected) {
      return cache.flush();
    }

    try {
      await this.client.flushdb();
    } catch (error) {
      console.warn("[Redis] Erro no FLUSH, fallback para memória:", (error as Error).message);
      await cache.flush();
    }
  }

  async wrap<T>(key: string, ttlSeconds: number, producer: () => Promise<T>): Promise<T> {
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

  async healthCheck(): Promise<{ status: "healthy" | "degraded" | "down"; latencyMs?: number }> {
    if (this.useMemoryFallback || !this.client) {
      return { status: "degraded", latencyMs: 0 };
    }

    const start = Date.now();
    try {
      await this.client.ping();
      return { status: "healthy", latencyMs: Date.now() - start };
    } catch {
      return { status: "down", latencyMs: Date.now() - start };
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  isUsingFallback(): boolean {
    return this.useMemoryFallback;
  }
}

export const redisCache = new RedisCacheService(60);