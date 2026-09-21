import { EventEmitter } from "node:events";
import type { WebSocket } from "ws";
import { WebhookDispatcher } from "./webhookDispatcher.js";
import { isRedisConfigured, redisPublish } from "./redis.js";

export interface LiveMatchUpdate {
  type: "SCORE_UPDATE" | "MATCH_EVENT" | "STATUS_CHANGE";
  matchId: number;
  timestamp: string;
  data: Record<string, unknown>;
}

const FANOUT_CHANNEL = "brasafut:live_updates";

class RealtimeBroker extends EventEmitter {
  private clients: Map<WebSocket, Set<string>> = new Map();

  constructor() {
    super();
    this.on("live_update", (update: LiveMatchUpdate) => {
      this.broadcast(update);
    });

    if (isRedisConfigured() && !process.env.VERCEL) {
      console.log("✅ [realtime] Fanout Redis ativo para multi-instância.");
    } else if (!isRedisConfigured()) {
      console.warn(
        "⚠️ [realtime] Broker em memória (single-instance). " +
          "Webhooks continuam cross-instance; WS não escala sem UPSTASH_REDIS_REST_*."
      );
    }
  }

  public registerClient(ws: WebSocket) {
    this.clients.set(ws, new Set(["matches:all"]));

    ws.on("close", () => {
      this.clients.delete(ws);
    });

    ws.on("message", (rawMessage: Buffer) => {
      try {
        const payload = JSON.parse(rawMessage.toString());
        if (payload.action === "subscribe" && typeof payload.channel === "string") {
          const channel = payload.channel.slice(0, 64);
          // Aceita apenas canais conhecidos para evitar enumeração/absorção de memória
          if (channel === "matches:all" || /^match:\d+$/.test(channel)) {
            const channels = this.clients.get(ws);
            channels?.add(channel);
            ws.send(JSON.stringify({ status: "subscribed", channel }));
          } else {
            ws.send(JSON.stringify({ status: "error", message: "Canal inválido." }));
          }
        } else if (payload.action === "unsubscribe" && typeof payload.channel === "string") {
          const channels = this.clients.get(ws);
          channels?.delete(payload.channel);
          ws.send(JSON.stringify({ status: "unsubscribed", channel: payload.channel }));
        }
      } catch {
        // ignore malformed payloads
      }
    });

    // Send connection greeting
    ws.send(
      JSON.stringify({
        event: "CONNECTED",
        message: "Conectado ao canal de dados em tempo real da BrasaFut API",
        channels: ["matches:all"],
      })
    );
  }

  public broadcast(update: LiveMatchUpdate) {
    const serialized = JSON.stringify(update);
    const matchChannel = `match:${update.matchId}`;

    for (const [client, channels] of this.clients.entries()) {
      if (
        client.readyState === client.OPEN &&
        (channels.has("matches:all") || channels.has(matchChannel))
      ) {
        client.send(serialized);
      }
    }
  }

  public publishMatchUpdate(update: LiveMatchUpdate) {
    this.emit("live_update", update);

    // Fanout best-effort para outras instâncias (consumidores externos via Redis SUBSCRIBE).
    // Webhooks abaixo são o canal cross-instance garantido.
    if (isRedisConfigured()) {
      redisPublish(FANOUT_CHANNEL, JSON.stringify(update)).catch(() => {});
    }

    WebhookDispatcher.dispatch({
      event: update.type,
      matchId: update.matchId,
      timestamp: update.timestamp,
      data: update.data,
    });
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const realtimeBroker = new RealtimeBroker();
