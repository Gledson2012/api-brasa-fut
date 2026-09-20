/**
 * BrasaFut API - Central de Pênaltis e Goleiros Pegadores
 * Estatísticas aprofundadas de cobranças de pênalti, zonas de chute e disputa de pênaltis
 */

export interface PenaltyTakerRanking {
  playerId: number;
  playerName: string;
  teamName: string;
  totalTaken: number;
  scored: number;
  missed: number;
  conversionRatePct: number;
  favoriteTargetZone: "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "TOP_LEFT" | "TOP_RIGHT" | "CENTER";
  pressurePenaltiesScored: number; // Pênaltis aos 85'+ ou em decisões
}

export interface GoalkeeperPenaltyRanking {
  playerId: number;
  goalkeeperName: string;
  teamName: string;
  penaltiesFaced: number;
  saves: number;
  conceded: number;
  offTargetOrPost: number;
  savePercentagePct: number;
  shootoutsWonCount: number;
}

export interface ShootoutKick {
  round: number;
  teamSide: "HOME" | "AWAY";
  kickerName: string;
  goalkeeperName: string;
  targetZone: "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "TOP_LEFT" | "TOP_RIGHT" | "CENTER";
  outcome: "SCORED" | "SAVED" | "MISSED";
  suddenDeath: boolean;
}

export interface MatchPenaltyShootoutReport {
  matchId: number;
  winnerTeam: string;
  finalScore: string;
  regularTimeScore: string;
  totalKicks: number;
  kicks: ShootoutKick[];
}

export class PenaltiesService {
  /**
   * Ranking de melhores cobradores de pênalti
   */
  public static getTopTakersRanking(limit: number = 10): PenaltyTakerRanking[] {
    const list: PenaltyTakerRanking[] = [
      { playerId: 1, playerName: "Raphael Veiga", teamName: "Palmeiras", totalTaken: 38, scored: 35, missed: 3, conversionRatePct: 92.1, favoriteTargetZone: "BOTTOM_RIGHT", pressurePenaltiesScored: 12 },
      { playerId: 2, playerName: "Hulk", teamName: "Atlético-MG", totalTaken: 42, scored: 37, missed: 5, conversionRatePct: 88.1, favoriteTargetZone: "TOP_LEFT", pressurePenaltiesScored: 14 },
      { playerId: 3, playerName: "Memphis Depay", teamName: "Corinthians", totalTaken: 35, scored: 31, missed: 4, conversionRatePct: 88.6, favoriteTargetZone: "BOTTOM_LEFT", pressurePenaltiesScored: 9 },
      { playerId: 4, playerName: "Pedro", teamName: "Flamengo", totalTaken: 28, scored: 25, missed: 3, conversionRatePct: 89.3, favoriteTargetZone: "BOTTOM_RIGHT", pressurePenaltiesScored: 8 },
      { playerId: 5, playerName: "Erling Haaland", teamName: "Manchester City", totalTaken: 46, scored: 41, missed: 5, conversionRatePct: 89.1, favoriteTargetZone: "BOTTOM_RIGHT", pressurePenaltiesScored: 11 },
      { playerId: 6, playerName: "Harry Kane", teamName: "Bayern de Munique", totalTaken: 82, scored: 73, missed: 9, conversionRatePct: 89.0, favoriteTargetZone: "BOTTOM_LEFT", pressurePenaltiesScored: 24 },
      { playerId: 7, playerName: "Robert Lewandowski", teamName: "Barcelona", totalTaken: 88, scored: 79, missed: 9, conversionRatePct: 89.8, favoriteTargetZone: "BOTTOM_RIGHT", pressurePenaltiesScored: 26 },
      { playerId: 8, playerName: "Kylian Mbappé", teamName: "Real Madrid", totalTaken: 52, scored: 44, missed: 8, conversionRatePct: 84.6, favoriteTargetZone: "BOTTOM_LEFT", pressurePenaltiesScored: 15 },
    ];

    return list.slice(0, limit);
  }

