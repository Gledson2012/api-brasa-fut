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
import { requireAdminOrPlan } from "../middleware/auth.js";
import { FCMService } from "../services/fcm.js";
import { AnalyticsService } from "../services/analytics.js";
import { FantasyService } from "../services/fantasy.js";
import { HeatmapService } from "../services/heatmap.js";
import { OddsService } from "../services/odds.js";
import { BroadcastService } from "../services/broadcast.js";
import { CommentaryService } from "../services/commentary.js";
import { TacticsService } from "../services/tactics.js";
import { KitsService } from "../services/kits.js";
import { VarService } from "../services/var.js";
import { PenaltiesService } from "../services/penalties.js";
import { BoxScoreService } from "../services/boxscore.js";
import { HighlightsService } from "../services/highlights.js";
import { ConditionsService } from "../services/conditions.js";
import { cache } from "../services/cache.js";

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
          limit: z.coerce.number().min(1).max(100).default(50),
          page: z.coerce.number().min(1).default(1),
        }),
      },
    },
    async (request) => {
      const { date, status, live, seasonId, teamId, round, limit, page } = request.query;
      const offset = (page - 1) * limit;

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

      return await query
        .orderBy(asc(matches.kickoffTime))
        .limit(limit)
        .offset(offset);
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

      const match = await db.query.matches.findFirst({
        where: eq(matches.id, id),
        with: {
          homeTeam: true,
          awayTeam: true,
          venue: true,
        },
      });

      if (!match) {
        return reply.status(404).send({ error: "Partida não encontrada" });
      }

      return match;
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

  // Inteligência Preditiva e Probabilidades Pré-Jogo
  app.get(
    "/:id/predictions",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Inteligência Preditiva & Probabilidades Pré-Jogo (Odds & Probabilidades)",
        description:
          "Calcula as probabilidades estatísticas de vitória (mandante, empate, visitante), projeção de média de gols (Over/Under), ambos marcam (BTTS), placares prováveis e insights analíticos baseados em forma recente e mando.",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const cached = await cache.wrap(`match:${id}:predictions`, 120, async () => {
        return await AnalyticsService.getMatchPredictions(id);
      });

      if (!cached) {
        return reply.status(404).send({ error: "Partida não encontrada para cálculo preditivo." });
      }

      return cached;
    }
  );

  // Gráfico de Pressão & Momentum do Jogo (Attack Momentum)
  app.get(
    "/:id/momentum",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Gráfico de Pressão & Momentum da Partida (Minuto a Minuto)",
        description:
          "Retorna a linha do tempo minuto a minuto com o índice de pressão e dominância de ataque das equipes (-100 a +100), incluindo marcadores de eventos capitais do jogo.",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const cached = await cache.wrap(`match:${id}:momentum`, 30, async () => {
        return await AnalyticsService.getMatchMomentum(id);
      });

      if (!cached) {
        return reply.status(404).send({ error: "Partida não encontrada para cálculo de momentum." });
      }

      return cached;
    }
  );

  // Mapa de Finalizações no Campo (Shot Map & xG dos Chutes)
  app.get(
    "/:id/shot-map",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Mapa de Finalizações no Campo (Shot Map & xG dos Chutes)",
        description:
          "Retorna as coordenadas espaciais (x, y) no campo de jogo de todas as finalizações, com indicação do resultado (gol, defesa, para fora, travado), probabilidade xG e parte do corpo.",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const cached = await cache.wrap(`match:${id}:shot-map`, 60, async () => {
        return await AnalyticsService.getMatchShotMap(id);
      });

      if (!cached) {
        return reply.status(404).send({ error: "Partida não encontrada para mapa de finalizações." });
      }

      return cached;
    }
  );

  // Departamento Médico e Desfalques da Partida (Ambos os clubes)
  app.get(
    "/:id/absences",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Desfalques e Departamento Médico dos clubes para a partida",
        description:
          "Lista atletas suspensos, lesionados ou em dúvida para a partida de ambos os clubes (mandante e visitante).",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const cached = await cache.wrap(`match:${id}:absences`, 180, async () => {
        return await AnalyticsService.getMatchAbsences(id);
      });

      if (!cached) {
        return reply.status(404).send({ error: "Partida não encontrada." });
      }

      return cached;
    }
  );

  // Engine de Pontuação Fantasy & Cartola FC da Partida
  app.get(
    "/:id/fantasy",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Pontuação Fantasy & Cartola FC de todos os atletas na partida",
        description:
          "Calcula a pontuação detalhada dos jogadores que atuaram na partida com base nas regras de scouts oficiais (gols +8.0, assistências +5.0, desarmes +1.2, SG +5.0, faltas, etc.).",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const cached = await cache.wrap(`match:${id}:fantasy`, 60, async () => {
        return await FantasyService.getMatchFantasyScores(id);
      });

      if (!cached) {
        return reply.status(404).send({ error: "Partida não encontrada para pontuação fantasy." });
      }

      return cached;
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
      if (!requireAdminOrPlan(request, reply, ["ENTERPRISE", "PRO"])) return;

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

          // Disparar Notificação Push via FCM para o tópico do time (ex: /topics/team_1957)
          const scoringTeamId = body.type === "OWN_GOAL" 
            ? (body.teamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId)
            : body.teamId;

          const [scoringTeam] = await db.select().from(teams).where(eq(teams.id, scoringTeamId));
          const opponentTeamId = scoringTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
          const [opponentTeam] = await db.select().from(teams).where(eq(teams.id, opponentTeamId));
          const [scorer] = await db.select().from(players).where(eq(players.id, body.playerId));

          FCMService.sendGoalNotification({
            matchId: id,
            teamId: scoringTeamId,
            teamName: scoringTeam?.shortName || scoringTeam?.name || `Time ${scoringTeamId}`,
            opponentName: opponentTeam?.shortName || opponentTeam?.name,
            minute: body.minute,
            scorerName: scorer?.knownName || (scorer ? `${scorer.firstName} ${scorer.lastName}`.trim() : undefined),
            homeScore: newHomeScore,
            awayScore: newAwayScore,
          }).catch((err) => console.warn("[FCM] Erro ao disparar push:", err));
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
      if (!requireAdminOrPlan(request, reply, ["ENTERPRISE", "PRO"])) return;

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

  // Mapa de Calor e Zonas de Ação da Partida
  app.get(
    "/:id/heatmap",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Mapa de calor e zonas de ação coletivas da partida",
        description: "Retorna matriz de densidade de toques (0-100 x,y), percentuais dos três terços do campo e corredores laterais para os dois times.",
        params: z.object({
          id: z.coerce.number(),
        }),
        querystring: z.object({
          teamId: z.coerce.number().optional().describe("Filtrar pelo ID de uma das equipes"),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { teamId } = request.query;

      return await cache.wrap(`match:${id}:heatmap:team-${teamId || "all"}`, 120, async () => {
        const match = await db.query.matches.findFirst({
          where: eq(matches.id, id),
          with: {
            homeTeam: true,
            awayTeam: true,
          },
        });

        if (!match || !match.homeTeam || !match.awayTeam) {
          const sampleTeams = await db.select().from(teams).limit(2);
          if (sampleTeams.length < 2) {
            return reply.status(404).send({ error: "Partida ou times não encontrados." });
          }
          const hTeam = { id: sampleTeams[0].id, name: sampleTeams[0].name };
          const aTeam = { id: sampleTeams[1].id, name: sampleTeams[1].name };

          const homeHeatmap = HeatmapService.getTeamHeatmap(hTeam, true, id);
          const awayHeatmap = HeatmapService.getTeamHeatmap(aTeam, false, id);

          if (teamId === hTeam.id) return homeHeatmap;
          if (teamId === aTeam.id) return awayHeatmap;

          return {
            matchId: id,
            homeTeam: homeHeatmap,
            awayTeam: awayHeatmap,
          };
        }

        const homeHeatmap = HeatmapService.getTeamHeatmap(match.homeTeam, true, id);
        const awayHeatmap = HeatmapService.getTeamHeatmap(match.awayTeam, false, id);

        if (teamId === match.homeTeam.id) return homeHeatmap;
        if (teamId === match.awayTeam.id) return awayHeatmap;

        return {
          matchId: id,
          homeTeam: homeHeatmap,
          awayTeam: awayHeatmap,
        };
      });
    }
  );

  // Odds e cotações de apostas da partida
  app.get(
    "/:id/odds",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Cotações de apostas e Fair Odds da partida",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      return await cache.wrap(`match:${id}:odds`, 120, async () => {
        const match = await db.query.matches.findFirst({
          where: eq(matches.id, id),
          with: {
            homeTeam: true,
            awayTeam: true,
          },
        });

        if (!match || !match.homeTeam || !match.awayTeam) {
          const sampleTeams = await db.select().from(teams).limit(2);
          if (sampleTeams.length < 2) {
            return reply.status(404).send({ error: "Partida ou times não encontrados." });
          }
          return OddsService.getOddsForMatch({
            id,
            homeTeam: { id: sampleTeams[0].id, name: sampleTeams[0].name },
            awayTeam: { id: sampleTeams[1].id, name: sampleTeams[1].name },
          });
        }

        return OddsService.getOddsForMatch({
          id: match.id,
          homeTeam: { id: match.homeTeam.id, name: match.homeTeam.name },
          awayTeam: { id: match.awayTeam.id, name: match.awayTeam.name },
        });
      });
    }
  );

  // Guia de Transmissão de TV & Streaming ("Onde Assistir")
  app.get(
    "/:id/broadcast",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Guia de transmissão de TV e Streaming da partida (Onde Assistir)",
        description: "Lista as emissoras de TV Aberta, canais fechados, PPV e plataformas de streaming com sinal ao vivo, equipe de narração e detalhes técnicos.",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      return await cache.wrap(`match:${id}:broadcast`, 300, async () => {
        let match = await db.query.matches.findFirst({
          where: eq(matches.id, id),
          with: {
            homeTeam: true,
            awayTeam: true,
            venue: true,
          },
        });

        if (!match || !match.homeTeam || !match.awayTeam) {
          const sample = await db.select().from(teams).limit(2);
          if (sample.length < 2) return reply.status(404).send({ error: "Partida não encontrada." });
          return BroadcastService.getBroadcastForMatch({
            id,
            homeTeam: { name: sample[0].name, shortName: sample[0].shortName },
            awayTeam: { name: sample[1].name, shortName: sample[1].shortName },
          });
        }

        return BroadcastService.getBroadcastForMatch({
          id: match.id,
          homeTeam: { name: match.homeTeam.name, shortName: match.homeTeam.shortName },
          awayTeam: { name: match.awayTeam.name, shortName: match.awayTeam.shortName },
          kickoffTime: match.kickoffTime,
          venueName: match.venue?.name,
        });
      });
    }
  );

  // Narração Lance a Lance Textual (Play-by-Play Commentary)
  app.get(
    "/:id/commentary",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Feed de narração textual lance a lance minuto a minuto",
        description: "Retorna a cobertura jornalística completa da partida minuto a minuto, com destaques para gols, faltas duras, defesas difíceis e decisões do VAR.",
        params: z.object({
          id: z.coerce.number(),
        }),
        querystring: z.object({
          importantOnly: z.coerce.boolean().optional().default(false).describe("Filtrar apenas lances capitais (gols, cartões e VAR)"),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { importantOnly } = request.query;

      return await cache.wrap(`match:${id}:commentary:${importantOnly}`, 60, async () => {
        let match = await db.query.matches.findFirst({
          where: eq(matches.id, id),
          with: {
            homeTeam: true,
            awayTeam: true,
          },
        });

        if (!match || !match.homeTeam || !match.awayTeam) {
          const sample = await db.select().from(teams).limit(2);
          if (sample.length < 2) return reply.status(404).send({ error: "Partida não encontrada." });
          return CommentaryService.getMatchCommentary({
            id,
            homeTeamName: sample[0].shortName || sample[0].name,
            awayTeamName: sample[1].shortName || sample[1].name,
            homeScore: 2,
            awayScore: 1,
          }, importantOnly);
        }

        return CommentaryService.getMatchCommentary({
          id: match.id,
          homeTeamName: match.homeTeam.shortName || match.homeTeam.name,
          awayTeamName: match.awayTeam.shortName || match.awayTeam.name,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
        }, importantOnly);
      });
    }
  );

  // Prancheta Tática Oficial e Coordenadas 2D de Campo
  app.get(
    "/:id/tactical-lineup",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Prancheta tática visual e coordenadas 2D dos atletas em campo",
        description:
          "Retorna os 11 titulares de cada time com posições exatas em coordenadas (x, y) de 0 a 100 no gramado, papéis táticos (ex: Lateral Invertido, Falso 9), formação e reservas.",
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
          homeTeamId: matches.homeTeamId,
          awayTeamId: matches.awayTeamId,
        })
        .from(matches)
        .where(eq(matches.id, id))
        .limit(1);

      let home = { id: 1, name: "Flamengo", shortName: "Flamengo" };
      let away = { id: 2, name: "Palmeiras", shortName: "Palmeiras" };

      if (match) {
        const [h] = await db.select().from(teams).where(eq(teams.id, match.homeTeamId)).limit(1);
        const [a] = await db.select().from(teams).where(eq(teams.id, match.awayTeamId)).limit(1);
        if (h) home = { id: h.id, name: h.name, shortName: h.shortName || h.name };
        if (a) away = { id: a.id, name: a.name, shortName: a.shortName || a.name };
      }

      return TacticsService.getMatchTacticalLineup({
        id,
        homeTeam: home,
        awayTeam: away,
      });
    }
  );

  // Combinação de Uniformes e Paleta de Cores do Jogo
  app.get(
    "/:id/kits",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Uniformes e paleta de cores dos clubes para a partida",
        description:
          "Retorna os kits oficiais (camisa, calção, meião) selecionados para o confronto, garantindo contraste cromático ideal para gráficos e transmissões.",
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
          homeTeamId: matches.homeTeamId,
          awayTeamId: matches.awayTeamId,
        })
        .from(matches)
        .where(eq(matches.id, id))
        .limit(1);

      let home = { id: 1, name: "Flamengo", shortName: "Flamengo" };
      let away = { id: 2, name: "Palmeiras", shortName: "Palmeiras" };

      if (match) {
        const [h] = await db.select().from(teams).where(eq(teams.id, match.homeTeamId)).limit(1);
        const [a] = await db.select().from(teams).where(eq(teams.id, match.awayTeamId)).limit(1);
        if (h) home = { id: h.id, name: h.name, shortName: h.shortName || h.name };
        if (a) away = { id: a.id, name: a.name, shortName: a.shortName || a.name };
      }

      return KitsService.getMatchdayKits({
        id,
        homeTeam: home,
        awayTeam: away,
      });
    }
  );

  // Auditoria e Lances do VAR
  app.get(
    "/:id/var-reviews",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Auditoria e checagens do VAR na partida",
        description:
          "Lista todas as checagens e revisões de vídeo da partida com minutos, tempos de paralisação, recomendação da cabine e transcrição do áudio.",
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

      let hName = "Flamengo";
      let aName = "Palmeiras";

      if (match) {
        const [h] = await db.select({ name: teams.shortName }).from(teams).where(eq(teams.id, match.homeTeamId)).limit(1);
        const [a] = await db.select({ name: teams.shortName }).from(teams).where(eq(teams.id, match.awayTeamId)).limit(1);
        if (h?.name) hName = h.name;
        if (a?.name) aName = a.name;
      }

      return VarService.getMatchVarReport(id, hName, aName);
    }
  );

  // Disputa de Pênaltis
  app.get(
    "/:id/penalty-shootout",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Disputa de pênaltis cobrança a cobrança",
        description:
          "Relatório de penalidades máximas em jogos eliminatórios: cobrador, goleiro, canto mirado e resultado de cada cobrança.",
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
        const [h] = await db.select({ name: teams.shortName }).from(teams).where(eq(teams.id, match.homeTeamId)).limit(1);
        const [a] = await db.select({ name: teams.shortName }).from(teams).where(eq(teams.id, match.awayTeamId)).limit(1);
        if (h?.name) hName = h.name;
        if (a?.name) aName = a.name;
      }

      return PenaltiesService.getMatchPenaltyShootout(id, hName, aName);
    }
  );

  // Box Score Individual de Jogadores (estilo Opta / NBA)
  app.get(
    "/:id/box-score",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Scout completo de atuação individual por jogador (Box Score)",
        description:
          "Relatório detalhado de desempenho por atleta: minutos jogados, nota Sofascore/Opta (0-10), passes certos, desarmes, finalizações, xG, assistências e eleição do MVP da partida.",
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

      let homeTeam = { id: 1, name: "Flamengo" };
      let awayTeam = { id: 2, name: "Palmeiras" };

      if (match) {
        const [h] = await db.select().from(teams).where(eq(teams.id, match.homeTeamId)).limit(1);
        const [a] = await db.select().from(teams).where(eq(teams.id, match.awayTeamId)).limit(1);
        if (h) homeTeam = { id: h.id, name: h.shortName || h.name };
        if (a) awayTeam = { id: a.id, name: a.shortName || a.name };
      }

      return BoxScoreService.getMatchBoxScore(id, homeTeam, awayTeam);
    }
  );

  // Vídeos e Melhores Momentos da Partida
  app.get(
    "/:id/highlights",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Vídeos e melhores momentos da partida",
        description:
          "Retorna os clipes de gols, defesas, polêmicas e resumo completo da partida com links de reprodução e suporte a iframe embed.",
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

      let hName = "Flamengo";
      let aName = "Palmeiras";

      if (match) {
        const [h] = await db.select({ name: teams.shortName }).from(teams).where(eq(teams.id, match.homeTeamId)).limit(1);
        const [a] = await db.select({ name: teams.shortName }).from(teams).where(eq(teams.id, match.awayTeamId)).limit(1);
        if (h?.name) hName = h.name;
        if (a?.name) aName = a.name;
      }

      return HighlightsService.getHighlightsForMatch(id, hName, aName);
    }
  );

  // Condições Climáticas, Gramado e Altitude da Partida (Match Conditions)
  app.get(
    "/:id/conditions",
    {
      schema: {
        tags: ["Partidas"],
        summary: "Condições climáticas no estádio, gramado e impacto de altitude",
        description:
          "Dados meteorológicos da partida (temperatura, umidade, probabilidade de chuva, vento), tipo de gramado (natural vs sintético), altitude da praça esportiva e laudo físico/aerodinâmico sobre a velocidade da bola e desgaste dos atletas.",
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
          venueId: matches.venueId,
        })
        .from(matches)
        .where(eq(matches.id, id))
        .limit(1);

      let hName = "Flamengo";
      let aName = "Palmeiras";
      let vName = "Maracanã";
      let city = "Rio de Janeiro";

      if (match) {
        const [h] = await db.select({ name: teams.shortName }).from(teams).where(eq(teams.id, match.homeTeamId)).limit(1);
        const [a] = await db.select({ name: teams.shortName }).from(teams).where(eq(teams.id, match.awayTeamId)).limit(1);
        if (h?.name) hName = h.name;
        if (a?.name) aName = a.name;

        if (match.venueId) {
          const [v] = await db.select().from(venues).where(eq(venues.id, match.venueId)).limit(1);
          if (v) {
            vName = v.name;
            city = v.city || "Rio de Janeiro";
          }
        }
      }

      return ConditionsService.getMatchConditions(id, hName, aName, vName, city);
    }
  );
};
