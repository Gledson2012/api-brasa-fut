import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { rateLimiter } from "../services/rateLimiter.js";

// Cache em memória de API Keys válidas para latência quase zero (TTL de 60s)
interface CachedKey {
  id: number;
  userName: string;
  email: string;
  key: string;
  plan: "FREE" | "PRO" | "ENTERPRISE";
  rateLimitPerMinute: number;
  isActive: boolean;
  cachedAt: number;
}

const keyCache = new Map<string, CachedKey>();
const CACHE_TTL_MS = 60 * 1000;

export async function authAndRateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const url = request.url.split("?")[0];

  // Rotas públicas que não necessitam de API Key.
  // NOTA: endpoints de migração/seed NUNCA devem ser públicos (ver scripts/migrate-prod.ts).
  const isPublicRoute =
    url === "/" ||
    url === "/health" ||
    url === "/api/v1/health" ||
    url.startsWith("/docs") ||
    url === "/api/v1/auth/register" ||
    url.startsWith("/api/v1/auth/register?") ||
    url === "/api/v1/auth/login" ||
    url.startsWith("/api/v1/auth/login?") ||
    url === "/api/v1/auth/plans" ||
    url.startsWith("/api/v1/auth/plans?") ||
    url.startsWith("/api/v1/live/ws");

  if (isPublicRoute) {
    return;
  }

  // Extrair API Key do cabeçalho ou query param
  const apiKeyHeader = request.headers["x-api-key"];
  const queryParam = (request.query as Record<string, string> | undefined)?.api_key;
  const rawKey = (typeof apiKeyHeader === "string" ? apiKeyHeader : queryParam)?.trim();

  if (!rawKey) {
    reply.status(401).send({
      error: "Acesso Não Autorizado",
      message:
        "Cabeçalho 'x-api-key' ausente. Obtenha uma chave gratuita via POST /api/v1/auth/register ou informe sua chave.",
      documentation: "/docs",
    });
    return;
  }

  // Verificar cache local
  const now = Date.now();
  let keyRecord = keyCache.get(rawKey);

  if (!keyRecord || now - keyRecord.cachedAt > CACHE_TTL_MS) {
    const [dbKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.key, rawKey));

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

    keyRecord = {
      ...dbKey,
      cachedAt: now,
    };
    keyCache.set(rawKey, keyRecord);
  }

  // Validar Rate Limiting (distribuído via Redis quando configurado)
  const rateLimitResult = await rateLimiter.check(
    keyRecord.key,
    keyRecord.rateLimitPerMinute
  );

  // Injetar cabeçalhos padrão de rate limiting (RFC 6585)
  reply.header("X-RateLimit-Limit", rateLimitResult.limit.toString());
  reply.header("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
  reply.header("X-RateLimit-Reset", rateLimitResult.resetSeconds.toString());

  if (!rateLimitResult.allowed) {
    reply.header("Retry-After", rateLimitResult.resetSeconds.toString());
    reply.status(429).send({
      error: "Too Many Requests",
      message: `Limite de ${rateLimitResult.limit} requisições por minuto excedido para o plano ${keyRecord.plan}.`,
      limit: rateLimitResult.limit,
      resetInSeconds: rateLimitResult.resetSeconds,
      plan: keyRecord.plan,
      upgrade: keyRecord.plan === "FREE" ? "Atualize para o plano PRO para limite de 120 req/min." : undefined,
    });
    return;
  }

  // Anexar dados do usuário autenticado no request context
  (request as any).apiUser = keyRecord;
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

  const user = (request as any).apiUser;
  if (!user) {
    reply.status(401).send({ error: "Não autenticado", message: "Chave de API necessária." });
    return false;
  }

  if (process.env.ADMIN_API_KEY && user.key === process.env.ADMIN_API_KEY) {
    return true;
  }

  if (!allowedPlans.includes(user.plan)) {
    reply.status(403).send({
      error: "Acesso Negado",
      message: `Esta operação requer privilégios administrativos ou plano ${allowedPlans.join(" ou ")}.`,
    });
    return false;
  }

  return true;
}
