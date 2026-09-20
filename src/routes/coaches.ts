import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { CoachesService } from "../services/coaches.js";

export const coachesRoutes: FastifyPluginAsyncZod = async (app) => {
  // 1. Listar treinadores com filtros
  app.get(
    "/",
    {
      schema: {
        tags: ["Treinadores & Comissões Técnicas"],
        summary: "Listar técnicos de futebol com filtros por clube, nacionalidade e status",
        description:
          "Retorna o catálogo completo de treinadores com dados táticos, formação predileta, estatísticas de aproveitamento e clube atual.",
        querystring: z.object({
          search: z.string().optional(),
          nationality: z.string().optional(),
          status: z.enum(["ACTIVE", "AVAILABLE"]).optional(),
        }),
      },
    },
    async (request) => {
      const { search, nationality, status } = request.query;
      const data = CoachesService.listCoaches({ search, nationality, status });
      return {
        total: data.length,
        data,
      };
    }
  );

  // 2. Ranking de técnicos
  app.get(
    "/ranking",
    {
      schema: {
        tags: ["Treinadores & Comissões Técnicas"],
        summary: "Ranking dos melhores técnicos por aproveitamento, títulos ou pontos por jogo",
        description:
          "Compara os melhores comandantes do futebol brasileiro e internacional de acordo com seu percentual de vitórias (winRate), quantidade de troféus ou média de pontos (PPM).",
        querystring: z.object({
          sortBy: z.enum(["winRate", "trophies", "pointsPerMatch"]).default("winRate"),
        }),
      },
    },
    async (request) => {
      const { sortBy } = request.query;
      const ranking = CoachesService.getCoachRanking(sortBy);
      return {
        sortBy,
        total: ranking.length,
        ranking,
      };
    }
  );

  // 3. Obter perfil completo de um treinador
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Treinadores & Comissões Técnicas"],
        summary: "Perfil completo de um técnico por ID",
        description:
          "Apresenta histórico de carreira, DNA tático, cartões amarelos e vermelhos na carreira, aproveitamento em clássicos e títulos conquistados.",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const coach = CoachesService.getCoachById(id);
      if (!coach) {
        return reply.status(404).send({ error: `Técnico com ID ${id} não encontrado.` });
      }
      return coach;
    }
  );

  // 4. Carreira detalhada do treinador
  app.get(
    "/:id/career",
    {
      schema: {
        tags: ["Treinadores & Comissões Técnicas"],
        summary: "Linha do tempo da carreira e passagens por clubes de um treinador",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const coach = CoachesService.getCoachById(id);
      if (!coach) {
        return reply.status(404).send({ error: `Técnico com ID ${id} não encontrado.` });
      }

      return {
        coachId: coach.id,
        coachName: coach.name,
        totalClubsManaged: coach.careerHistory.length,
        totalTrophies: coach.trophiesCount,
        careerHistory: coach.careerHistory,
      };
    }
  );
};
