import postgres from "postgres";
import fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

async function initCloud() {
  if (!connectionString || connectionString.includes("localhost") || connectionString.includes("127.0.0.1")) {
    console.log("ℹ️ Conexão local ou vazia detectada no build. Pulando migração da nuvem.");
    return;
  }

  console.log("🌐 Conexão de nuvem detectada! Verificando tabelas no Neon...");
  const sql = postgres(connectionString, {
    ssl: "require",
    max: 1,
    connect_timeout: 15,
  });

  try {
    // 1. Verificar se tabela competitions existe
    const [tableCheck] = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'competitions'
      );
    `;

    if (!tableCheck.exists) {
      console.log("📄 Aplicando schema.sql no banco Neon...");
      const schemaSql = fs.readFileSync("schema.sql", "utf8");
      await sql.unsafe(schemaSql);
      console.log("✅ Schema criado com sucesso!");
    } else {
      console.log("✅ Tabelas já existem no banco Neon.");
    }

    // 2. Verificar se o catálogo já foi populado
    const [compCount] = await sql`SELECT count(*) FROM competitions;`;
    if (Number(compCount.count) === 0) {
      console.log("🌱 Banco está vazio. Populando catálogo com 26 competições, estádios e elencos...");
      await sql.end();
      const { seed } = await import("./seed.js");
      await seed(true);
      console.log("🎉 Banco Neon totalmente populado com sucesso!");
    } else {
      console.log(`✅ Banco Neon já contém ${compCount.count} competições cadastradas.`);
      
      // Atualizar escudos antigos para o CDN oficial Sofascore se existirem
      await sql`
        UPDATE teams SET logo_url = 'https://api.sofascore.app/api/v1/team/5981/image' WHERE name ILIKE '%Flamengo%' AND logo_url LIKE '%wikimedia%';
        UPDATE teams SET logo_url = 'https://api.sofascore.app/api/v1/team/1963/image' WHERE name ILIKE '%Palmeiras%' AND logo_url LIKE '%wikimedia%';
        UPDATE teams SET logo_url = 'https://api.sofascore.app/api/v1/team/1981/image' WHERE name ILIKE '%São Paulo%' AND logo_url LIKE '%wikimedia%';
        UPDATE teams SET logo_url = 'https://api.sofascore.app/api/v1/team/1957/image' WHERE name ILIKE '%Corinthians%' AND logo_url LIKE '%wikimedia%';
        UPDATE teams SET logo_url = 'https://api.sofascore.app/api/v1/team/1958/image' WHERE name ILIKE '%Botafogo%' AND logo_url LIKE '%wikimedia%';
        UPDATE teams SET logo_url = 'https://api.sofascore.app/api/v1/team/1961/image' WHERE name ILIKE '%Fluminense%' AND logo_url LIKE '%wikimedia%';
        UPDATE teams SET logo_url = 'https://api.sofascore.app/api/v1/team/1974/image' WHERE name ILIKE '%Vasco%' AND logo_url LIKE '%wikimedia%';
        UPDATE teams SET logo_url = 'https://api.sofascore.app/api/v1/team/1977/image' WHERE name ILIKE '%Atlético Mineiro%' AND logo_url LIKE '%wikimedia%';
        UPDATE teams SET logo_url = 'https://api.sofascore.app/api/v1/team/1954/image' WHERE name ILIKE '%Cruzeiro%' AND logo_url LIKE '%wikimedia%';
        UPDATE teams SET logo_url = 'https://api.sofascore.app/api/v1/team/1966/image' WHERE name ILIKE '%Internacional%' AND logo_url LIKE '%wikimedia%';
        UPDATE teams SET logo_url = 'https://api.sofascore.app/api/v1/team/5926/image' WHERE name ILIKE '%Grêmio%' AND logo_url LIKE '%wikimedia%';
        UPDATE teams SET logo_url = 'https://api.sofascore.app/api/v1/team/1955/image' WHERE name ILIKE '%Bahia%' AND logo_url LIKE '%wikimedia%';
        UPDATE teams SET logo_url = 'https://api.sofascore.app/api/v1/team/2020/image' WHERE name ILIKE '%Fortaleza%' AND logo_url LIKE '%wikimedia%';
        UPDATE teams SET logo_url = 'https://api.sofascore.app/api/v1/team/1967/image' WHERE name ILIKE '%Athletico Paranaense%' AND logo_url LIKE '%wikimedia%';
      `;

      // 3. Garantir coluna password_hash e colunas de scout de goleiro/defesa
      await sql`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);`;
      await sql.unsafe(`
        ALTER TABLE player_season_statistics ADD COLUMN IF NOT EXISTS clean_sheets INTEGER DEFAULT 0 NOT NULL;
        ALTER TABLE player_season_statistics ADD COLUMN IF NOT EXISTS saves INTEGER DEFAULT 0 NOT NULL;
        ALTER TABLE player_season_statistics ADD COLUMN IF NOT EXISTS goals_conceded INTEGER DEFAULT 0 NOT NULL;
        ALTER TABLE player_season_statistics ADD COLUMN IF NOT EXISTS penalty_saves INTEGER DEFAULT 0 NOT NULL;
      `);
      const { hashPassword } = await import("../utils/password.js");
      const passHash = hashPassword("BrasaFut@Enterprise2026");
      const key = "bf_live_enterprise_9f83a21c45e87b60d4e92a11bf738e45";

      await sql`
        INSERT INTO api_keys (user_name, email, password_hash, key, plan, rate_limit_per_minute, is_active)
        VALUES ('enterprise_admin', 'enterprise@brasafut.com.br', ${passHash}, ${key}, 'ENTERPRISE', 1000, true)
        ON CONFLICT (email) DO UPDATE SET
          user_name = EXCLUDED.user_name,
          password_hash = EXCLUDED.password_hash,
          key = EXCLUDED.key,
          plan = 'ENTERPRISE',
          rate_limit_per_minute = 1000,
          is_active = true,
          updated_at = NOW();
      `;

      await sql.end();
    }
  } catch (err) {
    console.warn("⚠️ Aviso na inicialização do banco (o build continuará):", err);
    try {
      await sql.end();
    } catch {}
  }
}

initCloud();
