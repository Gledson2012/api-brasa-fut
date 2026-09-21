import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Busca insensível a acentos usando a extensão `unaccent` do PostgreSQL.
 * "sao paulo" encontra "São Paulo"; "corinthians" encontra "Corinthians".
 *
 * O termo é interpolado como parâmetro vinculado (sem risco de SQL injection).
 * Requer `CREATE EXTENSION IF NOT EXISTS "unaccent"` (ver scripts/migrate-prod.ts
 * e schema.sql; o Docker Compose já aplica no provisionamento).
 */
export function unaccentIlike(column: AnyPgColumn, term: string): SQL {
  const pattern = `%${term.trim()}%`;
  return sql`unaccent(${column}::text) ILIKE unaccent(${pattern})`;
}

/** Variante para igualdade exata insensível a acentos (ex: siglas, cidades). */
export function unaccentEq(column: AnyPgColumn, value: string): SQL {
  return sql`unaccent(${column}::text) ILIKE unaccent(${value})`;
}
