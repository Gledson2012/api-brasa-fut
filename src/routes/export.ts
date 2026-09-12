import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { standings, teams, players, playerSeasonStatistics, matches, seasons, competitions } from "../db/schema.js";
import { eq, and, asc, desc } from "drizzle-orm";

export const exportRoutes: FastifyPluginAsyncZod = async (app) => {
  // Exportar Tabela de Classificação em CSV
  app.get(
    "/standings",
    {
      schema: {
        tags: ["Exportação de Dados"],
        summary: "Exportar tabela de classificação em formato CSV (Excel)",
        description: "Gera arquivo .csv para download com a classificação oficial da liga.",
        querystring: z.object({
          seasonId: z.coerce.number().default(1),
        }),
      },
    },
    async (request, reply) => {
      const { seasonId } = request.query;

      const rows = await db
        .select({
          position: standings.position,
          teamName: teams.name,
          shortName: teams.shortName,
          acronym: teams.acronym,
          points: standings.points,
          played: standings.played,
          won: standings.won,
          drawn: standings.drawn,
          lost: standings.lost,
          goalsFor: standings.goalsFor,
          goalsAgainst: standings.goalsAgainst,
          goalDifference: standings.goalDifference,
        })
        .from(standings)
        .innerJoin(teams, eq(standings.teamId, teams.id))
        .where(eq(standings.seasonId, seasonId))
        .orderBy(asc(standings.position));

      const header = "Posicao,Clube,Sigla,Pontos,Jogos,Vitorias,Empates,Derrotas,GolsPro,GolsContra,SaldoGols\n";
      const csvContent = rows
        .map(
          (r) =>
            `${r.position},"${r.shortName || r.teamName}","${r.acronym || ""}",${r.points},${r.played},${r.won},${r.drawn},${r.lost},${r.goalsFor},${r.goalsAgainst},${r.goalDifference}`
        )
        .join("\n");

      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="tabela_season_${seasonId}.csv"`);

      return `${header}${csvContent}`;
    }
  );

  // Exportar Jogadores e Scouts em CSV
  app.get(
    "/players",
    {
      schema: {
        tags: ["Exportação de Dados"],
        summary: "Exportar scouts e estatísticas de atletas em formato CSV",
        description: "Gera arquivo .csv para download com scouts completos de jogadores por liga ou temporada.",
        querystring: z.object({
          seasonId: z.coerce.number().default(1),
          limit: z.coerce.number().min(1).max(200).default(50),
        }),
      },
    },
    async (request, reply) => {
      const { seasonId, limit } = request.query;

      const rows = await db
        .select({
          id: players.id,
          name: players.knownName,
          firstName: players.firstName,
          lastName: players.lastName,
          position: players.primaryPosition,
          nationality: players.nationality,
          teamName: teams.shortName,
          appearances: playerSeasonStatistics.appearances,
          minutesPlayed: playerSeasonStatistics.minutesPlayed,
          goals: playerSeasonStatistics.goals,
          assists: playerSeasonStatistics.assists,
          rating: playerSeasonStatistics.rating,
          cleanSheets: playerSeasonStatistics.cleanSheets,
          saves: playerSeasonStatistics.saves,
          yellowCards: playerSeasonStatistics.yellowCards,
          redCards: playerSeasonStatistics.redCards,
        })
        .from(playerSeasonStatistics)
        .innerJoin(players, eq(playerSeasonStatistics.playerId, players.id))
        .innerJoin(teams, eq(playerSeasonStatistics.teamId, teams.id))
        .where(eq(playerSeasonStatistics.seasonId, seasonId))
        .orderBy(desc(playerSeasonStatistics.goals))
        .limit(limit);

      const header = "ID,Nome,Clube,Posicao,Nacionalidade,Jogos,Minutos,Gols,Assistencias,Nota,CleanSheets,Defesas,Amarelos,Vermelhos\n";
      const csvContent = rows
        .map((r) => {
          const playerName = r.name || `${r.firstName} ${r.lastName}`;
          return `${r.id},"${playerName}","${r.teamName || ""}","${r.position}","${r.nationality}",${r.appearances},${r.minutesPlayed},${r.goals},${r.assists},"${r.rating || "0.0"}",${r.cleanSheets},${r.saves},${r.yellowCards},${r.redCards}`;
        })
        .join("\n");

      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="scouts_atletas_season_${seasonId}.csv"`);

      return `${header}${csvContent}`;
    }
  );

  // Exportar Calendário de Partidas em CSV
  app.get(
    "/matches",
    {
      schema: {
        tags: ["Exportação de Dados"],
        summary: "Exportar calendário e resultados de partidas em formato CSV",
        description: "Gera arquivo .csv para download com todos os confrontos da temporada.",
        querystring: z.object({
          seasonId: z.coerce.number().default(1),
        }),
      },
    },
    async (request, reply) => {
      const { seasonId } = request.query;

      const rows = await db
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
        .where(eq(matches.seasonId, seasonId))
        .orderBy(asc(matches.kickoffTime));

      const teamIds = new Set<number>();
      for (const r of rows) {
        teamIds.add(r.homeTeamId);
        teamIds.add(r.awayTeamId);
      }

      const teamMap = new Map<number, string>();
      if (teamIds.size > 0) {
        const teamRows = await db.select().from(teams);
        for (const t of teamRows) {
          teamMap.set(t.id, t.shortName || t.name);
        }
      }

      const header = "ID,Rodada,DataHora,Mandante,PlacarMandante,PlacarVisitante,Visitante,Status\n";
      const csvContent = rows
        .map((r) => {
          const home = teamMap.get(r.homeTeamId) || `Time ${r.homeTeamId}`;
          const away = teamMap.get(r.awayTeamId) || `Time ${r.awayTeamId}`;
          return `${r.id},"${r.round || ""}","${r.kickoffTime ? r.kickoffTime.toISOString() : ""}","${home}",${r.homeScore ?? ""},${r.awayScore ?? ""},"${away}","${r.status}"`;
        })
        .join("\n");

      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="partidas_season_${seasonId}.csv"`);

      return `${header}${csvContent}`;
    }
  );
};
