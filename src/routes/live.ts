import type { FastifyPluginAsync } from "fastify";
import { realtimeBroker } from "../services/pubsub.js";

export const liveRoutes: FastifyPluginAsync = async (app) => {
  // Conexão WebSocket para receber eventos ao vivo
  app.get("/ws", { websocket: true }, (socket, req) => {
    realtimeBroker.registerClient(socket);
  });

  // Métricas do canal em tempo real (HTTP)
  app.get("/status", async () => {
    return {
      connectedClients: realtimeBroker.getConnectedClientsCount(),
      channelsAvailable: ["matches:all", "match:<id>"],
      instructions: {
        connect: "Conecte via WebSocket em ws://<host>:<port>/api/v1/live/ws",
        subscribe: "Envie JSON: {\"action\": \"subscribe\", \"channel\": \"match:1\"}",
        unsubscribe: "Envie JSON: {\"action\": \"unsubscribe\", \"channel\": \"match:1\"}",
      },
    };
  });
};
