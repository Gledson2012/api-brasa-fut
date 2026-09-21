import { db, client } from "../src/db/index.js";
import { apiKeys } from "../src/db/schema.js";
import { hashPassword } from "../src/utils/password.js";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

/**
 * Seed local de contas demo (DEV apenas). Sem segredos hardcoded:
 * usa env com fallbacks inseguros SOMENTE fora de produção.
 */
async function main() {
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  if (isProd) {
    console.error("❌ seed-enterprise bloqueado em produção. Use scripts/migrate-prod.ts com ADMIN_SECRET.");
    process.exit(1);
  }

  const email = (process.env.ENTERPRISE_EMAIL || "enterprise@brasafut.com.br").toLowerCase();
  const password = process.env.ENTERPRISE_PASSWORD || "DevEnterprise@123456";
  if (!process.env.ENTERPRISE_PASSWORD) {
    console.warn("⚠️ ENTERPRISE_PASSWORD não definido; usando senha DEV fraca. Nunca use em produção.");
  }
  const passHash = hashPassword(password);
  const key = process.env.ENTERPRISE_API_KEY || `bf_live_enterprise_${randomBytes(12).toString("hex")}`;

  const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.email, email));
  if (existing) {
    await db.update(apiKeys).set({
      userName: "enterprise_admin",
      passwordHash: passHash,
      key,
      plan: "ENTERPRISE",
      rateLimitPerMinute: 1000,
      isActive: true,
      updatedAt: new Date(),
    }).where(eq(apiKeys.id, existing.id));
    console.log("Updated local enterprise account!");
  } else {
    await db.insert(apiKeys).values({
      userName: "enterprise_admin",
      email,
      passwordHash: passHash,
      key,
      plan: "ENTERPRISE",
      rateLimitPerMinute: 1000,
      isActive: true,
    });
    console.log("Inserted local enterprise account!");
  }

  const devPassword = process.env.DEV_PASSWORD || "DevPro@2026!";
  const freePassword = process.env.FREE_PASSWORD || "FreeUser@2026!";
  if (!process.env.DEV_PASSWORD || !process.env.FREE_PASSWORD) {
    console.warn("⚠️ DEV_PASSWORD/FREE_PASSWORD não definidos; usando fallbacks DEV.");
  }

  // Also update demo & free accounts with passwords if they lack them
  await db.update(apiKeys).set({
    passwordHash: hashPassword(devPassword),
  }).where(eq(apiKeys.email, "dev@brasafut.com.br"));

  await db.update(apiKeys).set({
    passwordHash: hashPassword(freePassword),
  }).where(eq(apiKeys.email, "free@brasafut.com.br"));

  console.log("Passwords set for all demo accounts!");
  await client.end();
}

main().catch(console.error);
