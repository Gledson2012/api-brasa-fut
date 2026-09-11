import { createHmac } from "node:crypto";
import { db } from "../db/index.js";
import { webhooks, webhookDeliveries } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

export interface WebhookEventPayload {
  event: "SCORE_UPDATE" | "MATCH_EVENT" | "STATUS_CHANGE";
  matchId: number;
  timestamp: string;
  data: Record<string, unknown>;
}

export class WebhookDispatcher {
  public static async dispatch(payload: WebhookEventPayload) {
    try {
      // Buscar webhooks ativos que aceitam este tipo de evento ou 'ALL'
      const activeWebhooks = await db
        .select()
        .from(webhooks)
        .where(
          and(
            eq(webhooks.isActive, true),
            sql`${payload.event} = ANY(${webhooks.events}) OR 'ALL' = ANY(${webhooks.events})`
          )
        );

      if (activeWebhooks.length === 0) return;

      const serializedPayload = JSON.stringify(payload);

      // Disparar para cada webhook de forma concorrente sem bloquear a API
      for (const hook of activeWebhooks) {
        this.sendWebhook(hook, payload.event, serializedPayload).catch((err) => {
          console.error(`Falha ao disparar webhook para ${hook.url}:`, err);
        });
      }
    } catch (err) {
      console.error("Erro no WebhookDispatcher:", err);
    }
  }

  private static async sendWebhook(
    hook: typeof webhooks.$inferSelect,
    eventType: string,
    body: string
  ) {
    const signature = createHmac("sha256", hook.secret)
      .update(body)
      .digest("hex");

    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let success = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BrasaFut-Webhook-Dispatcher/1.0",
          "X-BrasaFut-Event": eventType,
          "X-BrasaFut-Signature": `sha256=${signature}`,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      statusCode = response.status;
      success = response.ok;
      responseBody = await response.text().catch(() => null);
    } catch (err: any) {
      statusCode = null;
      responseBody = err?.message || "Connection failed";
      success = false;
    }

    // Registrar auditoria da entrega
    await db.insert(webhookDeliveries).values({
      webhookId: hook.id,
      eventType,
      payload: JSON.parse(body),
      statusCode,
      responseBody: responseBody ? responseBody.slice(0, 1000) : null,
      success,
      attemptCount: 1,
    });
  }
}