  /**
   * Ranking de melhores goleiros defensores de pênalti
   */
  public static getTopGoalkeepersRanking(limit: number = 10): GoalkeeperPenaltyRanking[] {
    const list: GoalkeeperPenaltyRanking[] = [
      { playerId: 11, goalkeeperName: "Weverton", teamName: "Palmeiras", penaltiesFaced: 62, saves: 18, conceded: 38, offTargetOrPost: 6, savePercentagePct: 29.0, shootoutsWonCount: 8 },
      { playerId: 12, goalkeeperName: "Hugo Souza", teamName: "Corinthians", penaltiesFaced: 32, saves: 11, conceded: 18, offTargetOrPost: 3, savePercentagePct: 34.4, shootoutsWonCount: 5 },
      { playerId: 13, goalkeeperName: "Agustín Rossi", teamName: "Flamengo", penaltiesFaced: 58, saves: 20, conceded: 33, offTargetOrPost: 5, savePercentagePct: 34.5, shootoutsWonCount: 9 },
      { playerId: 14, goalkeeperName: "Rafael", teamName: "São Paulo", penaltiesFaced: 40, saves: 12, conceded: 24, offTargetOrPost: 4, savePercentagePct: 30.0, shootoutsWonCount: 4 },
      { playerId: 15, goalkeeperName: "Emiliano Martínez", teamName: "Aston Villa", penaltiesFaced: 49, saves: 17, conceded: 27, offTargetOrPost: 5, savePercentagePct: 34.7, shootoutsWonCount: 6 },
      { playerId: 16, goalkeeperName: "Thibaut Courtois", teamName: "Real Madrid", penaltiesFaced: 65, saves: 19, conceded: 41, offTargetOrPost: 5, savePercentagePct: 29.2, shootoutsWonCount: 5 },
    ];

    return list.slice(0, limit);
  }

  /**
   * Disputa de pênaltis de uma partida de mata-mata
   */
  public static getMatchPenaltyShootout(matchId: number, homeTeam: string, awayTeam: string): MatchPenaltyShootoutReport {
    const seed = matchId;
    const homeWins = seed % 2 === 0;

    const kicks: ShootoutKick[] = [
      { round: 1, teamSide: "HOME", kickerName: "Cobrador 1 Mandante", goalkeeperName: "Goleiro Visitante", targetZone: "BOTTOM_LEFT", outcome: "SCORED", suddenDeath: false },
      { round: 1, teamSide: "AWAY", kickerName: "Cobrador 1 Visitante", goalkeeperName: "Goleiro Mandante", targetZone: "BOTTOM_RIGHT", outcome: "SCORED", suddenDeath: false },
      { round: 2, teamSide: "HOME", kickerName: "Cobrador 2 Mandante", goalkeeperName: "Goleiro Visitante", targetZone: "TOP_RIGHT", outcome: "SCORED", suddenDeath: false },
      { round: 2, teamSide: "AWAY", kickerName: "Cobrador 2 Visitante", goalkeeperName: "Goleiro Mandante", targetZone: "BOTTOM_LEFT", outcome: "SAVED", suddenDeath: false },
      { round: 3, teamSide: "HOME", kickerName: "Cobrador 3 Mandante", goalkeeperName: "Goleiro Visitante", targetZone: "BOTTOM_RIGHT", outcome: "SCORED", suddenDeath: false },
      { round: 3, teamSide: "AWAY", kickerName: "Cobrador 3 Visitante", goalkeeperName: "Goleiro Mandante", targetZone: "TOP_LEFT", outcome: "SCORED", suddenDeath: false },
      { round: 4, teamSide: "HOME", kickerName: "Cobrador 4 Mandante", goalkeeperName: "Goleiro Visitante", targetZone: "CENTER", outcome: homeWins ? "SCORED" : "SAVED", suddenDeath: false },
      { round: 4, teamSide: "AWAY", kickerName: "Cobrador 4 Visitante", goalkeeperName: "Goleiro Mandante", targetZone: "BOTTOM_RIGHT", outcome: "SCORED", suddenDeath: false },
      { round: 5, teamSide: "HOME", kickerName: "Cobrador 5 Mandante", goalkeeperName: "Goleiro Visitante", targetZone: "TOP_RIGHT", outcome: "SCORED", suddenDeath: false },
    ];

    if (!homeWins) {
      kicks.push({
        round: 5,
        teamSide: "AWAY",
        kickerName: "Cobrador 5 Visitante",
        goalkeeperName: "Goleiro Mandante",
        targetZone: "BOTTOM_LEFT",
        outcome: "SCORED",
        suddenDeath: false,
      });
    }

    return {
      matchId,
      winnerTeam: homeWins ? homeTeam : awayTeam,
      finalScore: homeWins ? "5 x 4" : "4 x 5",
      regularTimeScore: "1 x 1",
      totalKicks: kicks.length,
      kicks,
    };
  }
}
