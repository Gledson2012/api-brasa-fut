import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { standings, teams, matches } from "../db/schema.js";
import { eq, asc, and, inArray } from "drizzle-orm";
import { cache } from "../services/cache.js";

const LIVE_STATUSES = [
  "FIRST_HALF",
  "HALF_TIME",
  "SECOND_HALF",
  "EXTRA_TIME",
  "PENALTIES",
] as const;

export const standingsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Obter tabela de classificação virtual ao vivo (Live Standings)
  app.get(
    "/live",
    {
      schema: {
        tags: ["Classificação"],
        summary: "Obter tabela de classificação virtual em tempo real (Live Standings)",
        description:
          "Recalcula os pontos, saldo de gols e posições da tabela dinamicamente considerando os placares dos jogos que estão acontecendo no momento.",
        querystring: z.object({
          seasonId: z.coerce.number(),
        }),
      },
    },
    async (request) => {
      const { seasonId } = request.query;

      return await cache.wrap(`standings:live:season:${seasonId}`, 15, async () => {
        // 1. Obter tabela base oficial
        const baseTable = await db
          .select({
            originalPosition: standings.position,
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

        // 2. Buscar partidas em andamento da temporada
        const liveMatches = await db
          .select({
            id: matches.id,
            homeTeamId: matches.homeTeamId,
            awayTeamId: matches.awayTeamId,
            homeScore: matches.homeScore,
            awayScore: matches.awayScore,
            status: matches.status,
            round: matches.round,
          })
          .from(matches)
          .where(
            and(
              eq(matches.seasonId, seasonId),
              inArray(matches.status, LIVE_STATUSES as any)
            )
          );

        // Se não há jogos ao vivo, retorna a tabela oficial com movimentação neutra
        if (liveMatches.length === 0) {
          return {
            seasonId,
            liveMatchesCount: 0,
            hasLiveChanges: false,
            standings: baseTable.map((row) => ({
              ...row,
              currentPosition: row.originalPosition,
              movement: "SAME" as const,
              movementDelta: 0,
              liveMatch: null,
            })),
          };
        }

        // 3. Simular tabela ao vivo somando os pontos das partidas em andamento
        const liveMap = new Map(
          baseTable.map((row) => [
            row.team.id,
            {
              ...row,
              points: row.points,
              played: row.played,
              won: row.won,
              drawn: row.drawn,
              lost: row.lost,
              goalsFor: row.goalsFor,
              goalsAgainst: row.goalsAgainst,
              goalDifference: row.goalDifference,
              liveMatch: null as any,
            },
          ])
        );

        for (const m of liveMatches) {
          const home = liveMap.get(m.homeTeamId);
          const away = liveMap.get(m.awayTeamId);
          const hScore = m.homeScore ?? 0;
          const aScore = m.awayScore ?? 0;

          if (home) {
            home.played += 1;
            home.goalsFor += hScore;
            home.goalsAgainst += aScore;
            home.goalDifference = home.goalsFor - home.goalsAgainst;
            if (hScore > aScore) {
              home.points += 3;
              home.won += 1;
            } else if (hScore === aScore) {
              home.points += 1;
              home.drawn += 1;
            } else {
              home.lost += 1;
            }
            home.liveMatch = {
              matchId: m.id,
              score: `${hScore} - ${aScore}`,
              isHome: true,
              status: m.status,
            };
          }

          if (away) {
            away.played += 1;
            away.goalsFor += aScore;
            away.goalsAgainst += hScore;
            away.goalDifference = away.goalsFor - away.goalsAgainst;
            if (aScore > hScore) {
              away.points += 3;
              away.won += 1;
            } else if (aScore === hScore) {
              away.points += 1;
              away.drawn += 1;
            } else {
              away.lost += 1;
            }
            away.liveMatch = {
              matchId: m.id,
              score: `${hScore} - ${aScore}`,
              isHome: false,
              status: m.status,
            };
          }
        }

        // 4. Reordenar pelos critérios de desempate
        const recalculated = Array.from(liveMap.values()).sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
          if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
          return b.won - a.won;
        });

        // 5. Determinar a nova posição e o delta de movimentação
        const liveStandings = recalculated.map((row, idx) => {
          const currentPosition = idx + 1;
          const delta = row.originalPosition - currentPosition;
          let movement: "UP" | "DOWN" | "SAME" = "SAME";
          if (delta > 0) movement = "UP";
          else if (delta < 0) movement = "DOWN";

          return {
            ...row,
            currentPosition,
            movement,
            movementDelta: delta,
          };
        });

        return {
          seasonId,
          liveMatchesCount: liveMatches.length,
          hasLiveChanges: true,
          standings: liveStandings,
        };
      });
    }
  );

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
