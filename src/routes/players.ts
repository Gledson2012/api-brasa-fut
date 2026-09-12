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

  // Comparador de Atletas Raio-X (Head-to-Head de Jogadores)
  app.get(
    "/compare",
    {
      schema: {
        tags: ["Atletas"],
        summary: "Comparador Raio-X de Atletas (Head-to-Head)",
        description:
          "Compara dois jogadores lado a lado na temporada atual ou específica, calculando métricas ofensivas, defensivas e apontando as vantagens estatísticas de cada um.",
        querystring: z.object({
          p1: z.coerce.number().describe("ID do primeiro atleta"),
          p2: z.coerce.number().describe("ID do segundo atleta"),
          seasonId: z.coerce.number().optional().describe("ID da temporada (opcional)"),
        }),
      },
    },
    async (request, reply) => {
      const { p1, p2, seasonId } = request.query;

      if (p1 === p2) {
        return reply
          .status(400)
          .send({ error: "Informe dois atletas distintos para comparação." });
      }

      const cacheKey = `players:compare:${p1}:${p2}:${seasonId || "all"}`;

      return await cache.wrap(cacheKey, 60, async () => {
        const [player1] = await db.select().from(players).where(eq(players.id, p1));
        const [player2] = await db.select().from(players).where(eq(players.id, p2));

        if (!player1 || !player2) {
          return reply
            .status(404)
            .send({ error: "Um ou ambos os atletas informados não foram encontrados." });
        }

        const getPlayerStats = async (playerId: number) => {
          const conditions = [eq(playerSeasonStatistics.playerId, playerId)];
          if (seasonId) {
            conditions.push(eq(playerSeasonStatistics.seasonId, seasonId));
          }

          const rows = await db
            .select()
            .from(playerSeasonStatistics)
            .where(and(...conditions));

          return rows.reduce(
            (acc, r) => {
              acc.appearances += r.appearances;
              acc.matchesStarted += r.matchesStarted;
              acc.minutesPlayed += r.minutesPlayed;
              acc.goals += r.goals;
              acc.assists += r.assists;
              acc.shotsTotal += r.shotsTotal;
              acc.shotsOnTarget += r.shotsOnTarget;
              acc.keyPasses += r.keyPasses;
              acc.cleanSheets += r.cleanSheets;
              acc.saves += r.saves;
              acc.yellowCards += r.yellowCards;
              acc.redCards += r.redCards;
              const rat = parseFloat(r.rating || "0.0");
              if (rat > 0) {
                acc.ratingSum += rat;
                acc.ratingCount += 1;
              }
              return acc;
            },
            {
              appearances: 0,
              matchesStarted: 0,
              minutesPlayed: 0,
              goals: 0,
              assists: 0,
              shotsTotal: 0,
              shotsOnTarget: 0,
              keyPasses: 0,
              cleanSheets: 0,
              saves: 0,
              yellowCards: 0,
              redCards: 0,
              ratingSum: 0,
              ratingCount: 0,
            }
          );
        };

        const [s1, s2] = await Promise.all([getPlayerStats(p1), getPlayerStats(p2)]);

        const avgRating1 = s1.ratingCount > 0 ? (s1.ratingSum / s1.ratingCount).toFixed(2) : "0.0";
        const avgRating2 = s2.ratingCount > 0 ? (s2.ratingSum / s2.ratingCount).toFixed(2) : "0.0";

        const g90_1 = s1.minutesPlayed > 0 ? Number(((s1.goals / s1.minutesPlayed) * 90).toFixed(2)) : 0;
        const g90_2 = s2.minutesPlayed > 0 ? Number(((s2.goals / s2.minutesPlayed) * 90).toFixed(2)) : 0;

        const shotAcc1 = s1.shotsTotal > 0 ? Math.round((s1.shotsOnTarget / s1.shotsTotal) * 100) : 0;
        const shotAcc2 = s2.shotsTotal > 0 ? Math.round((s2.shotsOnTarget / s2.shotsTotal) * 100) : 0;

        // Vencedor em cada quesito
        const edge = {
          goals: s1.goals > s2.goals ? "p1" : s1.goals < s2.goals ? "p2" : "tie",
          assists: s1.assists > s2.assists ? "p1" : s1.assists < s2.assists ? "p2" : "tie",
          rating: parseFloat(avgRating1) > parseFloat(avgRating2) ? "p1" : parseFloat(avgRating1) < parseFloat(avgRating2) ? "p2" : "tie",
          goalsPer90: g90_1 > g90_2 ? "p1" : g90_1 < g90_2 ? "p2" : "tie",
          shotAccuracy: shotAcc1 > shotAcc2 ? "p1" : shotAcc1 < shotAcc2 ? "p2" : "tie",
          cleanSheets: s1.cleanSheets > s2.cleanSheets ? "p1" : s1.cleanSheets < s2.cleanSheets ? "p2" : "tie",
          saves: s1.saves > s2.saves ? "p1" : s1.saves < s2.saves ? "p2" : "tie",
        };

        const formatPlayer = (p: any, s: any, g90: number, acc: number, rat: string) => ({
          id: p.id,
          name: p.knownName || `${p.firstName} ${p.lastName}`,
          position: p.primaryPosition,
          nationality: p.nationality,
          photoUrl: p.photoUrl,
          stats: {
            appearances: s.appearances,
            minutesPlayed: s.minutesPlayed,
            goals: s.goals,
            assists: s.assists,
            goalsPer90: g90,
            averageRating: rat,
            shotsTotal: s.shotsTotal,
            shotsOnTarget: s.shotsOnTarget,
            shotAccuracyPct: acc,
            keyPasses: s.keyPasses,
            cleanSheets: s.cleanSheets,
            saves: s.saves,
            yellowCards: s.yellowCards,
            redCards: s.redCards,
          },
        });

        return {
          player1: formatPlayer(player1, s1, g90_1, shotAcc1, avgRating1),
          player2: formatPlayer(player2, s2, g90_2, shotAcc2, avgRating2),
          statisticalEdge: edge,
        };
      });
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
            cleanSheets: playerSeasonStatistics.cleanSheets,
            saves: playerSeasonStatistics.saves,
            goalsConceded: playerSeasonStatistics.goalsConceded,
            penaltySaves: playerSeasonStatistics.penaltySaves,
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

  // Histórico completo de carreira e scouting consolidado do atleta
  app.get(
    "/:id/career",
    {
      schema: {
        tags: ["Atletas"],
        summary: "Histórico completo de carreira e scouting do atleta",
        description:
          "Retorna o currículo completo temporada a temporada do atleta, com totais acumulados de carreira (gols, assistências, minutos, clean sheets, defesas e cartões).",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const cacheKey = `player:${id}:career`;

      return await cache.wrap(cacheKey, 120, async () => {
        const [player] = await db.select().from(players).where(eq(players.id, id));
        if (!player) {
          return reply.status(404).send({ error: "Atleta não encontrado" });
        }

        const seasonRows = await db
          .select({
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
            cleanSheets: playerSeasonStatistics.cleanSheets,
            saves: playerSeasonStatistics.saves,
            goalsConceded: playerSeasonStatistics.goalsConceded,
            penaltySaves: playerSeasonStatistics.penaltySaves,
          })
          .from(playerSeasonStatistics)
          .innerJoin(seasons, eq(playerSeasonStatistics.seasonId, seasons.id))
          .innerJoin(competitions, eq(seasons.competitionId, competitions.id))
          .innerJoin(teams, eq(playerSeasonStatistics.teamId, teams.id))
          .where(eq(playerSeasonStatistics.playerId, id));

        // Calcular totais acumulados de carreira
        const totals = seasonRows.reduce(
          (acc, row) => {
            acc.totalAppearances += row.appearances;
            acc.totalMatchesStarted += row.matchesStarted;
            acc.totalMinutesPlayed += row.minutesPlayed;
            acc.totalGoals += row.goals;
            acc.totalAssists += row.assists;
            acc.totalYellowCards += row.yellowCards;
            acc.totalRedCards += row.redCards;
            acc.totalCleanSheets += row.cleanSheets;
            acc.totalSaves += row.saves;
            acc.totalGoalsConceded += row.goalsConceded;
            acc.totalPenaltySaves += row.penaltySaves;
            return acc;
          },
          {
            totalAppearances: 0,
            totalMatchesStarted: 0,
            totalMinutesPlayed: 0,
            totalGoals: 0,
            totalAssists: 0,
            totalYellowCards: 0,
            totalRedCards: 0,
            totalCleanSheets: 0,
            totalSaves: 0,
            totalGoalsConceded: 0,
            totalPenaltySaves: 0,
          }
        );

        // Clubes distintos pelos quais atuou
        const distinctTeams = Array.from(
          new Map(
            seasonRows.map((r) => [
              r.teamId,
              { id: r.teamId, name: r.teamName, shortName: r.teamShortName, logoUrl: r.teamLogoUrl },
            ])
          ).values()
        );

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
          careerTotals: {
            ...totals,
            seasonsPlayed: seasonRows.length,
            clubsRepresented: distinctTeams.length,
          },
          clubs: distinctTeams,
          breakdownBySeason: seasonRows,
        };
      });
    }
  );
};
