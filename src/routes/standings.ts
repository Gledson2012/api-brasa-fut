import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { standings, teams } from "../db/schema.js";
import { eq, asc } from "drizzle-orm";
import { cache } from "../services/cache.js";

export const standingsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Obter tabela de classificação da temporada
  app.get(
    "/",
    {
      schema: {
        tags: ["Classificação"],
        summary: "Obter tabela de classificação de uma temporada",
        querystring: z.object({
          seasonId: z.coerce.number(),
        }),
      },
    },
    async (request) => {
      const { seasonId } = request.query;

      return await cache.wrap(`standings:season:${seasonId}`, 30, async () => {
        const table = await db
          .select({
            position: standings.position,
            team: {
              id: teams.id,
              name: teams.name,
              shortName: teams.shortName,
              acronym: teams.acronym,
              logoUrl: teams.logoUrl,
            },
            points: standings.points,
            played: standings.played,
            won: standings.won,
            drawn: standings.drawn,
            lost: standings.lost,
            goalsFor: standings.goalsFor,
            goalsAgainst: standings.goalsAgainst,
            goalDifference: standings.goalDifference,
            form: standings.form,
          })
          .from(standings)
          .innerJoin(teams, eq(standings.teamId, teams.id))
          .where(eq(standings.seasonId, seasonId))
          .orderBy(asc(standings.position));

        return {
          seasonId,
          standings: table,
        };
      });
    }
  );
};
