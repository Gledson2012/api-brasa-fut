import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { cache } from "../services/cache.js";
import { PowerRankingService } from "../services/power-ranking.js";

export const rankingRoutes: FastifyPluginAsyncZod = async (app) => {
  // Power Ranking Oficial dos Clubes
  app.get(
    "/power-ranking",
    {
      schema: {
        tags: ["Rankings & Índices de Força"],
        summary: "Power Ranking dinâmico dos clubes (Índice Elo, xGD e Momentum)",
        description:
          "Avaliação de força contínua dos clubes calculada através de Rating Elo, forma ponderada dos últimos 5 jogos, saldo de gols esperado por 90 min (xGD) e dificuldade de calendário (Strength of Schedule).",
        querystring: z.object({
          competitionId: z.coerce.number().optional().default(1),
          seasonId: z.coerce.number().optional().default(1),
        }),
      },
    },
    async (request) => {
      const { competitionId, seasonId } = request.query;

      return await cache.wrap(
        `rankings:power-ranking:${competitionId}:${seasonId}`,
        180,
        async () => {
          return PowerRankingService.getPowerRanking(competitionId, seasonId);
        }
      );
    }
  );
};
