import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import {
  matches,
  teams,
  venues,
  seasons,
  competitions,
  matchEvents,
  matchStatistics,
  players,
} from "../db/schema.js";
import { eq, and, or, inArray, sql, desc, asc } from "drizzle-orm";
import { realtimeBroker } from "../services/pubsub.js";

const LIVE_STATUSES = [
  "FIRST_HALF",
  "HALF_TIME",
  "SECOND_HALF",
  "EXTRA_TIME",
  "PENALTIES",
] as const;

export const matchRoutes: FastifyPluginAsyncZod = async (app) => {
  // Listar partidas com múltiplos filtros
  app.get(
    "/",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Listar partidas (jogos do dia, rodada ou ao vivo)",
        querystring: z.object({
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato deve ser YYYY-MM-DD")
            .optional(),
          status: z
            .enum([
              "SCHEDULED",
              "FIRST_HALF",
              "HALF_TIME",
              "SECOND_HALF",
              "EXTRA_TIME",
              "PENALTIES",
              "FINISHED",
              "POSTPONED",
              "CANCELLED",
            ])
            .optional(),
          live: z.coerce.boolean().optional(),
          seasonId: z.coerce.number().optional(),
          teamId: z.coerce.number().optional(),
          round: z.string().optional(),
        }),
      },
    },
    async (request) => {
      const { date, status, live, seasonId, teamId, round } = request.query;

      const homeTeam = db
        .select({
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          acronym: teams.acronym,
          logoUrl: teams.logoUrl,
        })
        .from(teams)
        .as("home_team");

      const awayTeam = db
        .select({
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          acronym: teams.acronym,
          logoUrl: teams.logoUrl,
        })
        .from(teams)
        .as("away_team");

      let query = db
        .select({
          id: matches.id,
          round: matches.round,
          kickoffTime: matches.kickoffTime,
          status: matches.status,
          homeScore: matches.homeScore,
          awayScore: matches.awayScore,
          homeScoreHt: matches.homeScoreHt,
          awayScoreHt: matches.awayScoreHt,
          homeScoreEt: matches.homeScoreEt,
          awayScoreEt: matches.awayScoreEt,
          homeScorePenalties: matches.homeScorePenalties,
          awayScorePenalties: matches.awayScorePenalties,
          venue: {
            id: venues.id,
            name: venues.name,
            city: venues.city,
          },
          homeTeam: {
            id: homeTeam.id,
            name: homeTeam.name,
            shortName: homeTeam.shortName,
            acronym: homeTeam.acronym,
            logoUrl: homeTeam.logoUrl,
          },
          awayTeam: {
            id: awayTeam.id,
            name: awayTeam.name,
            shortName: awayTeam.shortName,
            acronym: awayTeam.acronym,
            logoUrl: awayTeam.logoUrl,
          },
        })
        .from(matches)
        .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
        .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
        .leftJoin(venues, eq(matches.venueId, venues.id));

      const conditions = [];

      if (date) {
        conditions.push(
          sql`DATE(${matches.kickoffTime} AT TIME ZONE 'UTC') = ${date}::date`
        );
      }
      if (live) {
        conditions.push(inArray(matches.status, [...LIVE_STATUSES]));
      } else if (status) {
        conditions.push(eq(matches.status, status));
      }
      if (seasonId) {
        conditions.push(eq(matches.seasonId, seasonId));
      }
      if (teamId) {
        conditions.push(
          or(eq(matches.homeTeamId, teamId), eq(matches.awayTeamId, teamId))
        );
      }
      if (round) {
        conditions.push(eq(matches.round, round));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      return await query.orderBy(asc(matches.kickoffTime));
    }
  );

  // Atalho para partidas ao vivo
  app.get(
    "/live",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Partidas acontecendo em tempo real",
      },
    },
    async () => {
      const homeTeam = db
        .select({
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          acronym: teams.acronym,
          logoUrl: teams.logoUrl,
        })
        .from(teams)
        .as("home_team");

      const awayTeam = db
        .select({
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          acronym: teams.acronym,
          logoUrl: teams.logoUrl,
        })
        .from(teams)
        .as("away_team");

      return await db
        .select({
          id: matches.id,
          round: matches.round,
          kickoffTime: matches.kickoffTime,
          status: matches.status,
          homeScore: matches.homeScore,
          awayScore: matches.awayScore,
          homeTeam: {
            id: homeTeam.id,
            name: homeTeam.name,
            shortName: homeTeam.shortName,
            acronym: homeTeam.acronym,
            logoUrl: homeTeam.logoUrl,
          },
          awayTeam: {
            id: awayTeam.id,
            name: awayTeam.name,
            shortName: awayTeam.shortName,
            acronym: awayTeam.acronym,
            logoUrl: awayTeam.logoUrl,
          },
          venue: {
            id: venues.id,
            name: venues.name,
            city: venues.city,
          },
        })
        .from(matches)
        .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
        .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
        .leftJoin(venues, eq(matches.venueId, venues.id))
        .where(inArray(matches.status, [...LIVE_STATUSES]));
    }
  );

  // Detalhes completos da partida
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Detalhes de uma partida",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const [match] = await db
        .select({
          id: matches.id,
          round: matches.round,
          kickoffTime: matches.kickoffTime,
          status: matches.status,
          homeScore: matches.homeScore,
          awayScore: matches.awayScore,
          homeScoreHt: matches.homeScoreHt,
          awayScoreHt: matches.awayScoreHt,
          homeScoreEt: matches.homeScoreEt,
          awayScoreEt: matches.awayScoreEt,
          homeScorePenalties: matches.homeScorePenalties,
          awayScorePenalties: matches.awayScorePenalties,
          seasonId: matches.seasonId,
          homeTeamId: matches.homeTeamId,
          awayTeamId: matches.awayTeamId,
          venueId: matches.venueId,
        })
        .from(matches)
        .where(eq(matches.id, id));

      if (!match) {
        return reply.status(404).send({ error: "Partida não encontrada" });
      }

      const [homeTeam] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, match.homeTeamId));
      const [awayTeam] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, match.awayTeamId));
      const [venue] = match.venueId
        ? await db.select().from(venues).where(eq(venues.id, match.venueId))
        : [null];

      return {
        ...match,
        homeTeam,
        awayTeam,
        venue,
      };
    }
  );

  // Linha do tempo de eventos do jogo (Gols, Cartões, Substituições)
  app.get(
    "/:id/events",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Eventos e linha do tempo de uma partida",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request) => {
      const { id } = request.params;

      const playerMain = db
        .select({
          id: players.id,
          knownName: players.knownName,
          firstName: players.firstName,
          lastName: players.lastName,
        })
        .from(players)
        .as("p_main");

      const playerRelated = db
        .select({
          id: players.id,
          knownName: players.knownName,
          firstName: players.firstName,
          lastName: players.lastName,
        })
        .from(players)
        .as("p_related");

      return await db
        .select({
          id: matchEvents.id,
          minute: matchEvents.minute,
          extraMinute: matchEvents.extraMinute,
          type: matchEvents.type,
          description: matchEvents.description,
          teamId: matchEvents.teamId,
          player: {
            id: playerMain.id,
            name: sql<string>`COALESCE(${playerMain.knownName}, CONCAT(${playerMain.firstName}, ' ', ${playerMain.lastName}))`,
          },
          relatedPlayer: {
            id: playerRelated.id,
            name: sql<string>`COALESCE(${playerRelated.knownName}, CONCAT(${playerRelated.firstName}, ' ', ${playerRelated.lastName}))`,
          },
        })
        .from(matchEvents)
        .innerJoin(playerMain, eq(matchEvents.playerId, playerMain.id))
        .leftJoin(playerRelated, eq(matchEvents.relatedPlayerId, playerRelated.id))
        .where(eq(matchEvents.matchId, id))
        .orderBy(asc(matchEvents.minute), asc(matchEvents.extraMinute));
    }
  );

  // Estatísticas comparativas do jogo (posse, chutes, etc.)
  app.get(
    "/:id/statistics",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Estatísticas avançadas do jogo (posse de bola, finalizações, faltas)",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const stats = await db
        .select({
          teamId: matchStatistics.teamId,
          teamName: teams.shortName,
          possessionPct: matchStatistics.possessionPct,
          shotsTotal: matchStatistics.shotsTotal,
          shotsOnTarget: matchStatistics.shotsOnTarget,
          corners: matchStatistics.corners,
          fouls: matchStatistics.fouls,
          offsides: matchStatistics.offsides,
          yellowCards: matchStatistics.yellowCards,
          redCards: matchStatistics.redCards,
          saves: matchStatistics.saves,
          passesTotal: matchStatistics.passesTotal,
          passesAccurate: matchStatistics.passesAccurate,
        })
        .from(matchStatistics)
        .innerJoin(teams, eq(matchStatistics.teamId, teams.id))
        .where(eq(matchStatistics.matchId, id));

      if (stats.length === 0) {
        return reply.status(404).send({ error: "Estatísticas não disponíveis para este jogo." });
      }

      return stats;
    }
  );

  // Confronto Direto (Head-to-Head - H2H) entre os dois times
  app.get(
    "/:id/h2h",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Confronto direto (H2H) histórico entre os dois times da partida",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [match] = await db
        .select({
          homeTeamId: matches.homeTeamId,
          awayTeamId: matches.awayTeamId,
        })
        .from(matches)
        .where(eq(matches.id, id));

      if (!match) {
        return reply.status(404).send({ error: "Partida não encontrada" });
      }

      const { homeTeamId, awayTeamId } = match;

      // Buscar todos os confrontos históricos entre os dois clubes
      const historicalMatches = await db
        .select({
          id: matches.id,
          round: matches.round,
          kickoffTime: matches.kickoffTime,
          status: matches.status,
          homeTeamId: matches.homeTeamId,
          awayTeamId: matches.awayTeamId,
          homeScore: matches.homeScore,
          awayScore: matches.awayScore,
        })
        .from(matches)
        .where(
          and(
            eq(matches.status, "FINISHED"),
            or(
              and(eq(matches.homeTeamId, homeTeamId), eq(matches.awayTeamId, awayTeamId)),
              and(eq(matches.homeTeamId, awayTeamId), eq(matches.awayTeamId, homeTeamId))
            )
          )
        )
        .orderBy(desc(matches.kickoffTime));

      let team1Wins = 0;
      let team2Wins = 0;
      let draws = 0;

      for (const m of historicalMatches) {
        if (m.homeScore === m.awayScore) {
          draws++;
        } else if (
          (m.homeTeamId === homeTeamId && (m.homeScore ?? 0) > (m.awayScore ?? 0)) ||
          (m.awayTeamId === homeTeamId && (m.awayScore ?? 0) > (m.homeScore ?? 0))
        ) {
          team1Wins++;
        } else {
          team2Wins++;
        }
      }

      return {
        homeTeamId,
        awayTeamId,
        totalMatches: historicalMatches.length,
        homeTeamWins: team1Wins,
        awayTeamWins: team2Wins,
        draws,
        matches: historicalMatches,
      };
    }
  );

  // Endpoint de inserção de evento (Admin / Real-time trigger)
  app.post(
    "/:id/events",
    {
      schema: {
        tags: ["Partidas - Operações em Tempo Real"],
        summary: "Registrar evento no jogo (Gol, Cartão, etc.) e disparar WebSocket",
        params: z.object({
          id: z.coerce.number(),
        }),
        body: z.object({
          teamId: z.number(),
          playerId: z.number(),
          relatedPlayerId: z.number().optional(),
          type: z.enum([
            "GOAL",
            "OWN_GOAL",
            "PENALTY_SCORED",
            "PENALTY_MISSED",
            "YELLOW_CARD",
            "RED_CARD",
            "SECOND_YELLOW",
            "SUBSTITUTION",
          ]),
          minute: z.number().min(1).max(130),
          extraMinute: z.number().min(0).default(0),
          description: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      // Inserir evento
      const [event] = await db
        .insert(matchEvents)
        .values({
          matchId: id,
          teamId: body.teamId,
          playerId: body.playerId,
          relatedPlayerId: body.relatedPlayerId,
          type: body.type,
          minute: body.minute,
          extraMinute: body.extraMinute,
          description: body.description,
        })
        .returning();

      // Se for gol, atualizar placar da partida
      if (
        body.type === "GOAL" ||
        body.type === "PENALTY_SCORED" ||
        body.type === "OWN_GOAL"
      ) {
        const [m] = await db
          .select()
          .from(matches)
          .where(eq(matches.id, id));

        if (m) {
          let newHomeScore = m.homeScore ?? 0;
          let newAwayScore = m.awayScore ?? 0;

          if (body.type === "OWN_GOAL") {
            if (body.teamId === m.homeTeamId) newAwayScore++;
            else newHomeScore++;
          } else {
            if (body.teamId === m.homeTeamId) newHomeScore++;
            else newAwayScore++;
          }

          await db
            .update(matches)
            .set({ homeScore: newHomeScore, awayScore: newAwayScore })
            .where(eq(matches.id, id));

          realtimeBroker.publishMatchUpdate({
            type: "SCORE_UPDATE",
            matchId: id,
            timestamp: new Date().toISOString(),
            data: {
              homeScore: newHomeScore,
              awayScore: newAwayScore,
            },
          });
        }
      }

      // Disparar broadcast em tempo real via WebSocket
      realtimeBroker.publishMatchUpdate({
        type: "MATCH_EVENT",
        matchId: id,
        timestamp: new Date().toISOString(),
        data: event,
      });

      return reply.status(201).send(event);
    }
  );

  // Endpoint de atualização de placar / status da partida
  app.patch(
    "/:id/score",
    {
      schema: {
        tags: ["Partidas - Operações em Tempo Real"],
        summary: "Atualizar placar e status do jogo em tempo real",
        params: z.object({
          id: z.coerce.number(),
        }),
        body: z.object({
          status: z
            .enum([
              "SCHEDULED",
              "FIRST_HALF",
              "HALF_TIME",
              "SECOND_HALF",
              "EXTRA_TIME",
              "PENALTIES",
              "FINISHED",
              "POSTPONED",
              "CANCELLED",
            ])
            .optional(),
          homeScore: z.number().min(0).optional(),
          awayScore: z.number().min(0).optional(),
          homeScoreHt: z.number().min(0).optional(),
          awayScoreHt: z.number().min(0).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const [updated] = await db
        .update(matches)
        .set(body)
        .where(eq(matches.id, id))
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: "Partida não encontrada" });
      }

      realtimeBroker.publishMatchUpdate({
        type: "SCORE_UPDATE",
        matchId: id,
        timestamp: new Date().toISOString(),
        data: updated,
      });

      return updated;
    }
  );
};
