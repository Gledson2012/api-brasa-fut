/**
 * Migração administrativa via CLI (substitui os endpoints HTTP removidos
 * GET /api/v1/auth/migrate-db e GET /api/v1/sync/setup-enterprise).
 *
 * Uso:
 *   ADMIN_SECRET=xxx ENTERPRISE_EMAIL=... ENTERPRISE_PASSWORD=... tsx scripts/migrate-prod.ts
 *
 * Nunca exponha DDL via HTTP. Este script exige ADMIN_SECRET e usa
 * credenciais via env (sem segredos hardcoded).
 */
import { client } from "../src/db/index.js";
import { hashPassword } from "../src/utils/password.js";
import { randomBytes } from "node:crypto";

async function main() {
  const adminSecret = process.env.ADMIN_SECRET;
  const provided = process.env.MIGRATE_ADMIN_SECRET || process.argv[2];
  if (!adminSecret || provided !== adminSecret) {
    console.error(
      "❌ ADMIN_SECRET inválido. Exporte ADMIN_SECRET e passe o mesmo valor em MIGRATE_ADMIN_SECRET (ou argv[2])."
    );
    process.exit(1);
  }

  const email = (process.env.ENTERPRISE_EMAIL || "enterprise@brasafut.com.br").toLowerCase().trim();
  const password = process.env.ENTERPRISE_PASSWORD;
  if (!password || password.length < 12) {
    console.error("❌ Defina ENTERPRISE_PASSWORD com ao menos 12 caracteres via env.");
    process.exit(1);
  }
  const existingKey = process.env.ENTERPRISE_API_KEY;
  const key = existingKey || `bf_live_enterprise_${randomBytes(24).toString("hex")}`;

  await client`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);`;

  // Extensão para busca insensível a acentos (usada por unaccentIlike em search/teams/players)
  await client`CREATE EXTENSION IF NOT EXISTS "unaccent";`;

  // Sprint 2: rotação de chaves (grace period) + metering de uso
  await client`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS previous_key VARCHAR(64);`;
  await client`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS previous_key_expires_at TIMESTAMPTZ;`;
  await client`DO $$ BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_previous_key ON api_keys (previous_key);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;`;
  await client`
    CREATE TABLE IF NOT EXISTS api_usage (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      api_key_id BIGINT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
      day DATE NOT NULL,
      count INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT uq_api_usage_key_day UNIQUE (api_key_id, day)
    );
    CREATE INDEX IF NOT EXISTS idx_api_usage_key_day ON api_usage (api_key_id, day);
  `;

  const passHash = hashPassword(password);
  await client`
    INSERT INTO api_keys (user_name, email, password_hash, key, plan, rate_limit_per_minute, is_active)
    VALUES ('enterprise_admin', ${email}, ${passHash}, ${key}, 'ENTERPRISE', 1000, true)
    ON CONFLICT (email) DO UPDATE SET
      user_name = EXCLUDED.user_name,
      password_hash = EXCLUDED.password_hash,
      key = EXCLUDED.key,
      plan = 'ENTERPRISE',
      rate_limit_per_minute = 1000,
      is_active = true,
      updated_at = NOW();
  `;

  console.log("✅ Migração administrativa concluída.");
  console.log(`   email: ${email}`);
  console.log(`   key: ${key.slice(0, 12)}... (armazene com segurança)`);
  await client.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
