/**
 * BrasaFut API - Match Box Score Service
 * Motor de Scouts Individuais por Jogador estilo NBA / Opta / Sofascore
 */

export interface PlayerBoxScoreStats {
  goals: number;
  assists: number;
  expectedGoals: number;
  expectedAssists: number;
  shotsTotal: number;
  shotsOnTarget: number;
  passesTotal: number;
  passesAccurate: number;
  passAccuracyPct: number;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  clearances: number;
  duelsWon: number;
  duelsTotal: number;
  foulsCommitted: number;
  foulsSuffered: number;
  yellowCards: number;
  redCards: number;
  saves?: number;
  goalsConceded?: number;
}

export interface PlayerBoxScoreItem {
  id: number;
  name: string;
  fullName?: string;
  shirtNumber: number;
  position: "Goalkeeper" | "Defender" | "Midfielder" | "Forward";
  isCaptain: boolean;
  isSubstitute: boolean;
  minutesPlayed: number;
  rating: number; // Nota de 0.0 a 10.0
  statistics: PlayerBoxScoreStats;
}

export interface TeamBoxScoreSummary {
  teamId: number;
  teamName: string;
  score: number;
  manager: string;
  formation: string;
  teamStatsSummary: {
    averageRating: number;
    totalPasses: number;
    accuratePasses: number;
    possessionPct: number;
    totalShots: number;
    shotsOnTarget: number;
    totalTackles: number;
  };
  players: PlayerBoxScoreItem[];
}

export interface MatchBoxScoreResult {
  matchId: number;
  status: string;
  venue?: string;
  homeTeam: TeamBoxScoreSummary;
  awayTeam: TeamBoxScoreSummary;
  mvp: {
    playerId: number;
    playerName: string;
    teamName: string;
    rating: number;
    reason: string;
  };
}

