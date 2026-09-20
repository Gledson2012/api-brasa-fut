import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { client, db } from "./index.js";
import { makeIdempotent, splitStatements } from "./sql.js";

/**
 * Runner de migrations do projeto.
 *
 * O schema é versionado por migrations geradas com `npm run db:generate`
 * (drizzle-kit) e aplicadas aqui com `npm run db:migrate`.
 *
 * Bancos criados antes da adoção das migrations (schema.sql / DDL em runtime)
 * já possuem as tabelas do baseline. Para esses casos aplicamos apenas as
 * reparações de colunas abaixo e registramos o baseline como já aplicado, de
 * forma que as próximas migrations sejam executadas normalmente.
 */

const MIGRATIONS_FOLDER =
  process.env.MIGRATIONS_FOLDER || path.resolve(process.cwd(), "drizzle");

const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

/** Tabelas criadas pela primeira migration (baseline) do projeto. */
const BASELINE_TABLES = [
  "venues",
  "teams",
  "competitions",
  "seasons",
  "players",
  "team_rosters",
  "matches",
  "match_lineups",
  "match_events",
  "standings",
  "match_statistics",
  "api_keys",
  "webhooks",
  "webhook_deliveries",
  "player_season_statistics",
  "payments",
  "transfers",
  "team_absences",
  "referees",
];

/**
 * Reparações idempotentes aplicadas apenas em bancos legados (criados antes das
 * migrations). Em bancos novos essas colunas já vêm da migration baseline.
 * Nunca adicione DDL novo aqui: use `npm run db:generate`.
 */
const LEGACY_COLUMN_REPAIRS = [
  `ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "password_hash" varchar(255);`,
  `ALTER TABLE "player_season_statistics" ADD COLUMN IF NOT EXISTS "clean_sheets" integer DEFAULT 0 NOT NULL;`,
  `ALTER TABLE "player_season_statistics" ADD COLUMN IF NOT EXISTS "saves" integer DEFAULT 0 NOT NULL;`,
  `ALTER TABLE "player_season_statistics" ADD COLUMN IF NOT EXISTS "goals_conceded" integer DEFAULT 0 NOT NULL;`,
  `ALTER TABLE "player_season_statistics" ADD COLUMN IF NOT EXISTS "penalty_saves" integer DEFAULT 0 NOT NULL;`,
];

function readJournal(): Journal {
  const journalPath = path.join(MIGRATIONS_FOLDER, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    throw new Error(
      `Pasta de migrations não encontrada em '${MIGRATIONS_FOLDER}'. Rode 'npm run db:generate' primeiro.`
    );
  }
  return JSON.parse(fs.readFileSync(journalPath, "utf8")) as Journal;
}

function readMigrationSql(tag: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");
}

/** Mesmo hash usado pelo migrator do Drizzle (sha256 do arquivo inteiro). */
function migrationHash(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

async function tableExists(tableName: string): Promise<boolean> {
  const [row] = await client`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) AS present;
  `;
  return Boolean(row?.present);
}

async function ensureMigrationsTable(): Promise<void> {
  await client.unsafe(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);
}

async function getLastAppliedMigrationAt(): Promise<number | null> {
  const [row] = await client.unsafe(
    `SELECT created_at FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ORDER BY created_at DESC LIMIT 1;`
  );
  return row?.created_at === undefined || row?.created_at === null
    ? null
    : Number(row.created_at);
}

/**
 * Aplica o baseline de forma idempotente em bancos legados incompletos.
 */
async function applyIdempotentMigration(sql: string): Promise<void> {
  for (const statement of splitStatements(sql)) {
    try {
      await client.unsafe(makeIdempotent(statement));
    } catch (error) {
      throw new Error(
        `Falha ao aplicar instrução do baseline: ${(error as Error).message}\n${statement.slice(0, 200)}`
      );
    }
  }
}

async function stampMigration(sql: string, when: number): Promise<void> {
  await client`
    INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
    VALUES (${migrationHash(sql)}, ${when});
  `;
}

export type MigrationResult =
  | "fresh"
  | "legacy-repaired"
  | "legacy-stamped"
  | "up-to-date";

/**
 * Aplica todas as migrations pendentes.
 *
 * - Banco novo: roda o baseline + migrations seguintes.
 * - Banco legado (sem tabela de controle): repara colunas faltantes, registra o
 *   baseline como aplicado e segue normalmente.
 */
export async function runMigrations(): Promise<MigrationResult> {
  const journal = readJournal();
  const baseline = journal.entries[0];
  const hasLegacySchema = await tableExists("competitions");

  let result: MigrationResult = "fresh";
  let legacyNeedsRepair = false;

  if (hasLegacySchema) {
    await ensureMigrationsTable();
    const lastAppliedAt = await getLastAppliedMigrationAt();

    if (lastAppliedAt === null) {
      const baselineSql = readMigrationSql(baseline.tag);

      const missingTables: string[] = [];
      for (const table of BASELINE_TABLES) {
        if (!(await tableExists(table))) missingTables.push(table);
      }

      if (missingTables.length > 0) {
        console.log(
          `🔧 Banco legado incompleto (faltando: ${missingTables.join(", ")}). Aplicando baseline de forma idempotente...`
        );
        await applyIdempotentMigration(baselineSql);
        legacyNeedsRepair = true;
      }

      for (const repair of LEGACY_COLUMN_REPAIRS) {
        await client.unsafe(repair);
      }

      await stampMigration(baselineSql, baseline.when);
      result = legacyNeedsRepair ? "legacy-repaired" : "legacy-stamped";
      console.log(
        `✅ Baseline '${baseline.tag}' registrado como aplicado (banco legado).`
      );
    } else {
      result = "up-to-date";
    }
  }

  await migrate(db, {
    migrationsFolder: MIGRATIONS_FOLDER,
    migrationsSchema: MIGRATIONS_SCHEMA,
    migrationsTable: MIGRATIONS_TABLE,
  });

  return result;
}

// Executar se chamado diretamente via CLI (npm run db:migrate)
if (
  process.argv[1] &&
  (process.argv[1].endsWith("migrate.ts") || process.argv[1].endsWith("migrate.js"))
) {
  runMigrations()
    .then(async (mode) => {
      console.log(`🎉 Migrations aplicadas com sucesso (modo: ${mode}).`);
      await client.end();
    })
    .catch(async (error) => {
      console.error("❌ Erro ao aplicar migrations:", error);
      await client.end().catch(() => {});
      process.exit(1);
    });
}
