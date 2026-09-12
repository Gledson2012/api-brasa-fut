import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { teams, teamRosters, players, venues, seasons, matches, competitions } from "../db/schema.js";
import { eq, ilike, and, or, desc, asc } from "drizzle-orm";
import { cache } from "../services/cache.js";
import { AnalyticsService } from "../services/analytics.js";

export const teamRoutes: FastifyPluginAsyncZod = async (app) => {
  // Listar times com filtros
  app.get(
    "/",
    {
      schema: {
        tags: ["Clubes"],
        summary: "Listar todos os clubes",
        querystring: z.object({
          search: z.string().optional(),
          country: z.string().optional(),
          limit: z.coerce.number().min(1).max(100).default(50),
          page: z.coerce.number().min(1).default(1),
        }),
      },
    },
    async (request) => {
      const { search, country, limit, page } = request.query;
      const offset = (page - 1) * limit;

      let query = db
        .select({
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          acronym: teams.acronym,
          foundedYear: teams.foundedYear,
          country: teams.country,
          logoUrl: teams.logoUrl,
          venue: {
            id: venues.id,
            name: venues.name,
            city: venues.city,
            capacity: venues.capacity,
          },
        })
        .from(teams)
        .leftJoin(venues, eq(teams.venueId, venues.id));

      const conditions = [];

      if (search) {
        conditions.push(
          or(
            ilike(teams.name, `%${search}%`),
            ilike(teams.shortName, `%${search}%`),
            eq(teams.acronym, search.toUpperCase())
          )
        );
      }
      if (country) {
        conditions.push(eq(teams.country, country));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      return await query.limit(limit).offset(offset);
    }
  );

  // Detalhes do time
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Clubes"],
        summary: "Obter detalhes de um clube",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [team] = await db
        .select({
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          acronym: teams.acronym,
          foundedYear: teams.foundedYear,
          country: teams.country,
          logoUrl: teams.logoUrl,
          venue: {
            id: venues.id,
            name: venues.name,
            city: venues.city,
            capacity: venues.capacity,
            surface: venues.surface,
          },
        })
        .from(teams)
        .leftJoin(venues, eq(teams.venueId, venues.id))
        .where(eq(teams.id, id));

      if (!team) {
        return reply.status(404).send({ error: "Clube não encontrado" });
      }

      return team;
    }
  );

  // Elenco do time por temporada
  app.get(
    "/:id/roster",
    {
      schema: {
        tags: ["Clubes"],
        summary: "Obter elenco do time",
        params: z.object({
          id: z.coerce.number(),
        }),
        querystring: z.object({
          seasonId: z.coerce.number().optional(),
        }),
      },
    },
    async (request) => {
      const { id } = request.params;
      const { seasonId } = request.query;

      let whereClause = eq(teamRosters.teamId, id);
      if (seasonId) {
        whereClause = and(whereClause, eq(teamRosters.seasonId, seasonId))!;
      }

      const roster = await db
        .select({
          rosterId: teamRosters.id,
          jerseyNumber: teamRosters.jerseyNumber,
          position: teamRosters.position,
          seasonId: teamRosters.seasonId,
          player: {
            id: players.id,
            firstName: players.firstName,
            lastName: players.lastName,
            knownName: players.knownName,
            birthDate: players.birthDate,
            nationality: players.nationality,
            primaryPosition: players.primaryPosition,
            heightCm: players.heightCm,
            weightKg: players.weightKg,
            photoUrl: players.photoUrl,
          },
        })
        .from(teamRosters)
        .innerJoin(players, eq(teamRosters.playerId, players.id))
        .where(whereClause);

      return roster;
    }
  );

  // Calendário, próximos jogos e forma recente do clube
  app.get(
    "/:id/fixtures",
    {
      schema: {
        tags: ["Clubes"],
        summary: "Calendário do clube (Próximos jogos, últimos resultados e forma recente)",
        description:
          "Retorna os próximos jogos agendados, últimos resultados consolidados e a sequência de forma recente (Vitórias, Empates e Derrotas: W, D, L) do clube.",
        params: z.object({
          id: z.coerce.number(),
        }),
        querystring: z.object({
          limit: z.coerce.number().min(1).max(20).default(5),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { limit } = request.query;

      const cacheKey = `team:${id}:fixtures:${limit}`;

      return await cache.wrap(cacheKey, 60, async () => {
        const [team] = await db
          .select({
            id: teams.id,
            name: teams.name,
            shortName: teams.shortName,
            acronym: teams.acronym,
            logoUrl: teams.logoUrl,
            country: teams.country,
          })
          .from(teams)
          .where(eq(teams.id, id));

        if (!team) {
          return reply.status(404).send({ error: "Clube não encontrado" });
        }

        // Buscar últimos jogos finalizados
        const past = await db
          .select({
            id: matches.id,
            round: matches.round,
            kickoffTime: matches.kickoffTime,
            status: matches.status,
            homeTeamId: matches.homeTeamId,
            awayTeamId: matches.awayTeamId,
            homeScore: matches.homeScore,
            awayScore: matches.awayScore,
            competitionName: competitions.name,
            competitionCode: competitions.code,
          })
          .from(matches)
          .innerJoin(seasons, eq(matches.seasonId, seasons.id))
          .innerJoin(competitions, eq(seasons.competitionId, competitions.id))
          .where(
            and(
              eq(matches.status, "FINISHED"),
              or(eq(matches.homeTeamId, id), eq(matches.awayTeamId, id))
            )
          )
          .orderBy(desc(matches.kickoffTime))
          .limit(limit);

        // Buscar próximos jogos agendados
        const upcoming = await db
          .select({
            id: matches.id,
            round: matches.round,
            kickoffTime: matches.kickoffTime,
            status: matches.status,
            homeTeamId: matches.homeTeamId,
            awayTeamId: matches.awayTeamId,
            homeScore: matches.homeScore,
            awayScore: matches.awayScore,
            competitionName: competitions.name,
            competitionCode: competitions.code,
          })
          .from(matches)
          .innerJoin(seasons, eq(matches.seasonId, seasons.id))
          .innerJoin(competitions, eq(seasons.competitionId, competitions.id))
          .where(
            and(
              or(eq(matches.status, "SCHEDULED"), eq(matches.status, "POSTPONED")),
              or(eq(matches.homeTeamId, id), eq(matches.awayTeamId, id))
            )
          )
          .orderBy(asc(matches.kickoffTime))
          .limit(limit);

        // Buscar detalhes dos times adversários
        const opponentIds = Array.from(
          new Set(
            [...past, ...upcoming].map((m) =>
              m.homeTeamId === id ? m.awayTeamId : m.homeTeamId
            )
          )
        );

        const oppTeamsMap = new Map<number, any>();
        if (opponentIds.length > 0) {
          const oppTeams = await db
            .select({
              id: teams.id,
              name: teams.name,
              shortName: teams.shortName,
              logoUrl: teams.logoUrl,
            })
            .from(teams);
          for (const t of oppTeams) {
            oppTeamsMap.set(t.id, t);
          }
        }

        // Calcular a forma recente (W, D, L)
        const form: Array<"W" | "D" | "L"> = past.map((m) => {
          const isHome = m.homeTeamId === id;
          const ourScore = isHome ? m.homeScore ?? 0 : m.awayScore ?? 0;
          const theirScore = isHome ? m.awayScore ?? 0 : m.homeScore ?? 0;
          if (ourScore > theirScore) return "W";
          if (ourScore < theirScore) return "L";
          return "D";
        });

        const formatMatch = (m: any) => {
          const isHome = m.homeTeamId === id;
          const oppId = isHome ? m.awayTeamId : m.homeTeamId;
          const opp = oppTeamsMap.get(oppId);
          return {
            id: m.id,
            round: m.round,
            kickoffTime: m.kickoffTime,
            status: m.status,
            isHome,
            score: {
              home: m.homeScore,
              away: m.awayScore,
            },
            competition: {
              name: m.competitionName,
              code: m.competitionCode,
            },
            opponent: opp || { id: oppId, name: "Adversário", shortName: null, logoUrl: null },
          };
        };

        return {
          team,
          form, // Ex: ["W", "W", "D", "L", "W"]
          pastMatches: past.map(formatMatch),
          nextMatches: upcoming.map(formatMatch),
        };
      });
    }
  );

  // Departamento Médico e Desfalques do Clube
  app.get(
    "/:id/absences",
    {
      schema: {
        tags: ["Clubes"],
        summary: "Desfalques e Departamento Médico do Clube (Lesões e Suspensões)",
        description:
          "Retorna a lista atualizada de atletas desfalques do clube por motivo médico (lesões, cirurgias, transição física) ou disciplinares (suspensões automáticas ou julgamentos).",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const cached = await cache.wrap(`team:${id}:absences`, 180, async () => {
        return await AnalyticsService.getTeamAbsences(id);
      });

      if (!cached) {
        return reply.status(404).send({ error: "Clube não encontrado." });
      }

      return cached;
    }
  );
};