export class BoxScoreService {
  /**
   * Gera o relatório completo de Box Score de uma partida
   */
  public static getMatchBoxScore(
    matchId: number,
    homeTeam: { id: number; name: string },
    awayTeam: { id: number; name: string }
  ): MatchBoxScoreResult {
    const hName = homeTeam.name;
    const aName = awayTeam.name;

    const homePlayers: PlayerBoxScoreItem[] = [
      {
        id: 101,
        name: "Rossi",
        fullName: "Agustín Rossi",
        shirtNumber: 1,
        position: "Goalkeeper",
        isCaptain: false,
        isSubstitute: false,
        minutesPlayed: 90,
        rating: 7.4,
        statistics: {
          goals: 0,
          assists: 0,
          expectedGoals: 0,
          expectedAssists: 0,
          shotsTotal: 0,
          shotsOnTarget: 0,
          passesTotal: 34,
          passesAccurate: 29,
          passAccuracyPct: 85.3,
          keyPasses: 0,
          tackles: 0,
          interceptions: 1,
          clearances: 4,
          duelsWon: 2,
          duelsTotal: 2,
          foulsCommitted: 0,
          foulsSuffered: 1,
          yellowCards: 0,
          redCards: 0,
          saves: 4,
          goalsConceded: 1,
        },
      },
      {
        id: 102,
        name: "Léo Ortiz",
        fullName: "Leonardo Ortiz",
        shirtNumber: 3,
        position: "Defender",
        isCaptain: true,
        isSubstitute: false,
        minutesPlayed: 90,
        rating: 7.9,
        statistics: {
          goals: 0,
          assists: 1,
          expectedGoals: 0.08,
          expectedAssists: 0.35,
          shotsTotal: 1,
          shotsOnTarget: 0,
          passesTotal: 68,
          passesAccurate: 63,
          passAccuracyPct: 92.6,
          keyPasses: 2,
          tackles: 4,
          interceptions: 3,
          clearances: 6,
          duelsWon: 8,
          duelsTotal: 10,
          foulsCommitted: 1,
          foulsSuffered: 2,
          yellowCards: 0,
          redCards: 0,
        },
      },
      {
        id: 103,
        name: "Léo Pereira",
        fullName: "Leonardo Pereira",
        shirtNumber: 4,
        position: "Defender",
        isCaptain: false,
        isSubstitute: false,
        minutesPlayed: 90,
        rating: 7.2,
        statistics: {
          goals: 0,
          assists: 0,
          expectedGoals: 0.04,
          expectedAssists: 0.05,
          shotsTotal: 1,
          shotsOnTarget: 0,
          passesTotal: 58,
          passesAccurate: 52,
          passAccuracyPct: 89.6,
          keyPasses: 0,
          tackles: 2,
          interceptions: 2,
          clearances: 5,
          duelsWon: 6,
          duelsTotal: 9,
          foulsCommitted: 2,
          foulsSuffered: 1,
          yellowCards: 1,
          redCards: 0,
        },
      },
      {
        id: 104,
        name: "Gerson",
        fullName: "Gerson Santos da Silva",
        shirtNumber: 8,
        position: "Midfielder",
        isCaptain: false,
        isSubstitute: false,
        minutesPlayed: 90,
        rating: 8.5,
        statistics: {
          goals: 1,
          assists: 1,
          expectedGoals: 0.45,
          expectedAssists: 0.62,
          shotsTotal: 3,
          shotsOnTarget: 2,
          passesTotal: 74,
          passesAccurate: 69,
          passAccuracyPct: 93.2,
          keyPasses: 4,
          tackles: 3,
          interceptions: 2,
          clearances: 1,
          duelsWon: 11,
          duelsTotal: 14,
          foulsCommitted: 1,
          foulsSuffered: 4,
          yellowCards: 0,
          redCards: 0,
        },
      },
      {
        id: 105,
        name: "De La Cruz",
        fullName: "Nicolás De La Cruz",
        shirtNumber: 18,
        position: "Midfielder",
        isCaptain: false,
        isSubstitute: false,
        minutesPlayed: 78,
        rating: 7.7,
        statistics: {
          goals: 0,
          assists: 0,
          expectedGoals: 0.15,
          expectedAssists: 0.28,
          shotsTotal: 2,
          shotsOnTarget: 1,
          passesTotal: 51,
          passesAccurate: 44,
          passAccuracyPct: 86.3,
          keyPasses: 3,
          tackles: 5,
          interceptions: 1,
          clearances: 0,
          duelsWon: 7,
          duelsTotal: 12,
          foulsCommitted: 3,
          foulsSuffered: 2,
          yellowCards: 1,
          redCards: 0,
        },
      },
      {
        id: 106,
        name: "Pedro",
        fullName: "Pedro Guilherme",
        shirtNumber: 9,
        position: "Forward",
        isCaptain: false,
        isSubstitute: false,
        minutesPlayed: 85,
        rating: 8.1,
        statistics: {
          goals: 1,
          assists: 0,
          expectedGoals: 0.72,
          expectedAssists: 0.12,
          shotsTotal: 4,
          shotsOnTarget: 3,
          passesTotal: 22,
          passesAccurate: 18,
          passAccuracyPct: 81.8,
          keyPasses: 1,
          tackles: 0,
          interceptions: 0,
          clearances: 1,
          duelsWon: 5,
          duelsTotal: 9,
          foulsCommitted: 1,
          foulsSuffered: 2,
          yellowCards: 0,
          redCards: 0,
        },
      },
      {
        id: 107,
        name: "Luiz Araújo",
        fullName: "Luiz Araújo Guimarães",
        shirtNumber: 7,
        position: "Forward",
        isSubstitute: true,
        isCaptain: false,
        minutesPlayed: 22,
        rating: 6.8,
        statistics: {
          goals: 0,
          assists: 0,
          expectedGoals: 0.11,
          expectedAssists: 0.18,
          shotsTotal: 1,
          shotsOnTarget: 0,
          passesTotal: 14,
          passesAccurate: 11,
          passAccuracyPct: 78.6,
          keyPasses: 1,
          tackles: 1,
          interceptions: 0,
          clearances: 0,
          duelsWon: 3,
          duelsTotal: 5,
          foulsCommitted: 0,
          foulsSuffered: 1,
          yellowCards: 0,
          redCards: 0,
        },
      },
    ];

    const awayPlayers: PlayerBoxScoreItem[] = [
      {
        id: 201,
        name: "Weverton",
        fullName: "Weverton Pereira da Silva",
        shirtNumber: 21,
        position: "Goalkeeper",
        isCaptain: false,
        isSubstitute: false,
        minutesPlayed: 90,
        rating: 7.1,
        statistics: {
          goals: 0,
          assists: 0,
          expectedGoals: 0,
          expectedAssists: 0,
          shotsTotal: 0,
          shotsOnTarget: 0,
          passesTotal: 30,
          passesAccurate: 22,
          passAccuracyPct: 73.3,
          keyPasses: 0,
          tackles: 0,
          interceptions: 0,
          clearances: 3,
          duelsWon: 1,
          duelsTotal: 1,
          foulsCommitted: 0,
          foulsSuffered: 0,
          yellowCards: 0,
          redCards: 0,
          saves: 5,
          goalsConceded: 2,
        },
      },
      {
        id: 202,
        name: "Gustavo Gómez",
        fullName: "Gustavo Gómez Portillo",
        shirtNumber: 15,
        position: "Defender",
        isCaptain: true,
        isSubstitute: false,
        minutesPlayed: 90,
        rating: 7.0,
        statistics: {
          goals: 0,
          assists: 0,
          expectedGoals: 0.12,
          expectedAssists: 0.04,
          shotsTotal: 1,
          shotsOnTarget: 1,
          passesTotal: 49,
          passesAccurate: 42,
          passAccuracyPct: 85.7,
          keyPasses: 0,
          tackles: 3,
          interceptions: 4,
          clearances: 7,
          duelsWon: 9,
          duelsTotal: 13,
          foulsCommitted: 2,
          foulsSuffered: 1,
          yellowCards: 1,
          redCards: 0,
        },
      },
      {
        id: 203,
        name: "Raphael Veiga",
        fullName: "Raphael Cavalcante Veiga",
        shirtNumber: 23,
        position: "Midfielder",
        isCaptain: false,
        isSubstitute: false,
        minutesPlayed: 82,
        rating: 7.6,
        statistics: {
          goals: 1,
          assists: 0,
          expectedGoals: 0.58,
          expectedAssists: 0.32,
          shotsTotal: 3,
          shotsOnTarget: 2,
          passesTotal: 42,
          passesAccurate: 36,
          passAccuracyPct: 85.7,
          keyPasses: 3,
          tackles: 1,
          interceptions: 1,
          clearances: 0,
          duelsWon: 4,
          duelsTotal: 8,
          foulsCommitted: 1,
          foulsSuffered: 3,
          yellowCards: 0,
          redCards: 0,
        },
      },
      {
        id: 204,
        name: "Flaco López",
        fullName: "José Manuel López",
        shirtNumber: 42,
        position: "Forward",
        isCaptain: false,
        isSubstitute: false,
        minutesPlayed: 75,
        rating: 6.9,
        statistics: {
          goals: 0,
          assists: 1,
          expectedGoals: 0.29,
          expectedAssists: 0.40,
          shotsTotal: 2,
          shotsOnTarget: 1,
          passesTotal: 18,
          passesAccurate: 13,
          passAccuracyPct: 72.2,
          keyPasses: 2,
          tackles: 1,
          interceptions: 0,
          clearances: 2,
          duelsWon: 6,
          duelsTotal: 12,
          foulsCommitted: 2,
          foulsSuffered: 1,
          yellowCards: 0,
          redCards: 0,
        },
      },
      {
        id: 205,
        name: "Estêvão",
        fullName: "Estêvão Willian",
        shirtNumber: 41,
        position: "Forward",
        isSubstitute: true,
        isCaptain: false,
        minutesPlayed: 25,
        rating: 7.3,
        statistics: {
          goals: 0,
          assists: 0,
          expectedGoals: 0.18,
          expectedAssists: 0.22,
          shotsTotal: 2,
          shotsOnTarget: 1,
          passesTotal: 15,
          passesAccurate: 13,
          passAccuracyPct: 86.7,
          keyPasses: 2,
          tackles: 1,
          interceptions: 0,
          clearances: 0,
          duelsWon: 5,
          duelsTotal: 7,
          foulsCommitted: 0,
          foulsSuffered: 2,
          yellowCards: 0,
          redCards: 0,
        },
      },
    ];

    return {
      matchId,
      status: "FINISHED",
      venue: "Maracanã, Rio de Janeiro",
      homeTeam: {
        teamId: homeTeam.id,
        teamName: hName,
        score: 2,
        manager: "Filipe Luís",
        formation: "4-2-3-1",
        teamStatsSummary: {
          averageRating: 7.6,
          totalPasses: 321,
          accuratePasses: 286,
          possessionPct: 56,
          totalShots: 13,
          shotsOnTarget: 7,
          totalTackles: 16,
        },
        players: homePlayers,
      },
      awayTeam: {
        teamId: awayTeam.id,
        teamName: aName,
        score: 1,
        manager: "Abel Ferreira",
        formation: "4-3-3",
        teamStatsSummary: {
          averageRating: 7.2,
          totalPasses: 255,
          accuratePasses: 218,
          possessionPct: 44,
          totalShots: 9,
          shotsOnTarget: 5,
          totalTackles: 12,
        },
        players: awayPlayers,
      },
      mvp: {
        playerId: 104,
        playerName: "Gerson",
        teamName: hName,
        rating: 8.5,
        reason: "1 gol, 1 assistência, 4 passes-chave e 93% de precisão nos passes durante 90 minutos.",
      },
    };
  }
}
