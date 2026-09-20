import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { PenaltiesService } from "../services/penalties.js";
import { db } from "../db/index.js";
import { matches, teams } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const penaltiesRoutes: FastifyPluginAsyncZod = async (app) => {
  // 1. Ranking de cobradores de pênalti
  app.get(
    "/takers",
    {
      schema: {
        tags: ["Pênaltis & Especialistas"],
        summary: "Ranking dos melhores cobradores de pênalti",
        description:
          "Lista batedores com maior taxa de conversão (%), aproveitamento sob pressão e zonas prediletas de finalização nas cobranças.",
        querystring: z.object({
          limit: z.coerce.number().min(1).max(50).default(10),
        }),
      },
    },
    async (request) => {
      const { limit } = request.query;
      const data = PenaltiesService.getTopTakersRanking(limit);
      return {
        total: data.length,
        ranking: data,
      };
    }
  );

  // 2. Ranking de goleiros pegadores de pênalti
  app.get(
    "/goalkeepers",
    {
      schema: {
        tags: ["Pênaltis & Especialistas"],
        summary: "Ranking de goleiros pegadores de pênalti",
        description:
          "Goleiros com maior percentual de defesas em penalidades máximas e histórico de decisões por pênaltis vencidas na carreira.",
        querystring: z.object({
          limit: z.coerce.number().min(1).max(50).default(10),
        }),
      },
    },
    async (request) => {
      const { limit } = request.query;
      const data = PenaltiesService.getTopGoalkeepersRanking(limit);
      return {
        total: data.length,
        ranking: data,
      };
    }
  );

  // 3. Disputa de pênaltis de uma partida
  app.get(
    "/matches/:id/shootout",
    {
      schema: {
        tags: ["Pênaltis & Especialistas"],
        summary: "Auditoria e cobranças de disputa de pênaltis pós-jogo",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request) => {
      const { id } = request.params;
      const [match] = await db
        .select({
          id: matches.id,
          homeTeamId: matches.homeTeamId,
          awayTeamId: matches.awayTeamId,
        })
        .from(matches)
        .where(eq(matches.id, id))
        .limit(1);

      let hName = "Mandante";
      let aName = "Visitante";

      if (match) {
        const [home] = await db.select({ name: teams.shortName }).from(teams).where(eq(teams.id, match.homeTeamId)).limit(1);
        const [away] = await db.select({ name: teams.shortName }).from(teams).where(eq(teams.id, match.awayTeamId)).limit(1);
        if (home?.name) hName = home.name;
        if (away?.name) aName = away.name;
      }

      return PenaltiesService.getMatchPenaltyShootout(id, hName, aName);
    }
  );
};
