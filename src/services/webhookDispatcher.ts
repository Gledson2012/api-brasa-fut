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

      // Disparar para cada webhook de forma concorrente sem bloquear a API
      for (const hook of activeWebhooks) {
        this.sendWebhook(hook, payload).catch((err) => {
          console.error(`Falha ao disparar webhook para ${hook.url}:`, err);
        });
      }
    } catch (err) {
      console.error("Erro no WebhookDispatcher:", err);
    }
  }

  public static async dispatchTo(
    hook: typeof webhooks.$inferSelect,
    payload: WebhookEventPayload
  ) {
    try {
      await this.sendWebhook(hook, payload);
    } catch (err) {
      console.error(`Erro ao disparar webhook individual para ${hook.url}:`, err);
    }
  }

  private static formatDiscordPayload(payload: WebhookEventPayload): string {
    const data = payload.data as any;
    const homeTeam = data.homeTeam || "Time Mandante";
    const awayTeam = data.awayTeam || "Time Visitante";
    const homeScore = data.homeScore ?? 0;
    const awayScore = data.awayScore ?? 0;

    let title = `📢 Atualização de Jogo: ${homeTeam} ${homeScore} x ${awayScore} ${awayTeam}`;
    let description = "Atualização em tempo real via BrasaFut API";
    let color = 0x1e88e5; // Blue

    if (payload.event === "SCORE_UPDATE") {
      title = `⚽ GOL! ${homeTeam} ${homeScore} x ${awayScore} ${awayTeam}`;
      description = data.scorer ? `Gol marcado por **${data.scorer}** aos ${data.minute}'!` : `Placar alterado!`;
      color = 0x43a047; // Green
    } else if (payload.event === "STATUS_CHANGE") {
      title = `⏱️ Status: ${data.status || "Em andamento"}`;
      description = `Partida: **${homeTeam} ${homeScore} x ${awayScore} ${awayTeam}**`;
      color = 0xfb8c00; // Orange
    } else if (payload.event === "MATCH_EVENT") {
      if (data.type === "RED_CARD") {
        title = `🟥 Cartão Vermelho!`;
        description = `Jogador expulso aos ${data.minute}'!`;
        color = 0xe53935; // Red
      }
    }

    return JSON.stringify({
      username: "BrasaFut Live",
      avatar_url: "https://upload.wikimedia.org/wikipedia/pt/b/b4/Campeonato_Brasileiro_S%C3%A9rie_A_logo.png",
      embeds: [
        {
          title,
          description,
          color,
          fields: [
            { name: "Mandante", value: String(homeTeam), inline: true },
            { name: "Placar", value: `${homeScore} - ${awayScore}`, inline: true },
            { name: "Visitante", value: String(awayTeam), inline: true },
          ],
          footer: { text: "BrasaFut API - Webhook Notification" },
          timestamp: payload.timestamp,
        },
      ],
    });
  }

  private static formatTelegramPayload(payload: WebhookEventPayload): string {
    const data = payload.data as any;
    const homeTeam = data.homeTeam || "Mandante";
    const awayTeam = data.awayTeam || "Visitante";
    const homeScore = data.homeScore ?? 0;
    const awayScore = data.awayScore ?? 0;

    let emoji = "📢";
    if (payload.event === "SCORE_UPDATE") emoji = "⚽ <b>GOL!</b>";
    if (payload.event === "STATUS_CHANGE") emoji = "⏱️ <b>STATUS:</b>";

    const text = `${emoji}\n<b>${homeTeam} ${homeScore} x ${awayScore} ${awayTeam}</b>\n` +
      (data.scorer ? `Autor: ${data.scorer} (${data.minute}')\n` : "") +
      `\n<i>#BrasaFut #FutebolAoVivo</i>`;

    return JSON.stringify({
      text,
      parse_mode: "HTML",
    });
  }

  private static async sendWebhook(
    hook: typeof webhooks.$inferSelect,
    payload: WebhookEventPayload
  ) {
    const isDiscord = hook.url.includes("discord.com/api/webhooks/");
    const isTelegram = hook.url.includes("api.telegram.org/bot");

    let body: string;
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "BrasaFut-Webhook-Dispatcher/1.0",
    };

    if (isDiscord) {
      body = this.formatDiscordPayload(payload);
    } else if (isTelegram) {
      body = this.formatTelegramPayload(payload);
    } else {
      body = JSON.stringify(payload);
      const signature = createHmac("sha256", hook.secret)
        .update(body)
        .digest("hex");
      headers["X-BrasaFut-Event"] = payload.event;
      headers["X-BrasaFut-Signature"] = `sha256=${signature}`;
    }

    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let success = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(hook.url, {
        method: "POST",
        headers,
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
      eventType: payload.event,
      payload: JSON.parse(body),
      statusCode,
      responseBody: responseBody ? responseBody.slice(0, 1000) : null,
      success,
      attemptCount: 1,
    });
  }
}
