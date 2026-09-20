import { getRedis, REDIS_KEY_PREFIX } from "./redis.js";

export interface CachedApiKey {
  id: number;
  userName: string;
  email: string;
  keyHash: string;
  keyPrefix: string | null;
  plan: "FREE" | "PRO" | "ENTERPRISE";
  rateLimitPerMinute: number;
  isActive: boolean;
  cachedAt: number;
}

const KEY_PREFIX = `${REDIS_KEY_PREFIX}apikey:`;
const TTL_SECONDS = 60;
const MAX_MEMORY_ENTRIES = 5_000;

/**
 * Cache das chaves de API autenticadas.
 *
 * Com Redis configurado, o registro fica compartilhado entre instâncias — assim
 * rotação/desativação (`invalidateApiKey`) passa a valer imediatamente em toda
 * a frota. Sem Redis, o cache é local ao processo e a invalidação depende do
 * TTL de 60s nas outras instâncias.
 */
const memoryCache = new Map<string, CachedApiKey>();

function redisKey(keyHash: string): string {
  return `${KEY_PREFIX}${keyHash}`;
}

export async function getCachedApiKey(
  keyHash: string
): Promise<CachedApiKey | null> {
  const redis = await getRedis();
  if (redis) {
    try {
      const raw = await redis.get(redisKey(keyHash));
      if (raw) return JSON.parse(raw) as CachedApiKey;
      return null;
    } catch {
      // segue para o fallback em memória
    }
  }

  const entry = memoryCache.get(keyHash);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_SECONDS * 1000) {
    memoryCache.delete(keyHash);
    return null;
  }
  return entry;
}

export async function setCachedApiKey(record: CachedApiKey): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set(
        redisKey(record.keyHash),
        JSON.stringify(record),
        "EX",
        TTL_SECONDS
      );
      return;
    } catch {
      // segue para o fallback em memória
    }
  }

  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    pruneMemoryCache();
  }
  memoryCache.set(record.keyHash, record);
}

/** Remove a chave do cache (rotação, desativação, exclusão da conta). */
export async function invalidateApiKey(keyHash: string): Promise<void> {
  memoryCache.delete(keyHash);

  const redis = await getRedis();
  if (redis) {
    try {
      await redis.del(redisKey(keyHash));
    } catch {
      // o TTL resolve na pior das hipóteses
    }
  }
}

/** Limpeza periódica do fallback em memória. */
export function pruneMemoryCache(): void {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (now - entry.cachedAt > TTL_SECONDS * 1000) {
      memoryCache.delete(key);
    }
  }

  while (memoryCache.size > MAX_MEMORY_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest === undefined) break;
    memoryCache.delete(oldest);
  }
}

if (!process.env.VERCEL) {
  setInterval(pruneMemoryCache, 120_000).unref();
}
