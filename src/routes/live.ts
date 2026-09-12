import type { FastifyPluginAsync } from "fastify";
import { realtimeBroker } from "../services/pubsub.js";
import { MatchSimulator } from "../services/matchSimulator.js";
import { requireAdminOrPlan } from "../middleware/auth.js";

export const liveRoutes: FastifyPluginAsync = async (app) => {
  // Conexão WebSocket para receber eventos ao vivo (apenas em servidores persistentes)
  if (!process.env.VERCEL) {
    app.get("/ws", { websocket: true }, (socket, req) => {
      realtimeBroker.registerClient(socket);
    });
  } else {
    app.get("/ws", async (request, reply) => {
      return reply.status(501).send({
        error: "WebSockets não são suportados no ambiente Serverless da Vercel.",
        suggestion: "Utilize polling nos endpoints REST /api/v1/matches/live ou utilize Webhooks.",
      });
    });
  }

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

  // Iniciar simulação automatizada de partida ao vivo (Desativado para manter 100% de dados reais)
  app.post("/simulate/start", async (request, reply) => {
    return reply.status(403).send({
      error: "Simulações desativadas",
      message: "A API opera exclusivamente com partidas e placares 100% REAIS (Sofascore Oficial). Geração de dados fictícios está bloqueada.",
    });
  });

  // Parar simulação de partida (Admin / PRO)
  app.post("/simulate/stop", async (request, reply) => {
    if (!requireAdminOrPlan(request, reply, ["ENTERPRISE", "PRO"])) return;

    const body = (request.body as { matchId?: number }) || {};
    const matchId = body.matchId || 1;

    const result = MatchSimulator.stop(matchId);
    return result;
  });
};
