/**
 * Utilitários para manipular o SQL das migrations (usado pelo runner de
 * migrations e pelo gerador do schema.sql).
 */

const BREAKPOINT = "--> statement-breakpoint";

/** Divide um arquivo de migration em instruções executáveis. */
export function splitStatements(sql: string): string[] {
  return sql
    .split(BREAKPOINT)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

/**
 * Converte instruções em instruções reaplicáveis (IF NOT EXISTS / DO $$ ... $$),
 * para que possam rodar em bancos que já possuem parte do schema.
 */
export function makeIdempotent(statement: string): string {
  return (
    statement
      // Função como replacement: evita a interpretação de "$" em padrões do
      // String.replace (necessário para emitir os "$$" do bloco plpgsql).
      .replace(/^CREATE TYPE (.+?);/, (_match, typeDefinition: string) =>
        `DO $$ BEGIN CREATE TYPE ${typeDefinition}; EXCEPTION WHEN duplicate_object THEN null; END $$;`
      )
      .replace(/^CREATE TABLE (?!IF NOT EXISTS)/, "CREATE TABLE IF NOT EXISTS ")
      .replace(
        /^CREATE UNIQUE INDEX (?!IF NOT EXISTS)/,
        "CREATE UNIQUE INDEX IF NOT EXISTS "
      )
      .replace(/^CREATE INDEX (?!IF NOT EXISTS)/, "CREATE INDEX IF NOT EXISTS ")
  );
}
