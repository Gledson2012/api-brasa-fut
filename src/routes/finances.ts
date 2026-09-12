import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { teams, standings } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { cache } from "../services/cache.js";
import { FinancesService } from "../services/finances.js";

export const financeRoutes: FastifyPluginAsyncZod = async (app) => {
  // Finanças e folha salarial de um clube
  app.get(
    "/teams/:teamId",
    {
      schema: {
        tags: ["Finanças & Fair Play Financeiro"],
        summary: "Perfil financeiro, folha salarial e conformidade com o Fair Play",
        description: "Retorna a estimativa de folha salarial mensal do clube, orçamento anual, teto salarial, custo por ponto conquistado e status perante o Fair Play Financeiro da CBF.",
        params: z.object({
          teamId: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { teamId } = request.params;

      return await cache.wrap(`finances:team:${teamId}`, 300, async () => {
        let team = await db.query.teams.findFirst({
          where: eq(teams.id, teamId),
        });

        if (!team) {
          team = await db.query.teams.findFirst();
        }

        if (!team) {
          return reply.status(404).send({ error: "Clube não encontrado." });
        }

        // Buscar pontos na tabela se disponível
        const std = await db.query.standings.findFirst({
          where: eq(standings.teamId, team.id),
        });

        return FinancesService.getTeamFinances(team, std?.points || 45);
      });
    }
  );

  // Ranking geral de folhas salariais e eficiência de custo por ponto
  app.get(
    "/ranking",
    {
      schema: {
        tags: ["Finanças & Fair Play Financeiro"],
        summary: "Ranking de folhas salariais e custo-benefício por ponto",
        description: "Compara todos os clubes por folha salarial total e por eficiência financeira (menor investimento em folha por ponto ganho).",
        querystring: z.object({
          seasonId: z.coerce.number().optional().default(1),
        }),
      },
    },
    async (request) => {
      const { seasonId } = request.query;

      return await cache.wrap(`finances:ranking:${seasonId}`, 300, async () => {
        const allTeams = await db.select().from(teams).limit(20);
        const allStandings = await db.select().from(standings).where(eq(standings.seasonId, seasonId));
        const ptsMap = new Map(allStandings.map((s) => [s.teamId, s.points]));

        const payload = allTeams.map((t) => ({
          id: t.id,
          name: t.name,
          shortName: t.shortName,
          points: ptsMap.get(t.id) || 40,
        }));

        const result = FinancesService.getFinancesRanking(payload);

        return {
          seasonId,
          currency: "BRL (R$)",
          totalClubsAnalyzed: payload.length,
          ...result,
        };
      });
    }
  );
};
