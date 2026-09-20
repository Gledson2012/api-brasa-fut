import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Geração e verificação de chaves de API.
 *
 * A chave em texto puro é exibida apenas uma vez, no momento da criação/rotação.
 * O banco guarda somente o SHA-256 (`key_hash`) e um prefixo legível
 * (`key_prefix`) usado para identificar a chave sem expô-la.
 */

const PREFIX_BY_PLAN = {
  FREE: "bf_live",
  PRO: "bf_live",
  ENTERPRISE: "bf_live_enterprise",
} as const;

export type ApiPlan = keyof typeof PREFIX_BY_PLAN;

/** Quantidade de caracteres da chave guardada como prefixo de exibição. */
export const KEY_PREFIX_LENGTH = 12;

/**
 * Gera uma chave nova. Entropia de 160 bits (20 bytes) para planos comuns e
 * 192 bits para ENTERPRISE.
 */
export function generateApiKey(plan: ApiPlan = "FREE"): string {
  const bytes = plan === "ENTERPRISE" ? 24 : 20;
  return `${PREFIX_BY_PLAN[plan]}_${randomBytes(bytes).toString("hex")}`;
}

/** SHA-256 em hexadecimal — mesmo formato guardado em `api_keys.key_hash`. */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function apiKeyPrefix(key: string): string {
  return key.slice(0, KEY_PREFIX_LENGTH);
}

/** Compara duas chaves em tempo constante (via digest de tamanho fixo). */
export function safeCompare(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}
