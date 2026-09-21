import { db } from "../db/index.js";
import { apiUsage } from "../db/schema.js";
import { sql } from "drizzle-orm";

/**
 * Metering de uso: incrementa o contador diário da chave de forma
 * fire-and-forget (nunca bloqueia nem quebra a requisição).
 */
export function recordUsage(apiKeyId: number): void {
  void (async () => {
    try {
      await db
        .insert(apiUsage)
        .values({ apiKeyId, day: sql`CURRENT_DATE`, count: 1 })
        .onConflictDoUpdate({
          target: [apiUsage.apiKeyId, apiUsage.day],
          set: {
            count: sql`${apiUsage.count} + 1`,
            updatedAt: new Date(),
          },
        });
    } catch {
      // metering é best-effort
    }
  })();
}
