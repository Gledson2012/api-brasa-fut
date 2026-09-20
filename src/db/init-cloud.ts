import * as dotenv from "dotenv";
import { client } from "./index.js";
import { runMigrations } from "./migrate.js";

dotenv.config();

/**
 * Inicialização do banco em nuvem (executada no build/deploy).
 *
 * 1. Aplica as migrations versionadas em `drizzle/`.
 * 2. Popula o catálogo na primeira execução (banco vazio).
 *
 * DDL novo deve entrar como migration (`npm run db:generate`), nunca aqui.
 */
async function initCloud() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING;

  if (
    !connectionString ||
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1")
  ) {
    console.log(
      "ℹ️ Conexão local ou vazia detectada no build. Pulando migrations da nuvem."
    );
    return;
  }

  console.log("🌐 Conexão de nuvem detectada! Aplicando migrations...");

  try {
    const mode = await runMigrations();
    console.log(`✅ Schema sincronizado (modo: ${mode}).`);

    const [compCount] = await client`SELECT count(*) FROM competitions;`;
    if (Number(compCount.count) === 0) {
      console.log(
        "🌱 Banco está vazio. Populando catálogo com competições, estádios e elencos..."
      );
      await client.end();
      const { seed } = await import("./seed.js");
      await seed(true);
      console.log("🎉 Banco totalmente populado com sucesso!");
    } else {
      console.log(
        `✅ Banco já contém ${compCount.count} competições cadastradas.`
      );
      await client.end();
    }
  } catch (error) {
    // O build não deve quebrar caso o banco esteja indisponível.
    console.warn(
      "⚠️ Aviso na inicialização do banco (o build continuará):",
      error
    );
    try {
      await client.end();
    } catch {
      // ignora
    }
  }
}

initCloud();
