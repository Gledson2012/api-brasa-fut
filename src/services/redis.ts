/**
 * Cliente Redis opcional via Upstash REST API (sem dependências extras).
 *
 * Por que REST e não `redis`/`ioredis`?
 * - Funciona em serverless (Vercel) onde conexões TCP persistentes são caras.
 * - Zero novas dependências: usa `fetch` nativo.
 * - Fallback gracioso para memória quando não configurado (dev / single-instance).
 *
 * Configure:
 *   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN=xxx
 *
 * Sem essas vars, todos os serviços (rate-limit, cache, pubsub fanout)
 * operam em memória e emitem um aviso único no boot.
 */

let warned = false;

function warnOnce(message: string) {
  if (!warned) {
    warned = true;
    console.warn(`⚠️ [redis] ${message}`);
  }
}

export function isRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

async function redisCommand<T = unknown>(...args: (string | number)[]): Promise<T | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args.map(String)),
    });
    if (!res.ok) {
      warnOnce(`Upstash respondeu ${res.status}. Usando fallback em memória.`);
      return null;
    }
    const json = (await res.json()) as { result?: T; error?: string };
    if (json.error) {
      warnOnce(`Erro Upstash: ${json.error}. Usando fallback em memória.`);
      return null;
    }
    return (json.result ?? null) as T | null;
  } catch (err) {
    warnOnce(`Falha ao alcançar Upstash (${(err as Error).message}). Fallback em memória.`);
    return null;
  }
}

export async function redisGet(key: string): Promise<string | null> {
  const result = await redisCommand<string | null>("GET", key);
  return result ?? null;
}

export async function redisSetex(key: string, ttlSeconds: number, value: string): Promise<void> {
  await redisCommand("SETEX", key, ttlSeconds, value);
}

export async function redisIncr(key: string): Promise<number | null> {
  const result = await redisCommand<number>("INCR", key);
  return typeof result === "number" ? result : null;
}

export async function redisExpire(key: string, ttlSeconds: number): Promise<void> {
  await redisCommand("EXPIRE", key, ttlSeconds);
}

export async function redisDel(key: string): Promise<void> {
  await redisCommand("DEL", key);
}

/** Fanout best-effort para múltiplas instâncias (Upstash PUBLISH). Falha silenciosa. */
export async function redisPublish(channel: string, message: string): Promise<void> {
  if (!isRedisConfigured()) return;
  await redisCommand("PUBLISH", channel, message);
}

export function logRedisMode(service: string): void {
  if (isRedisConfigured()) {
    console.log(`✅ [${service}] Redis distribuído (Upstash REST) ativo.`);
  } else {
    warnOnce(
      `${service} em modo MEMÓRIA (single-instance). ` +
        `Configure UPSTASH_REDIS_REST_URL/TOKEN para multi-instância/Vercel.`
    );
  }
}
