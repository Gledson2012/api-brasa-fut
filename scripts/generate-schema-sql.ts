import fs from "node:fs";
import path from "node:path";
import { makeIdempotent, splitStatements } from "../src/db/sql.js";

/**
 * Gera o `schema.sql` (bootstrap de banco vazio, usado pelo docker-compose) a
 * partir das migrations versionadas em `drizzle/`.
 *
 * Rodar sempre que uma migration for criada: `npm run db:schema-sql`.
 */

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");
const OUTPUT_FILE = path.resolve(process.cwd(), "schema.sql");

interface JournalEntry {
  idx: number;
  tag: string;
}

interface Journal {
  entries: JournalEntry[];
}

const journal = JSON.parse(
  fs.readFileSync(path.join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8")
) as Journal;

const statements = journal.entries.flatMap((entry) => {
  const sql = fs.readFileSync(
    path.join(MIGRATIONS_FOLDER, `${entry.tag}.sql`),
    "utf8"
  );
  return splitStatements(sql).map(makeIdempotent);
});

const header = `-- ============================================================================
-- SCHEMA DA BRASAFUT API (POSTGRESQL)
-- ============================================================================
-- ARQUIVO GERADO AUTOMATICAMENTE — NÃO EDITE À MÃO.
-- Fonte: migrations em ./drizzle (npm run db:generate + npm run db:schema-sql).
-- ============================================================================

-- Extensões úteis (busca textual sem acentos)
CREATE EXTENSION IF NOT EXISTS "unaccent";
`;

const triggers = `
-- ============================================================================
-- FUNÇÃO E TRIGGERS DE UPDATED_AT AUTOMÁTICO
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'updated_at'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_set_timestamp_%I ON %I;', t, t);
        EXECUTE format('CREATE TRIGGER trg_set_timestamp_%I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();', t, t);
    END LOOP;
END;
$$;
`;

const content = [header, ...statements, triggers].join("\n\n") + "\n";

fs.writeFileSync(OUTPUT_FILE, content, "utf8");
console.log(
  `✅ schema.sql regenerado a partir de ${journal.entries.length} migration(s) e ${statements.length} instruções.`
);
