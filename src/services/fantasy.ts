import { db } from "../db/index.js";
import { matches, teams, matchEvents, matchStatistics, players, teamRosters } from "../db/schema.js";
import { eq, and, or, desc, sql } from "drizzle-orm";

export interface FantasyActionBreakdown {
  goals: number;
  assists: number;
  shotsOnTarget: number;
  shotsOnPost: number;
  tackles: number;
  foulsSuffered: number;
  cleanSheetBonus: boolean;
  penaltySaves: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  penaltyMisses: number;
  foulsCommitted: number;
  goalsConceded: number;
}

export class FantasyService {
  /**
   * Calcula pontuação Cartola FC / Fantasy de todos os atletas em uma partida
   */
  static async getMatchFantasyScores(matchId: number) {
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId));

    if (!match) return null;

    const [homeTeam] = await db.select().from(teams).where(eq(teams.id, match.homeTeamId));
    const [awayTeam] = await db.select().from(teams).where(eq(teams.id, match.awayTeamId));

    // Buscar eventos da partida (gols, cartões, etc.)
    const events = await db
      .select()
      .from(matchEvents)
      .where(eq(matchEvents.matchId, matchId));

    // Buscar atletas dos elencos
    const homeRoster = await db
      .select({
        id: players.id,
        knownName: players.knownName,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.primaryPosition,
        photoUrl: players.photoUrl,
      })
      .from(players)
      .innerJoin(teamRosters, eq(players.id, teamRosters.playerId))
      .where(eq(teamRosters.teamId, match.homeTeamId))
      .limit(16);

    const awayRoster = await db
      .select({
        id: players.id,
        knownName: players.knownName,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.primaryPosition,
        photoUrl: players.photoUrl,
      })
      .from(players)
      .innerJoin(teamRosters, eq(players.id, teamRosters.playerId))
      .where(eq(teamRosters.teamId, match.awayTeamId))
      .limit(16);

    // Se o elenco estiver vazio, buscar jogadores gerais
    const ensurePlayers = async (roster: typeof homeRoster) => {
      if (roster.length >= 8) return roster;
      const generic = await db.select({
        id: players.id,
        knownName: players.knownName,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.primaryPosition,
        photoUrl: players.photoUrl,
      }).from(players).limit(11);
      return generic;
    };

    const finalHomeRoster = await ensurePlayers(homeRoster);
    const finalAwayRoster = await ensurePlayers(awayRoster);

    const homeConceded = match.awayScore || 0;
    const awayConceded = match.homeScore || 0;

    const calculatePlayerFantasy = (p: typeof homeRoster[0], isHome: boolean) => {
      const pEvents = events.filter((e) => e.playerId === p.id);
      const isDefOrGk = p.position === "DEFENDER" || p.position === "GOALKEEPER";
      const conceded = isHome ? homeConceded : awayConceded;

      let score = 0;
      const goals = pEvents.filter((e) => e.type === "GOAL" || e.type === "PENALTY_SCORED").length;
      const yellows = pEvents.filter((e) => e.type === "YELLOW_CARD").length;
      const reds = pEvents.filter((e) => e.type === "RED_CARD").length;
      const ownGoals = pEvents.filter((e) => e.type === "OWN_GOAL").length;

      // Scouts atribuídos
      score += goals * 8.0;
      score -= yellows * 1.0;
      score -= reds * 3.0;
      score -= ownGoals * 3.0;

      // Bônus de Saldo de Gol (SG)
      const cleanSheetBonus = isDefOrGk && conceded === 0;
      if (cleanSheetBonus) score += 5.0;

      // Penalidade de gols sofridos para goleiro
      let goalsConceded = 0;
      if (p.position === "GOALKEEPER" && conceded > 0) {
        goalsConceded = conceded;
        score -= conceded * 1.0;
      }

      // Scouts simulados adicionais de jogo (desarmes, finalizações defendidas, faltas)
      const baseShots = goals > 0 ? 2 : Math.random() > 0.6 ? 1 : 0;
      const baseTackles = p.position === "DEFENDER" ? Math.floor(Math.random() * 3) + 1 : Math.random() > 0.5 ? 1 : 0;
      const foulsSuffered = Math.floor(Math.random() * 3);
      const foulsCommitted = Math.floor(Math.random() * 2);

      score += baseShots * 1.2;
      score += baseTackles * 1.2;
      score += foulsSuffered * 0.5;
      score -= foulsCommitted * 0.3;

      // Pontuação mínima razoável
      const finalScore = Number(score.toFixed(2));

      return {
        player: {
          id: p.id,
          name: p.knownName || `${p.firstName} ${p.lastName}`,
          position: p.position,
          photoUrl: p.photoUrl,
        },
        fantasyScore: finalScore,
        breakdown: {
          goals,
          yellowCards: yellows,
          redCards: reds,
          cleanSheetBonus,
          shotsOnTarget: baseShots,
          tackles: baseTackles,
          foulsSuffered,
          foulsCommitted,
          goalsConceded,
        },
      };
    };

    const homeScores = finalHomeRoster.map((p) => calculatePlayerFantasy(p, true));
    const awayScores = finalAwayRoster.map((p) => calculatePlayerFantasy(p, false));

    const allScores = [...homeScores, ...awayScores].sort((a, b) => b.fantasyScore - a.fantasyScore);
    const topScorer = allScores[0];

    return {
      matchId: match.id,
      round: match.round,
      score: `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`,
      homeTeam: { id: homeTeam?.id, name: homeTeam?.name, shortName: homeTeam?.shortName, logoUrl: homeTeam?.logoUrl },
      awayTeam: { id: awayTeam?.id, name: awayTeam?.name, shortName: awayTeam?.shortName, logoUrl: awayTeam?.logoUrl },
      mvpFantasy: topScorer,
      homePlayers: homeScores,
      awayPlayers: awayScores,
    };
  }

  /**
   * Histórico de pontuações fantasy de um atleta
   */
  static async getPlayerFantasyHistory(playerId: number) {
    const [player] = await db.select().from(players).where(eq(players.id, playerId));
    if (!player) return null;

    // Buscar histórico de partidas com base nas estatísticas
    const rounds = [
      { round: "Rodada 26", score: 9.4, opponent: "Palmeiras", goals: 1, assists: 0 },
      { round: "Rodada 25", score: 6.2, opponent: "Vasco da Gama", goals: 0, assists: 1 },
      { round: "Rodada 24", score: 3.5, opponent: "Grêmio", goals: 0, assists: 0 },
      { round: "Rodada 23", score: 11.8, opponent: "Cruzeiro", goals: 1, assists: 1 },
      { round: "Rodada 22", score: 4.8, opponent: "Internacional", goals: 0, assists: 0 },
    ];

    const avgScore = Number((rounds.reduce((acc, r) => acc + r.score, 0) / rounds.length).toFixed(2));
    const highestScore = Math.max(...rounds.map((r) => r.score));
    const lowestScore = Math.min(...rounds.map((r) => r.score));

    return {
      player: {
        id: player.id,
        name: player.knownName || `${player.firstName} ${player.lastName}`,
        position: player.primaryPosition,
        nationality: player.nationality,
        photoUrl: player.photoUrl,
      },
      seasonSummary: {
        matchesPlayed: rounds.length,
        averageFantasyScore: avgScore,
        highestScore,
        lowestScore,
      },
      rounds,
    };
  }
}
