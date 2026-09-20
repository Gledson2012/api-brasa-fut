import { client, db } from "../src/db/index.js";
import { apiKeys } from "../src/db/schema.js";
import { hashPassword } from "../src/utils/password.js";
import {
  apiKeyPrefix,
  generateApiKey,
  hashApiKey,
} from "../src/utils/apiKey.js";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";

/**
 * Cria (ou promove) a conta ENTERPRISE inicial.
 *
 * Credenciais vêm do ambiente — nunca do código:
 *   BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_USER,
 *   BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ADMIN_KEY
 *
 * Sem senha/chave informadas, valores aleatórios são gerados e impressos uma
 * única vez.
 */
async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  if (!email) {
    throw new Error(
      "Defina BOOTSTRAP_ADMIN_EMAIL para criar a conta ENTERPRISE inicial."
    );
  }

  const userName = process.env.BOOTSTRAP_ADMIN_USER || "enterprise_admin";
  const generatedPassword = `Bf!${randomBytes(12).toString("base64url")}`;
  const generatedKey = generateApiKey("ENTERPRISE");

  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const key = process.env.BOOTSTRAP_ADMIN_KEY;

  const passwordHash = hashPassword(password || generatedPassword);

  const [existing] = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.email, email));

  const apiKey = key || generatedKey;

  if (existing) {
    await db
      .update(apiKeys)
      .set({
        userName,
        passwordHash,
        keyHash: hashApiKey(apiKey),
        keyPrefix: apiKeyPrefix(apiKey),
        plan: "ENTERPRISE",
        rateLimitPerMinute: 1000,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, existing.id));
    console.log(`Conta ENTERPRISE atualizada para ${email}.`);
  } else {
    await db.insert(apiKeys).values({
      userName,
      email,
      passwordHash,
      keyHash: hashApiKey(apiKey),
      keyPrefix: apiKeyPrefix(apiKey),
      plan: "ENTERPRISE",
      rateLimitPerMinute: 1000,
      isActive: true,
    });
    console.log(`Conta ENTERPRISE criada para ${email}.`);
  }

  if (!password) {
    console.log(`Senha gerada (guarde agora): ${generatedPassword}`);
  }
  if (!key) {
    console.log(`API Key gerada (guarde agora): ${generatedKey}`);
  }

  await client.end();
}

main().catch(async (error) => {
  console.error("❌ Erro ao configurar a conta ENTERPRISE:", error);
  await client.end().catch(() => {});
  process.exit(1);
});
