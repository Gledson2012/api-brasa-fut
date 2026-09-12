import { db } from "../db/index.js";
import { standings, teams, matches, seasons } from "../db/schema.js";
import { eq, and, desc, asc } from "drizzle-orm";

export interface UserMatchPrediction {
  matchId: number;
  homeScore: number;
  awayScore: number;
}

export class SimulationService {
  static async simulateStandings(seasonId: number, userPredictions: UserMatchPrediction[] = []) {
    // 1. Obter tabela base oficial
    const baseRows = await db
      .select({
        id: standings.id,
        teamId: standings.teamId,
        teamName: teams.name,
        teamShortName: teams.shortName,
        teamAcronym: teams.acronym,
        teamLogoUrl: teams.logoUrl,
        position: standings.position,
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

    let rowsToUse = baseRows;
    let targetSeasonId = seasonId;

    if (rowsToUse.length === 0) {
      const anyRows = await db
        .select({
          id: standings.id,
          seasonId: standings.seasonId,
          teamId: standings.teamId,
          teamName: teams.name,
          teamShortName: teams.shortName,
          teamAcronym: teams.acronym,
          teamLogoUrl: teams.logoUrl,
          position: standings.position,
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
        .orderBy(asc(standings.position))
        .limit(20);

      if (anyRows.length > 0) {
        rowsToUse = anyRows;
        targetSeasonId = anyRows[0].seasonId;
      }
    }

    if (rowsToUse.length === 0) {
      return { seasonId, simulatedMatchesCount: 0, standings: [] };
    }

    // Mapear times para atualização
    const simMap = new Map(
      rowsToUse.map((r) => [
        r.teamId,
        {
          teamId: r.teamId,
          team: {
            id: r.teamId,
            name: r.teamName,
            shortName: r.teamShortName,
            acronym: r.teamAcronym,
            logoUrl: r.teamLogoUrl,
          },
          originalPosition: r.position,
          points: r.points,
          played: r.played,
          won: r.won,
          drawn: r.drawn,
          lost: r.lost,
          goalsFor: r.goalsFor,
          goalsAgainst: r.goalsAgainst,
          goalDifference: r.goalDifference,
        },
      ])
    );

    // 2. Processar palpites do usuário
    if (userPredictions.length > 0) {
      const matchIds = userPredictions.map((p) => p.matchId);
      const scheduledMatches = await db
        .select()
        .from(matches)
        .where(eq(matches.seasonId, seasonId));

      const matchMap = new Map(scheduledMatches.map((m) => [m.id, m]));

      for (const pred of userPredictions) {
        const m = matchMap.get(pred.matchId);
        if (!m) continue;

        const home = simMap.get(m.homeTeamId);
        const away = simMap.get(m.awayTeamId);
        const hs = Number(pred.homeScore);
        const as = Number(pred.awayScore);

        if (home) {
          home.played += 1;
          home.goalsFor += hs;
          home.goalsAgainst += as;
          home.goalDifference = home.goalsFor - home.goalsAgainst;
          if (hs > as) {
            home.points += 3;
            home.won += 1;
          } else if (hs === as) {
            home.points += 1;
            home.drawn += 1;
          } else {
            home.lost += 1;
          }
        }

        if (away) {
          away.played += 1;
          away.goalsFor += as;
          away.goalsAgainst += hs;
          away.goalDifference = away.goalsFor - away.goalsAgainst;
          if (as > hs) {
            away.points += 3;
            away.won += 1;
          } else if (as === hs) {
            away.points += 1;
            away.drawn += 1;
          } else {
            away.lost += 1;
          }
        }
      }
    }

    // 3. Ordenação oficial por critérios de desempate
    const sorted = Array.from(simMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.won !== a.won) return b.won - a.won;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    const leaderPoints = sorted[0]?.points || 1;
    const totalTeams = sorted.length;

    // 4. Calcular chances matemáticas aproximadas
    const results = sorted.map((row, index) => {
      const currentPos = index + 1;
      const movementDelta = row.originalPosition - currentPos;
      const movement = movementDelta > 0 ? "UP" : movementDelta < 0 ? "DOWN" : "SAME";

      // Probabilidades matemáticas projetadas
      const ptsDiffToLeader = leaderPoints - row.points;
      let championPct = 0;
      if (currentPos === 1) championPct = Math.max(55, Math.round(92 - ptsDiffToLeader * 8));
      else if (currentPos === 2) championPct = Math.max(10, Math.round(35 - ptsDiffToLeader * 5));
      else if (currentPos === 3) championPct = Math.max(2, Math.round(15 - ptsDiffToLeader * 3));
      championPct = Math.max(0, Math.min(99, championPct));

      let libertadoresPct = 0;
      if (currentPos <= 4) libertadoresPct = Math.max(70, Math.round(98 - currentPos * 5));
      else if (currentPos <= 6) libertadoresPct = Math.max(25, Math.round(60 - currentPos * 6));
      else if (currentPos <= 8) libertadoresPct = 12;
      libertadoresPct = Math.max(0, Math.min(100, libertadoresPct));

      let relegationPct = 0;
      if (currentPos >= totalTeams - 3) relegationPct = Math.max(65, Math.round(60 + (currentPos - (totalTeams - 4)) * 10));
      else if (currentPos >= totalTeams - 6) relegationPct = Math.max(15, Math.round(35 - (totalTeams - currentPos) * 4));
      relegationPct = Math.max(0, Math.min(100, relegationPct));

      return {
        currentPosition: currentPos,
        originalPosition: row.originalPosition,
        movement,
        movementDelta,
        team: row.team,
        points: row.points,
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        zone:
          currentPos <= 4
            ? "LIBERTADORES_GROUP"
            : currentPos <= 6
            ? "LIBERTADORES_QUALIFIERS"
            : currentPos <= 12
            ? "SUDAMERICANA"
            : currentPos >= totalTeams - 3
            ? "RELEGATION"
            : "NEUTRAL",
        probabilities: {
          championPct,
          libertadoresPct,
          sudamericanaPct: currentPos >= 7 && currentPos <= 14 ? 75 : 20,
          relegationPct,
        },
      };
    });

    return {
      seasonId,
      simulatedMatchesCount: userPredictions.length,
      standings: results,
    };
  }
}
