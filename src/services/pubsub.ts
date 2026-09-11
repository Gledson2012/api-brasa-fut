import { EventEmitter } from "node:events";
import type { WebSocket } from "ws";

export interface LiveMatchUpdate {
  type: "SCORE_UPDATE" | "MATCH_EVENT" | "STATUS_CHANGE";
  matchId: number;
  timestamp: string;
  data: Record<string, unknown>;
}

class RealtimeBroker extends EventEmitter {
  private clients: Map<WebSocket, Set<string>> = new Map();

  constructor() {
    super();
    this.on("live_update", (update: LiveMatchUpdate) => {
      this.broadcast(update);
    });
  }

  public registerClient(ws: WebSocket) {
    this.clients.set(ws, new Set(["matches:all"]));

    ws.on("close", () => {
      this.clients.delete(ws);
    });

    ws.on("message", (rawMessage: Buffer) => {
      try {
        const payload = JSON.parse(rawMessage.toString());
        if (payload.action === "subscribe" && payload.channel) {
          const channels = this.clients.get(ws);
          channels?.add(payload.channel);
          ws.send(JSON.stringify({ status: "subscribed", channel: payload.channel }));
        } else if (payload.action === "unsubscribe" && payload.channel) {
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
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const realtimeBroker = new RealtimeBroker();
