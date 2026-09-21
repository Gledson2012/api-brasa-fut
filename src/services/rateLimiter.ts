import { isRedisConfigured, logRedisMode, redisExpire, redisIncr } from "./redis.js";

interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/**
 * Rate limiter com backend distribuído opcional (Upstash Redis REST).
 * - Com UPSTASH_* configurado: contador por janela fixa, funciona em
 *   multi-instância e serverless (Vercel).
 * - Sem Redis: fallback em memória (single-instance / dev).
 */
export class RateLimiter {
  private windowMs: number;
  private records: Map<string, RateLimitRecord> = new Map();
  private logged = false;

  constructor(windowSeconds: number = 60) {
    this.windowMs = windowSeconds * 1000;

    // Limpeza periódica (apenas fora de Serverless para evitar manter event-loop acordado)
    if (!process.env.VERCEL) {
      setInterval(() => {
        const now = Date.now();
        for (const [key, record] of this.records.entries()) {
          record.timestamps = record.timestamps.filter((t) => now - t < this.windowMs);
          if (record.timestamps.length === 0) {
            this.records.delete(key);
          }
        }
      }, 120000).unref();
    }
  }

  private ensureLogged() {
    if (!this.logged) {
      this.logged = true;
      logRedisMode("rate-limiter");
    }
  }

  public async check(key: string, limit: number): Promise<RateLimitResult> {
    this.ensureLogged();
    const windowSeconds = Math.max(1, Math.round(this.windowMs / 1000));

    // Caminho distribuído: contador de janela fixa no Redis.
    if (isRedisConfigured()) {
      try {
        const now = Date.now();
        const windowId = Math.floor(now / this.windowMs);
        const redisKey = `ratelimit:${key}:${windowId}`;
        const count = await redisIncr(redisKey);
        if (typeof count === "number") {
          if (count === 1) {
            await redisExpire(redisKey, windowSeconds + 1);
          }
          const resetSeconds = Math.max(
            1,
            Math.ceil((windowId * this.windowMs + this.windowMs - now) / 1000)
          );
          if (count > limit) {
            return { allowed: false, limit, remaining: 0, resetSeconds };
          }
          return { allowed: true, limit, remaining: Math.max(0, limit - count), resetSeconds };
        }
      } catch {
        // cai para o fallback em memória abaixo
      }
    }

    return this.checkMemory(key, limit);
  }

  private checkMemory(key: string, limit: number): RateLimitResult {
    const now = Date.now();
    let record = this.records.get(key);

    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    // Filtrar timestamps que saíram da janela de 60 segundos
    record.timestamps = record.timestamps.filter((t) => now - t < this.windowMs);

    const oldest = record.timestamps[0] || now;
    const resetSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));

    if (record.timestamps.length >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetSeconds,
      };
    }

    // Registrar nova requisição
    record.timestamps.push(now);
    const remaining = limit - record.timestamps.length;

    return {
      allowed: true,
      limit,
      remaining,
      resetSeconds,
    };
  }
}

export const rateLimiter = new RateLimiter(60);
