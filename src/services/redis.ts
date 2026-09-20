import { Redis, type RedisOptions } from "ioredis";

/**
 * Provedor do cliente Redis.
 *
 * O Redis é OPCIONAL: quando não configurado (ou indisponível) os consumidores
 * caem automaticamente para o cache/rate limit em memória do processo.
 *
 * Variáveis suportadas:
 * - REDIS_URL (recomendado, ex.: redis:// ou rediss:// do Upstash/Neon)
 * - REDIS_HOST / REDIS_PORT / REDIS_PASSWORD / REDIS_DB
 * - DISABLE_REDIS=true força o modo em memória
 *
 * Observação: em ambiente serverless o cache em memória é por instância; para
 * cache e rate limit compartilhados é necessário o Redis configurado.
 */

const RETRY_AFTER_MS = 30_000;
const CONNECT_TIMEOUT_MS = 2_000;

let client: Redis | null = null;
let connectAttempt: Promise<void> | null = null;
let unavailableUntil = 0;
let loggedFailure = false;

interface ResolvedConfig {
  url?: string;
  options: RedisOptions;
}

function resolveConfig(): ResolvedConfig | null {
  if (process.env.DISABLE_REDIS === "true") return null;

  const url =
    process.env.REDIS_URL ||
    process.env.REDIS_TLS_URL ||
    process.env.UPSTASH_REDIS_URL;

  const host = process.env.REDIS_HOST;

  if (!url && !host) return null;

  const options: RedisOptions = {
    lazyConnect: true,
    // Falha rápido em vez de enfileirar comandos quando o Redis está fora.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: CONNECT_TIMEOUT_MS,
    enableReadyCheck: true,
    retryStrategy: () => null,
  };

  if (url) {
    return { url, options };
  }

  return {
    options: {
      ...options,
      host: host as string,
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB) || 0,
    },
  };
}

function markUnavailable(error?: Error): void {
  unavailableUntil = Date.now() + RETRY_AFTER_MS;
  if (client && (client.status === "end" || client.status === "close")) {
    client = null;
  }
  if (error && !loggedFailure) {
    loggedFailure = true;
    console.warn(
      `[Redis] Indisponível (${error.message}). Usando cache em memória até reconectar.`
    );
  }
}

/**
 * Retorna um cliente Redis pronto para uso ou `null` quando o Redis não está
 * configurado/indisponível (nesse caso os serviços usam o fallback em memória).
 */
export async function getRedis(): Promise<Redis | null> {
  const config = resolveConfig();
  if (!config) return null;

  if (client && client.status === "ready") return client;
  if (Date.now() < unavailableUntil) return null;

  if (!connectAttempt) {
    connectAttempt = (async () => {
      try {
        if (!client) {
          client = config.url
            ? new Redis(config.url, config.options)
            : new Redis(config.options);

          client.on("error", (error: Error) => markUnavailable(error));
          client.on("end", () => markUnavailable());
        }

        if (client.status === "wait") {
          await client.connect();
        }
        await client.ping();
        loggedFailure = false;
        console.log("[Redis] Conectado. Cache e rate limit compartilhados ativos.");
      } catch (error) {
        markUnavailable(error as Error);
      } finally {
        connectAttempt = null;
      }
    })();
  }

  await connectAttempt;
  return client && client.status === "ready" ? client : null;
}

/** Exposto para os serviços montarem chaves namespaced. */
export const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || "brasafut:";
