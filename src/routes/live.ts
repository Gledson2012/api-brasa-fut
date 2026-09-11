import type { FastifyPluginAsync } from "fastify";
import { realtimeBroker } from "../services/pubsub.js";
import { MatchSimulator } from "../services/matchSimulator.js";

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
      simulatedMatchesActive: MatchSimulator.listRunning(),
      instructions: {
        connect: "Conecte via WebSocket em ws://<host>:<port>/api/v1/live/ws",
        subscribe: "Envie JSON: {\"action\": \"subscribe\", \"channel\": \"match:1\"}",
        unsubscribe: "Envie JSON: {\"action\": \"unsubscribe\", \"channel\": \"match:1\"}",
      },
    };
  });

  // Iniciar simulação automatizada de partida ao vivo
  app.post("/simulate/start", async (request, reply) => {
    const body = (request.body as { matchId?: number; speedMs?: number }) || {};
    const matchId = body.matchId || 1;
    const speedMs = body.speedMs || 4000;

    try {
      const result = await MatchSimulator.start(matchId, speedMs);
      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Parar simulação de partida
  app.post("/simulate/stop", async (request, reply) => {
    const body = (request.body as { matchId?: number }) || {};
    const matchId = body.matchId || 1;

    const result = MatchSimulator.stop(matchId);
    return result;
  });
};
