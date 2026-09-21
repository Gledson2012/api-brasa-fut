import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { rateLimiter } from "../services/rateLimiter.js";
import {
  getCachedApiKey,
  setCachedApiKey,
  type CachedApiKey,
} from "../services/apiKeyCache.js";
import { hashApiKey, safeCompare } from "../utils/apiKey.js";

/**
 * Cache das chaves autenticadas (Redis quando configurado, memória como
 * fallback). A chave em texto puro nunca é guardada: o índice é o SHA-256.
 */
export { invalidateApiKey as invalidateCachedKey } from "../services/apiKeyCache.js";

const AUTH_ROUTE_LIMIT_PER_MINUTE = 10;

export async function authAndRateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const url = request.url.split("?")[0];

  // Rotas públicas que não necessitam de API Key
  const isPublicRoute =
    url === "/" ||
    url === "/health" ||
    url.startsWith("/docs") ||
    url.startsWith("/api/v1/auth/register") ||
    url.startsWith("/api/v1/auth/login") ||
    url.startsWith("/api/v1/auth/plans") ||
    url.startsWith("/api/v1/auth/keys/rotate") ||
    url.startsWith("/api/v1/billing/webhook") ||
    url.startsWith("/openapi.json") ||
    url.startsWith("/api/v1/live/ws");

  if (isPublicRoute) {
    // Rotas públicas que recebem credenciais ficam sem rate limit por chave,
    // então aplicamos um limite por IP para dificultar força bruta.
    const isCredentialRoute =
      url.startsWith("/api/v1/auth/login") ||
      url.startsWith("/api/v1/auth/register") ||
      url.startsWith("/api/v1/auth/keys/rotate");

    if (isCredentialRoute) {
      const limit = AUTH_ROUTE_LIMIT_PER_MINUTE;
      const result = await rateLimiter.check(`ip:${request.ip}:${url}`, limit);

      reply.header("X-RateLimit-Limit", result.limit.toString());
      reply.header("X-RateLimit-Remaining", result.remaining.toString());
      reply.header("X-RateLimit-Reset", result.resetSeconds.toString());

      if (!result.allowed) {
        reply.status(429).send({
          error: "Too Many Requests",
          message: `Limite de ${limit} tentativas por minuto excedido. Tente novamente em ${result.resetSeconds}s.`,
        });
        return;
      }
    }

    return;
  }

  // Extrair API Key do cabeçalho (a query string só é aceita se habilitada
  // explicitamente, pois URLs vazam em logs, proxies e referrers).
  const apiKeyHeader = request.headers["x-api-key"];
  const queryParam =
    process.env.ALLOW_API_KEY_QUERY_PARAM === "true"
      ? (request.query as Record<string, string> | undefined)?.api_key
      : undefined;
  const rawKey = (
    typeof apiKeyHeader === "string" ? apiKeyHeader : queryParam
  )?.trim();

  if (!rawKey) {
    reply.status(401).send({
      error: "Acesso Não Autorizado",
      message:
        "Cabeçalho 'x-api-key' ausente. Obtenha uma chave gratuita via POST /api/v1/auth/register ou informe sua chave.",
      documentation: "/docs",
    });
    return;
  }

  const keyHash = hashApiKey(rawKey);

  let keyRecord: CachedApiKey | null = await getCachedApiKey(keyHash);

  if (!keyRecord) {
    const [dbKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash));

    if (!dbKey) {
      reply.status(401).send({
        error: "Chave de API Inválida",
        message: "A chave informada não existe ou foi revogada.",
      });
      return;
    }

    if (!dbKey.isActive) {
      reply.status(403).send({
        error: "Chave de API Suspensa",
        message: "Esta chave foi desativada.",
      });
      return;
    }

    keyRecord = { ...dbKey, cachedAt: Date.now() };
    await setCachedApiKey(keyRecord);
  }

  // Revalidado a cada requisição: desativação vale assim que o cache expira
  // (ou imediatamente, quando a invalidação é propagada pelo Redis).
  if (!keyRecord.isActive) {
    reply.status(403).send({
      error: "Chave de API Suspensa",
      message: "Esta chave foi desativada.",
    });
    return;
  }

  // Validar Rate Limiting
  const rateLimitResult = await rateLimiter.check(
    keyRecord.keyHash,
    keyRecord.rateLimitPerMinute
  );

  // Injetar cabeçalhos padrão de rate limiting (RFC 6585)
  reply.header("X-RateLimit-Limit", rateLimitResult.limit.toString());
  reply.header("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
  reply.header("X-RateLimit-Reset", rateLimitResult.resetSeconds.toString());

  if (!rateLimitResult.allowed) {
    reply.status(429).send({
      error: "Too Many Requests",
      message: `Limite de ${rateLimitResult.limit} requisições por minuto excedido para o plano ${keyRecord.plan}.`,
      limit: rateLimitResult.limit,
      resetInSeconds: rateLimitResult.resetSeconds,
      plan: keyRecord.plan,
      upgrade: keyRecord.plan === "FREE" ? "Atualize para o plano PRO para limite de 100 req/min." : undefined,
    });
    return;
  }

  // Anexar dados do usuário autenticado no request context
  request.apiUser = keyRecord;
}

export function requireAdminOrPlan(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedPlans: Array<"ENTERPRISE" | "PRO"> = ["ENTERPRISE"]
): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  const adminHeader = request.headers["x-admin-key"];
  if (adminSecret && adminHeader === adminSecret) {
    return true;
  }

  const user = request.apiUser;
  if (!user) {
    reply.status(401).send({ error: "Não autenticado", message: "Chave de API necessária." });
    return false;
  }

  if (
    process.env.ADMIN_API_KEY &&
    user.keyHash &&
    safeCompare(user.keyHash, hashApiKey(process.env.ADMIN_API_KEY))
  ) {
    return true;
  }

  if (!(allowedPlans as string[]).includes(user.plan)) {
    reply.status(403).send({
      error: "Acesso Negado",
      message: `Esta operação requer privilégios administrativos ou plano ${allowedPlans.join(" ou ")}.`,
    });
    return false;
  }

  return true;
}
