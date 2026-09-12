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

  // Disparar teste de Notificação Push FCM para o time (ex: /topics/team_1957)
  app.post("/test-fcm-goal", async (request, reply) => {
    const body = (request.body as {
      teamId?: number;
      teamName?: string;
      opponentName?: string;
      minute?: number;
      scorerName?: string;
      homeScore?: number;
      awayScore?: number;
      matchId?: number;
    }) || {};

    const { FCMService } = await import("../services/fcm.js");

    const result = await FCMService.sendGoalNotification({
      matchId: body.matchId || 1,
      teamId: body.teamId || 1957,
      teamName: body.teamName || "Corinthians",
      opponentName: body.opponentName || "Palmeiras",
      minute: body.minute || 88,
      scorerName: body.scorerName || "Memphis Depay",
      homeScore: body.homeScore ?? 1,
      awayScore: body.awayScore ?? 0,
    });

    return reply.send(result);
  });

  // Disparar mensagem personalizada para qualquer tópico arbitrário
  app.post("/test-fcm-topic", async (request, reply) => {
    const body = (request.body as {
      topic?: string;
      title?: string;
      body?: string;
      data?: Record<string, string>;
    }) || {};

    const { FCMService } = await import("../services/fcm.js");

    const result = await FCMService.sendToTopic(
      body.topic || "team_1957",
      body.title || "⚽ Notificação BrasaFut",
      body.body || "Atualização da partida em tempo real",
      body.data || {}
    );

    return reply.send(result);
  });
};
