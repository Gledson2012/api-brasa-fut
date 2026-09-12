import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import {
  players,
  teamRosters,
  teams,
  playerSeasonStatistics,
  seasons,
  competitions,
} from "../db/schema.js";
import { eq, ilike, and, or } from "drizzle-orm";
import { cache } from "../services/cache.js";

export const playerRoutes: FastifyPluginAsyncZod = async (app) => {
  // Listar atletas com filtros
  app.get(
    "/",
    {
      schema: {
        tags: ["Atletas"],
        summary: "Listar atletas com paginação e busca",
        querystring: z.object({
          search: z.string().optional(),
          nationality: z.string().optional(),
          position: z
            .enum(["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"])
            .optional(),
          limit: z.coerce.number().min(1).max(100).default(20),
          page: z.coerce.number().min(1).default(1),
        }),
      },
    },
    async (request) => {
      const { search, nationality, position, limit, page } = request.query;
      const offset = (page - 1) * limit;

      let query = db.select().from(players);
      const conditions = [];

      if (search) {
        conditions.push(
          or(
            ilike(players.firstName, `%${search}%`),
            ilike(players.lastName, `%${search}%`),
            ilike(players.knownName, `%${search}%`)
          )
        );
      }
      if (nationality) {
        conditions.push(eq(players.nationality, nationality));
      }
      if (position) {
        conditions.push(eq(players.primaryPosition, position));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const results = await query.limit(limit).offset(offset);
      return {
        page,
        limit,
        data: results,
      };
    }
  );

  // Detalhes do atleta com histórico de clubes
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Atletas"],
        summary: "Obter detalhes do atleta",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [player] = await db.select().from(players).where(eq(players.id, id));

      if (!player) {
        return reply.status(404).send({ error: "Atleta não encontrado" });
      }

      const clubs = await db
        .select({
          teamId: teams.id,
          teamName: teams.name,
          teamShortName: teams.shortName,
          jerseyNumber: teamRosters.jerseyNumber,
          position: teamRosters.position,
          seasonId: teamRosters.seasonId,
        })
        .from(teamRosters)
        .innerJoin(teams, eq(teamRosters.teamId, teams.id))
        .where(eq(teamRosters.playerId, id));

      return {
        ...player,
        clubs,
      };
    }
  );

  // Estatísticas oficiais e scouts do atleta por temporada
  app.get(
    "/:id/statistics",
    {
      schema: {
        tags: ["Atletas"],
        summary: "Estatísticas e scouts detalhados do atleta",
        description: "Retorna o histórico de gols, assistências, rating, finalizações, passes-chave e scouts oficiais.",
        params: z.object({
          id: z.coerce.number(),
        }),
        querystring: z.object({
          seasonId: z.coerce.number().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { seasonId } = request.query;

      const cacheKey = `player:${id}:stats:${seasonId || "all"}`;

      return await cache.wrap(cacheKey, 60, async () => {
        const [player] = await db.select().from(players).where(eq(players.id, id));
        if (!player) {
          return reply.status(404).send({ error: "Atleta não encontrado" });
        }

        const conditions = [eq(playerSeasonStatistics.playerId, id)];
        if (seasonId) {
          conditions.push(eq(playerSeasonStatistics.seasonId, seasonId));
        }

        const stats = await db
          .select({
            id: playerSeasonStatistics.id,
            seasonId: seasons.id,
            seasonName: seasons.name,
            competitionId: competitions.id,
            competitionName: competitions.name,
            competitionCode: competitions.code,
            teamId: teams.id,
            teamName: teams.name,
            teamShortName: teams.shortName,
            teamLogoUrl: teams.logoUrl,
            appearances: playerSeasonStatistics.appearances,
            matchesStarted: playerSeasonStatistics.matchesStarted,
            minutesPlayed: playerSeasonStatistics.minutesPlayed,
            goals: playerSeasonStatistics.goals,
            assists: playerSeasonStatistics.assists,
            rating: playerSeasonStatistics.rating,
            expectedGoals: playerSeasonStatistics.expectedGoals,
            expectedAssists: playerSeasonStatistics.expectedAssists,
            shotsTotal: playerSeasonStatistics.shotsTotal,
            shotsOnTarget: playerSeasonStatistics.shotsOnTarget,
            keyPasses: playerSeasonStatistics.keyPasses,
            yellowCards: playerSeasonStatistics.yellowCards,
            redCards: playerSeasonStatistics.redCards,
          })
          .from(playerSeasonStatistics)
          .innerJoin(seasons, eq(playerSeasonStatistics.seasonId, seasons.id))
          .innerJoin(competitions, eq(seasons.competitionId, competitions.id))
          .innerJoin(teams, eq(playerSeasonStatistics.teamId, teams.id))
          .where(and(...conditions));

        return {
          player: {
            id: player.id,
            name: player.knownName || `${player.firstName} ${player.lastName}`,
            knownName: player.knownName,
            firstName: player.firstName,
            lastName: player.lastName,
            nationality: player.nationality,
            position: player.primaryPosition,
            photoUrl: player.photoUrl,
            heightCm: player.heightCm,
            weightKg: player.weightKg,
          },
          statistics: stats,
        };
      });
    }
  );
};
