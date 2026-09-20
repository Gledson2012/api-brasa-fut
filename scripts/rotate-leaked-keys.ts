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
import { invalidateApiKey } from "../src/services/apiKeyCache.js";

/**
 * Rotaciona credenciais de contas cujas chaves/senhas foram expostas no
 * histórico do git (contas criadas pelo antigo seed e pelo antigo endpoint
 * /api/v1/auth/migrate-db).
 *
 * Uso:
 *   npm run db:rotate-leaked                      # rotaciona chave + senha
 *   LEAKED_ACCOUNTS="a@x.com,b@y.com" npm run db:rotate-leaked
 *   npm run db:rotate-leaked -- --deactivate      # desativa as contas
 *   npm run db:rotate-leaked -- --dry-run
 */

const DEFAULT_ACCOUNTS = [
  "enterprise@brasafut.com.br",
  "dev@brasafut.com.br",
  "free@brasafut.com.br",
];

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const deactivate = args.has("--deactivate");

function newPassword(): string {
  return `Bf!${randomBytes(12).toString("base64url")}`;
}

async function main() {
  const emails = (process.env.LEAKED_ACCOUNTS || DEFAULT_ACCOUNTS.join(","))
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const results: Array<Record<string, string>> = [];

  for (const email of emails) {
    const [account] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.email, email));

    if (!account) {
      results.push({ email, acao: "conta não encontrada" });
      continue;
    }

    if (dryRun) {
      results.push({
        email,
        acao: deactivate ? "seria desativada" : "seria rotacionada",
        chave_atual: account.keyPrefix ?? "-",
        plano: account.plan,
      });
      continue;
    }

    if (deactivate) {
      await db
        .update(apiKeys)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(apiKeys.id, account.id));

      await invalidateApiKey(account.keyHash);

      results.push({
        email,
        acao: "DESATIVADA",
        chave_antiga: account.keyPrefix ?? "-",
        plano: account.plan,
      });
      continue;
    }

    const rotatedKey = generateApiKey(account.plan);
    const rotatedPassword = newPassword();
    const keepPassword = !account.passwordHash;

    await db
      .update(apiKeys)
      .set({
        keyHash: hashApiKey(rotatedKey),
        keyPrefix: apiKeyPrefix(rotatedKey),
        ...(keepPassword ? {} : { passwordHash: hashPassword(rotatedPassword) }),
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, account.id));

    // Tira a credencial antiga do cache (vale para toda a frota com Redis).
    await invalidateApiKey(account.keyHash);

    results.push({
      email,
      acao: "ROTACIONADA",
      chave_antiga: account.keyPrefix ?? "-",
      nova_api_key: rotatedKey,
      nova_senha: keepPassword ? "(conta sem senha)" : rotatedPassword,
      plano: account.plan,
    });
  }

  console.log("\n===== ROTAÇÃO DE CREDENCIAIS VAZADAS =====");
  if (dryRun) console.log("(modo --dry-run: nada foi alterado)\n");
  for (const row of results) {
    for (const [key, value] of Object.entries(row)) {
      console.log(`${key.padEnd(14)}: ${value}`);
    }
    console.log("---");
  }

  if (!dryRun && !deactivate) {
    console.log(
      "⚠️  Guarde as novas chaves/senhas acima: elas aparecem apenas uma vez."
    );
    console.log(
      "⚠️  Atualize os clientes e secrets (ex.: API_KEY do GitHub Action) imediatamente."
    );
  }

  await client.end();
}

main().catch(async (error) => {
  console.error("❌ Erro ao rotacionar credenciais:", error);
  await client.end().catch(() => {});
  process.exit(1);
});
