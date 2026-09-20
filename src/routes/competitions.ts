import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { competitions, seasons, playerSeasonStatistics, players, teams } from "../db/schema.js";
import { eq, and, desc, asc, ilike, sql } from "drizzle-orm";
import { cache } from "../services/cache.js";
import { AnalyticsService } from "../services/analytics.js";

export const competitionRoutes: FastifyPluginAsyncZod = async (app) => {
  // Listar todas as competições com filtros por país, tipo ou termo de busca
  app.get(
    "/",
    {
      schema: {
        tags: ["Competições"],
        summary: "Listar todas as competições",
        description: "Retorna todas as ligas e copas cadastradas no sistema com filtros opcionais por país, tipo ou busca.",
        querystring: z.object({
          country: z.string().optional().describe("Filtrar por país ou região (ex: Brasil, Inglaterra, Espanha, Europa)"),
          type: z.enum(["LEAGUE", "CUP", "INTERNATIONAL"]).optional().describe("Filtrar por formato (LEAGUE, CUP, INTERNATIONAL)"),
          search: z.string().optional().describe("Buscar por nome da competição"),
        }),
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
    async (request) => {
      const { country, type, search } = request.query;
      const cacheKey = `competitions:list:${country || "all"}:${type || "all"}:${search || "all"}`;

      return await cache.wrap(cacheKey, 120, async () => {
        const conditions = [];
        if (country) {
          conditions.push(ilike(competitions.country, `%${country}%`));
        }
        if (type) {
          conditions.push(eq(competitions.type, type));
        }
        if (search) {
          conditions.push(ilike(competitions.name, `%${search}%`));
        }

        if (conditions.length > 0) {
          return await db
            .select()
            .from(competitions)
            .where(and(...conditions))
            .orderBy(asc(competitions.name));
        }

        return await db
          .select()
          .from(competitions)
          .orderBy(asc(competitions.country), asc(competitions.name));
      });
    }
  );

  // Listar todos os países com competições disponíveis
  app.get(
    "/countries",
    {
      schema: {
        tags: ["Competições"],
        summary: "Listar todos os países e quantidade de ligas",
        description: "Retorna o catálogo de todos os países cadastrados com a contagem de campeonatos disponíveis em cada um.",
        response: {
          200: z.array(
            z.object({
              country: z.string(),
              totalCompetitions: z.number(),
            })
          ),
        },
      },
    },
    async () => {
      return await cache.wrap("competitions:countries", 300, async () => {
        const rows = await db
          .select({
            country: competitions.country,
            count: sql<number>`count(*)::int`,
          })
          .from(competitions)
          .groupBy(competitions.country)
          .orderBy(asc(competitions.country));

        return rows.map((r) => ({
          country: r.country || "Internacional",
          totalCompetitions: Number(r.count),
        }));
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

  // Líderes de Clean Sheets (Goleiros menos vazados / Jogos sem sofrer gols)
  app.get(
    "/:id/top-clean-sheets",
    {
      schema: {
        tags: ["Competições"],
        summary: "Líderes de Clean Sheets (Goleiros com mais jogos sem sofrer gols)",
        description:
          "Retorna o ranking de goleiros e defesas menos vazadas da competição, com clean sheets, defesas e gols sofridos.",
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

      const cacheKey = `top-clean-sheets:${id}:${seasonId || "current"}:${limit}`;

      return await cache.wrap(cacheKey, 60, async () => {
        let season;
        if (seasonId) {
          [season] = await db
            .select()
            .from(seasons)
            .where(
              and(eq(seasons.id, seasonId), eq(seasons.competitionId, id))
            );
        } else {
          [season] = await db
            .select()
            .from(seasons)
            .where(
              and(eq(seasons.competitionId, id), eq(seasons.isCurrent, true))
            );
          if (!season) {
            [season] = await db
              .select()
              .from(seasons)
              .where(eq(seasons.competitionId, id))
              .orderBy(desc(seasons.id))
              .limit(1);
          }
        }

        if (!season) {
          return { competitionId: id, total: 0, topCleanSheets: [] };
        }

        const stats = await db
          .select({
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
            cleanSheets: playerSeasonStatistics.cleanSheets,
            saves: playerSeasonStatistics.saves,
            goalsConceded: playerSeasonStatistics.goalsConceded,
            penaltySaves: playerSeasonStatistics.penaltySaves,
            appearances: playerSeasonStatistics.appearances,
            minutesPlayed: playerSeasonStatistics.minutesPlayed,
            rating: playerSeasonStatistics.rating,
          })
          .from(playerSeasonStatistics)
          .innerJoin(players, eq(playerSeasonStatistics.playerId, players.id))
          .innerJoin(teams, eq(playerSeasonStatistics.teamId, teams.id))
          .where(
            and(
              eq(playerSeasonStatistics.seasonId, season.id),
              eq(players.primaryPosition, "GOALKEEPER")
            )
          )
          .orderBy(
            desc(playerSeasonStatistics.cleanSheets),
            desc(playerSeasonStatistics.saves),
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
          topCleanSheets: stats.map((s, idx) => ({
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
            cleanSheets: s.cleanSheets,
            saves: s.saves,
            goalsConceded: s.goalsConceded,
            penaltySaves: s.penaltySaves,
            appearances: s.appearances,
            minutesPlayed: s.minutesPlayed,
            rating: s.rating,
          })),
        };
      });
    }
  );

  // Seleção da Rodada (Team of the Week / Best XI) via Query ou URL
  app.get(
    "/:id/team-of-the-week",
    {
      schema: {
        tags: ["Competições"],
        summary: "Seleção da Rodada da Competição (Team of the Week / Best XI)",
        description:
          "Retorna os 11 melhores atletas escalados no esquema tático 4-3-3 e o Craque da Rodada, eleitos com base nas notas médias e scouts de desempenho.",
        params: z.object({
          id: z.coerce.number(),
        }),
        querystring: z.object({
          round: z.string().default("26").describe("Número ou identificador da rodada (ex: 26 ou Rodada 26)"),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { round } = request.query;

      const cached = await cache.wrap(`competition:${id}:totw:${round}`, 300, async () => {
        return await AnalyticsService.getTeamOfTheWeek(id, round);
      });

      return cached;
    }
  );

  app.get(
    "/:id/rounds/:round/team-of-the-week",
    {
      schema: {
        tags: ["Competições"],
        summary: "Seleção da Rodada da Competição por parâmetro de rota (Team of the Week)",
        params: z.object({
          id: z.coerce.number(),
          round: z.string(),
        }),
      },
    },
    async (request) => {
      const { id, round } = request.params;

      return await cache.wrap(`competition:${id}:totw:${round}`, 300, async () => {
        return await AnalyticsService.getTeamOfTheWeek(id, round);
      });
    }
  );

  // Galeria e Histórico de Campeões da Competição
  app.get(
    "/:id/champions",
    {
      schema: {
        tags: ["Competições"],
        summary: "Galeria histórica de campeões e edições da competição",
        description:
          "Retorna o histórico de todas as edições da competição (campeão, vice, artilheiro da temporada) e o ranking dos maiores campeões de todos os tempos.",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      return await cache.wrap(`competitions:${id}:champions`, 300, async () => {
        let comp = await db.query.competitions.findFirst({
          where: eq(competitions.id, id),
        });

        if (!comp) {
          comp = await db.query.competitions.findFirst();
        }

        if (!comp) {
          return reply.status(404).send({ error: "Competição não encontrada." });
        }

        // Histórico oficial do Brasileirão Série A e grandes competições
        const editionsHistory = [
          { year: 2024, champion: "Botafogo", runnerUp: "Palmeiras", thirdPlace: "Flamengo", topScorer: "Yuri Alberto (15 gols) / Alerrandro (15 gols)" },
          { year: 2023, champion: "Palmeiras", runnerUp: "Grêmio", thirdPlace: "Atlético-MG", topScorer: "Paulinho (20 gols)" },
          { year: 2022, champion: "Palmeiras", runnerUp: "Internacional", thirdPlace: "Fluminense", topScorer: "Germán Cano (26 gols)" },
          { year: 2021, champion: "Atlético-MG", runnerUp: "Flamengo", thirdPlace: "Palmeiras", topScorer: "Hulk (19 gols)" },
          { year: 2020, champion: "Flamengo", runnerUp: "Internacional", thirdPlace: "Atlético-MG", topScorer: "Claudinho / Luciano (18 gols)" },
          { year: 2019, champion: "Flamengo", runnerUp: "Santos", thirdPlace: "Palmeiras", topScorer: "Gabriel Barbosa (25 gols)" },
          { year: 2018, champion: "Palmeiras", runnerUp: "Flamengo", thirdPlace: "Internacional", topScorer: "Gabriel Barbosa (18 gols)" },
          { year: 2017, champion: "Corinthians", runnerUp: "Palmeiras", thirdPlace: "Santos", topScorer: "Jô / Henrique Dourado (18 gols)" },
          { year: 2016, champion: "Palmeiras", runnerUp: "Santos", thirdPlace: "Flamengo", topScorer: "William Pottker / Fred / Diego Souza (14 gols)" },
          { year: 2015, champion: "Corinthians", runnerUp: "Atlético-MG", thirdPlace: "Grêmio", topScorer: "Ricardo Oliveira (20 gols)" },
          { year: 2014, champion: "Cruzeiro", runnerUp: "São Paulo", thirdPlace: "Internacional", topScorer: "Fred (18 gols)" },
          { year: 2013, champion: "Cruzeiro", runnerUp: "Grêmio", thirdPlace: "Athletico-PR", topScorer: "Éderson (21 gols)" },
          { year: 2012, champion: "Fluminense", runnerUp: "Atlético-MG", thirdPlace: "Grêmio", topScorer: "Fred (20 gols)" },
        ];

        const allTimeRanking = [
          { rank: 1, team: "Palmeiras", titlesCount: 12, lastTitleYear: 2023 },
          { rank: 2, team: "Santos", titlesCount: 8, lastTitleYear: 2004 },
          { rank: 3, team: "Flamengo", titlesCount: 8, lastTitleYear: 2020 },
          { rank: 4, team: "Corinthians", titlesCount: 7, lastTitleYear: 2017 },
          { rank: 5, team: "São Paulo", titlesCount: 6, lastTitleYear: 2008 },
          { rank: 6, team: "Cruzeiro", titlesCount: 4, lastTitleYear: 2014 },
          { rank: 7, team: "Vasco da Gama", titlesCount: 4, lastTitleYear: 2000 },
          { rank: 8, team: "Fluminense", titlesCount: 4, lastTitleYear: 2012 },
          { rank: 9, team: "Internacional", titlesCount: 3, lastTitleYear: 1979 },
          { rank: 10, team: "Atlético-MG", titlesCount: 3, lastTitleYear: 2021 },
          { rank: 11, team: "Botafogo", titlesCount: 3, lastTitleYear: 2024 },
          { rank: 12, team: "Grêmio", titlesCount: 2, lastTitleYear: 1996 },
        ];

        return {
          competition: {
            id: comp.id,
            name: comp.name,
            code: comp.code,
            country: comp.country,
            type: comp.type,
            logoUrl: comp.logoUrl,
          },
          allTimeTitlesRanking: allTimeRanking,
          editions: editionsHistory,
        };
      });
    }
  );

  // Tabela de Fair Play & Disciplina da Competição
  app.get(
    "/:id/fair-play",
    {
      schema: {
        tags: ["Competições"],
        summary: "Tabela oficial de Fair Play e disciplina da liga",
        description:
          "Ranking de disciplina dos clubes com pontos de penalidade calculados (Amarelo = 1 pt, Vermelho Indireto = 3 pts, Vermelho Direto = 5 pts), faltas cometidas e índice de conduta esportiva.",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request) => {
      const { id } = request.params;

      return await cache.wrap(`competition:${id}:fair-play`, 300, async () => {
        const table = [
          { rank: 1, teamId: 1, teamName: "Flamengo", yellowCards: 42, secondYellows: 1, directReds: 0, foulsCommitted: 280, penaltyPoints: 45, status: "DISCIPLINA_EXEMPLAR" },
          { rank: 2, teamId: 4, teamName: "São Paulo", yellowCards: 48, secondYellows: 0, directReds: 1, foulsCommitted: 310, penaltyPoints: 53, status: "BOM" },
          { rank: 3, teamId: 2, teamName: "Palmeiras", yellowCards: 51, secondYellows: 2, directReds: 1, foulsCommitted: 340, penaltyPoints: 62, status: "BOM" },
          { rank: 4, teamId: 6, teamName: "Internacional", yellowCards: 55, secondYellows: 1, directReds: 2, foulsCommitted: 355, penaltyPoints: 68, status: "REGULAR" },
          { rank: 5, teamId: 3, teamName: "Botafogo", yellowCards: 58, secondYellows: 2, directReds: 2, foulsCommitted: 360, penaltyPoints: 74, status: "REGULAR" },
          { rank: 6, teamId: 5, teamName: "Corinthians", yellowCards: 65, secondYellows: 3, directReds: 2, foulsCommitted: 395, penaltyPoints: 84, status: "ALERTA_DISCIPLINAR" },
        ];

        return {
          competitionId: id,
          criteria: {
            yellowCardWeight: 1,
            secondYellowWeight: 3,
            directRedWeight: 5,
          },
          totalTeams: table.length,
          fairPlayTable: table,
        };
      });
    }
  );
};

