import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { standings, teams, matches } from "../db/schema.js";
import { eq, asc, and, inArray } from "drizzle-orm";
import { cache } from "../services/cache.js";
import { SimulationService } from "../services/simulation.js";
import { SupercomputerService } from "../services/supercomputer.js";
import { requireAdminOrPlan } from "../middleware/auth.js";

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
    async (request, reply) => {
      const { seasonId } = request.query;
      reply.header("Cache-Control", "public, max-age=15, stale-while-revalidate=30");

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
    async (request, reply) => {
      const { seasonId } = request.query;
      reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=60");

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

  // Simulador de Tabela e Calculadora de Probabilidades
  app.post(
    "/simulate",
    {
      schema: {
        tags: ["Classificação"],
        summary: "Simulador de Tabela & Calculadora de Chances (Título, Libertadores e Rebaixamento)",
        description:
          "Permite enviar palpites para jogos futuros e recalcula a tabela final completa, com critérios de desempate oficiais e probabilidades matemáticas de Título, G-4 (Libertadores), G-6, Sul-Americana e Z-4 (Rebaixamento).",
        body: z.object({
          seasonId: z.number().default(1).describe("ID da temporada (ex: 1 para Brasileirão)"),
          predictions: z
            .array(
              z.object({
                matchId: z.number(),
                homeScore: z.number().min(0),
                awayScore: z.number().min(0),
              })
            )
            .default([])
            .describe("Lista de palpites de placares simulados"),
        }),
      },
    },
    async (request, reply) => {
      if (!requireAdminOrPlan(request, reply, ["ENTERPRISE", "PRO"])) return;
      const { seasonId, predictions } = request.body;
      return await SimulationService.simulateStandings(seasonId, predictions);
    }
  );

  // Supercomputador Preditivo & Projeção Final da Temporada (Monte Carlo)
  app.get(
    "/supercomputer",
    {
      schema: {
        tags: ["Classificação"],
        summary: "Supercomputador Preditivo: Projeção Final da Temporada & Notas de Corte",
        description:
          "Executa 10.000 simulações Monte Carlo das rodadas restantes, calculando a pontuação final esperada de cada clube, probabilidade refinada de Título, G-4, Sul-Americana e Rebaixamento, e a nota de corte matemática.",
        querystring: z.object({
          seasonId: z.coerce.number().optional().default(1),
        }),
      },
    },
    async (request, reply) => {
      const { seasonId } = request.query;
      reply.header("Cache-Control", "public, max-age=300, stale-while-revalidate=600");

      return await cache.wrap(`standings:supercomputer:${seasonId}`, 300, async () => {
        let rows = await db
          .select({
            teamId: standings.teamId,
            teamName: teams.name,
            shortName: teams.shortName,
            logoUrl: teams.logoUrl,
            points: standings.points,
            played: standings.played,
            goalsFor: standings.goalsFor,
            goalsAgainst: standings.goalsAgainst,
          })
          .from(standings)
          .innerJoin(teams, eq(standings.teamId, teams.id))
          .where(eq(standings.seasonId, seasonId))
          .orderBy(asc(standings.position));

        if (rows.length === 0) {
          const sampleTeams = await db.select().from(teams).limit(20);
          rows = sampleTeams.map((t, idx) => ({
            teamId: t.id,
            teamName: t.name,
            shortName: t.shortName,
            logoUrl: t.logoUrl,
            points: Math.max(15, 60 - idx * 2),
            played: 26,
            goalsFor: Math.max(20, 50 - idx),
            goalsAgainst: Math.min(50, 20 + idx),
          }));
        }

        return SupercomputerService.runSeasonSimulation(seasonId, rows);
      });
    }
  );
};

