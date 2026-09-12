import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { competitions, seasons, playerSeasonStatistics, players, teams } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { cache } from "../services/cache.js";

export const competitionRoutes: FastifyPluginAsyncZod = async (app) => {
  // Listar todas as competições
  app.get(
    "/",
    {
      schema: {
        tags: ["Competições"],
        summary: "Listar todas as competições",
        description: "Retorna todas as ligas e copas cadastradas no sistema.",
        response: {
          200: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              code: z.string().nullable(),
              country: z.string().nullable(),
              type: z.enum(["LEAGUE", "CUP", "INTERNATIONAL"]),
              logoUrl: z.string().nullable(),
              createdAt: z.date().nullable(),
            })
          ),
        },
      },
    },
    async () => {
      return await cache.wrap("competitions:list", 300, async () => {
        return await db.select().from(competitions);
      });
    }
  );

  // Detalhes de uma competição
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Competições"],
        summary: "Obter detalhes de uma competição",
        params: z.object({
          id: z.coerce.number(),
        }),
        response: {
          200: z.object({
            id: z.number(),
            name: z.string(),
            code: z.string().nullable(),
            country: z.string().nullable(),
            type: z.enum(["LEAGUE", "CUP", "INTERNATIONAL"]),
            logoUrl: z.string().nullable(),
            createdAt: z.date().nullable(),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const cached = await cache.wrap(`competition:${id}`, 300, async () => {
        const [found] = await db
          .select()
          .from(competitions)
          .where(eq(competitions.id, id));
        return found || null;
      });

      if (!cached) {
        return reply.status(404).send({ error: "Competição não encontrada" });
      }

      return cached;
    }
  );

  // Temporadas de uma competição
  app.get(
    "/:id/seasons",
    {
      schema: {
        tags: ["Competições"],
        summary: "Listar temporadas de uma competição",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request) => {
      const { id } = request.params;
      return await cache.wrap(`competition:${id}:seasons`, 300, async () => {
        return await db
          .select()
          .from(seasons)
          .where(eq(seasons.competitionId, id));
      });
    }
  );

  // Artilharia oficial da competição
  app.get(
    "/:id/top-scorers",
    {
      schema: {
        tags: ["Competições"],
        summary: "Artilharia oficial da competição",
        description: "Retorna a tabela dos principais artilheiros com gols, assistências, scouts e dados do clube.",
        params: z.object({
          id: z.coerce.number(),
        }),
        querystring: z.object({
          seasonId: z.coerce.number().optional(),
          limit: z.coerce.number().min(1).max(100).default(20),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { seasonId, limit } = request.query;

      const cacheKey = `top-scorers:${id}:${seasonId || "current"}:${limit}`;

      return await cache.wrap(cacheKey, 60, async () => {
        // Encontrar temporada
        let season;
        if (seasonId) {
          [season] = await db
            .select()
            .from(seasons)
            .where(and(eq(seasons.competitionId, id), eq(seasons.id, seasonId)));
        } else {
          [season] = await db
            .select()
            .from(seasons)
            .where(and(eq(seasons.competitionId, id), eq(seasons.isCurrent, true)));
        }

        if (!season) {
          return { competitionId: id, season: null, topScorers: [] };
        }

        const stats = await db
          .select({
            id: playerSeasonStatistics.id,
            playerId: players.id,
            playerName: players.knownName,
            playerFirstName: players.firstName,
            playerLastName: players.lastName,
            nationality: players.nationality,
            position: players.primaryPosition,
            photoUrl: players.photoUrl,
            teamId: teams.id,
            teamName: teams.name,
            teamShortName: teams.shortName,
            teamLogoUrl: teams.logoUrl,
            goals: playerSeasonStatistics.goals,
            assists: playerSeasonStatistics.assists,
            appearances: playerSeasonStatistics.appearances,
            matchesStarted: playerSeasonStatistics.matchesStarted,
            minutesPlayed: playerSeasonStatistics.minutesPlayed,
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
          .innerJoin(players, eq(playerSeasonStatistics.playerId, players.id))
          .innerJoin(teams, eq(playerSeasonStatistics.teamId, teams.id))
          .where(eq(playerSeasonStatistics.seasonId, season.id))
          .orderBy(
            desc(playerSeasonStatistics.goals),
            desc(playerSeasonStatistics.assists),
            desc(playerSeasonStatistics.rating)
          )
          .limit(limit);

        return {
          competitionId: id,
          season: {
            id: season.id,
            name: season.name,
            isCurrent: season.isCurrent,
          },
          total: stats.length,
          topScorers: stats.map((s, idx) => ({
            rank: idx + 1,
            player: {
              id: s.playerId,
              name: s.playerName || `${s.playerFirstName} ${s.playerLastName}`,
              position: s.position,
              nationality: s.nationality,
              photoUrl: s.photoUrl,
            },
            team: {
              id: s.teamId,
              name: s.teamName,
              shortName: s.teamShortName,
              logoUrl: s.teamLogoUrl,
            },
            goals: s.goals,
            assists: s.assists,
            appearances: s.appearances,
            rating: s.rating,
            expectedGoals: s.expectedGoals,
            expectedAssists: s.expectedAssists,
            shotsTotal: s.shotsTotal,
            shotsOnTarget: s.shotsOnTarget,
            keyPasses: s.keyPasses,
            yellowCards: s.yellowCards,
            redCards: s.redCards,
          })),
        };
      });
    }
  );

  // Líderes de assistências
  app.get(
    "/:id/top-assists",
    {
      schema: {
        tags: ["Competições"],
        summary: "Líderes de assistências da competição",
        description: "Retorna a lista dos maiores garçons da competição.",
        params: z.object({
          id: z.coerce.number(),
        }),
        querystring: z.object({
          seasonId: z.coerce.number().optional(),
          limit: z.coerce.number().min(1).max(100).default(20),
        }),
      },
    },
    async (request) => {
      const { id } = request.params;
      const { seasonId, limit } = request.query;

      const cacheKey = `top-assists:${id}:${seasonId || "current"}:${limit}`;

      return await cache.wrap(cacheKey, 60, async () => {
        let season;
        if (seasonId) {
          [season] = await db
            .select()
            .from(seasons)
            .where(and(eq(seasons.competitionId, id), eq(seasons.id, seasonId)));
        } else {
          [season] = await db
            .select()
            .from(seasons)
            .where(and(eq(seasons.competitionId, id), eq(seasons.isCurrent, true)));
        }

        if (!season) {
          return { competitionId: id, season: null, topAssists: [] };
        }

        const stats = await db
          .select({
            id: playerSeasonStatistics.id,
            playerId: players.id,
            playerName: players.knownName,
            playerFirstName: players.firstName,
            playerLastName: players.lastName,
            nationality: players.nationality,
            position: players.primaryPosition,
            photoUrl: players.photoUrl,
            teamId: teams.id,
            teamName: teams.name,
            teamShortName: teams.shortName,
            teamLogoUrl: teams.logoUrl,
            goals: playerSeasonStatistics.goals,
            assists: playerSeasonStatistics.assists,
            appearances: playerSeasonStatistics.appearances,
            rating: playerSeasonStatistics.rating,
            expectedAssists: playerSeasonStatistics.expectedAssists,
            keyPasses: playerSeasonStatistics.keyPasses,
          })
          .from(playerSeasonStatistics)
          .innerJoin(players, eq(playerSeasonStatistics.playerId, players.id))
          .innerJoin(teams, eq(playerSeasonStatistics.teamId, teams.id))
          .where(eq(playerSeasonStatistics.seasonId, season.id))
          .orderBy(
            desc(playerSeasonStatistics.assists),
            desc(playerSeasonStatistics.goals),
            desc(playerSeasonStatistics.rating)
          )
          .limit(limit);

        return {
          competitionId: id,
          season: {
            id: season.id,
            name: season.name,
            isCurrent: season.isCurrent,
          },
          total: stats.length,
          topAssists: stats.map((s, idx) => ({
            rank: idx + 1,
            player: {
              id: s.playerId,
              name: s.playerName || `${s.playerFirstName} ${s.playerLastName}`,
              position: s.position,
              nationality: s.nationality,
              photoUrl: s.photoUrl,
            },
            team: {
              id: s.teamId,
              name: s.teamName,
              shortName: s.teamShortName,
              logoUrl: s.teamLogoUrl,
            },
            assists: s.assists,
            goals: s.goals,
            appearances: s.appearances,
            rating: s.rating,
            expectedAssists: s.expectedAssists,
            keyPasses: s.keyPasses,
          })),
        };
      });
    }
  );
};
