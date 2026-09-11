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
