import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { AwardsService } from "../services/awards.js";

export const awardsRoutes: FastifyPluginAsyncZod = async (app) => {
  // 1. Corrida pelas Premiações Individuais da Temporada
  app.get(
    "/season",
    {
      schema: {
        tags: ["Premiações & Hall da Fama"],
        summary: "Premiações oficiais e corrida pelo Craque do Campeonato",
        description:
          "Retorna o ranking de votos e pontuação para a Bola de Ouro / Craque da Temporada, Revelação do Campeonato (Golden Boy), Luva de Ouro (Melhor Goleiro), Melhor Técnico e a Seleção Ideal do Campeonato.",
        querystring: z.object({
          competitionId: z.coerce.number().default(1),
        }),
      },
    },
    async (request) => {
      const { competitionId } = request.query;
      return AwardsService.getSeasonAwards(competitionId);
    }
  );
};
