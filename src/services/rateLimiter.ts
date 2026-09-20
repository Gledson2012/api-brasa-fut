import type { Redis } from "ioredis";
import { getRedis, REDIS_KEY_PREFIX } from "./redis.js";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

interface RateLimitRecord {
  timestamps: number[];
}

const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

/**
 * Rate limiting por chave de API.
 *
 * Com Redis configurado o contador é compartilhado entre todas as instâncias
 * (comportamento esperado em produção). Sem Redis o limite passa a ser por
 * processo — cada instância serverless tem seu próprio contador.
 */
export class RateLimiter {
  private windowMs: number;
  private records: Map<string, RateLimitRecord> = new Map();

  constructor(windowSeconds: number = 60) {
    this.windowMs = windowSeconds * 1000;

    // Limpeza periódica (apenas fora de Serverless para evitar manter o
    // event-loop acordado).
    if (!process.env.VERCEL) {
      setInterval(() => {
        const now = Date.now();
        for (const [key, record] of this.records.entries()) {
          record.timestamps = record.timestamps.filter(
            (t) => now - t < this.windowMs
          );
          if (record.timestamps.length === 0) {
            this.records.delete(key);
          }
        }
      }, 120000).unref();
    }
  }

  public async check(key: string, limit: number): Promise<RateLimitResult> {
    const redis = await getRedis();
    if (redis) {
      try {
        return await this.checkRedis(redis, key, limit);
      } catch {
        // Redis caiu no meio do caminho: aplica o fallback em memória.
      }
    }

    return this.checkMemory(key, limit);
  }

  private async checkRedis(
    redis: Redis,
    key: string,
    limit: number
  ): Promise<RateLimitResult> {
    const [count, pttl] = (await redis.eval(
      RATE_LIMIT_SCRIPT,
      1,
      `${REDIS_KEY_PREFIX}ratelimit:${key}`,
      this.windowMs
    )) as [number, number];

    const ttlMs = pttl > 0 ? pttl : this.windowMs;

    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
    };
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
    const resetSeconds = Math.max(
      1,
      Math.ceil((oldest + this.windowMs - now) / 1000)
    );

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

    return {
      allowed: true,
      limit,
      remaining: limit - record.timestamps.length,
      resetSeconds,
    };
  }
}

export const rateLimiter = new RateLimiter(60);
