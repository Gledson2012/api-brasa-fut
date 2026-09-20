/**
 * BrasaFut API - Individual Awards & Season Hall of Fame
 * Premiações oficiais, Corrida para Craque do Campeonato (Bola de Ouro) e Seleção do Ano
 */

export interface AwardCandidate {
  rank: number;
  playerId: number;
  playerName: string;
  teamName: string;
  teamLogoUrl?: string;
  position: string;
  averageRating: number;
  goals: number;
  assists: number;
  keyMomentsCount: number;
  votingPercentagePct: number;
}

export interface SeasonAwardsSummary {
  competitionId: number;
  seasonName: string;
  playerOfTheSeason: AwardCandidate;
  goldenBoyRevelacao: AwardCandidate;
  goldenGloveGoalkeeper: {
    playerId: number;
    goalkeeperName: string;
    teamName: string;
    cleanSheets: number;
    savePercentagePct: number;
  };
  coachOfTheSeason: {
    coachName: string;
    teamName: string;
    pointsWon: number;
    trophies: string[];
  };
  ballonDorRanking: AwardCandidate[];
  idealStartingEleven: {
    formation: string;
    eleven: {
      position: string;
      name: string;
      team: string;
      rating: number;
    }[];
  };
}

export class AwardsService {
  /**
   * Obtém a corrida oficial pelas premiações individuais da temporada
   */
  public static getSeasonAwards(competitionId: number = 1): SeasonAwardsSummary {
    const ranking: AwardCandidate[] = [
      {
        rank: 1,
        playerId: 1,
        playerName: "Pedro",
        teamName: "Flamengo",
        teamLogoUrl: "https://api.sofascore.app/api/v1/team/5981/image",
        position: "FORWARD",
        averageRating: 7.94,
        goals: 24,
        assists: 8,
        keyMomentsCount: 32,
        votingPercentagePct: 41.5,
      },
      {
        rank: 2,
        playerId: 2,
        playerName: "Raphael Veiga",
        teamName: "Palmeiras",
        teamLogoUrl: "https://api.sofascore.app/api/v1/team/1963/image",
        position: "MIDFIELDER",
        averageRating: 7.82,
        goals: 16,
        assists: 14,
        keyMomentsCount: 30,
        votingPercentagePct: 27.8,
      },
      {
        rank: 3,
        playerId: 3,
        playerName: "Lucas Moura",
        teamName: "São Paulo",
        teamLogoUrl: "https://api.sofascore.app/api/v1/team/1981/image",
        position: "FORWARD",
        averageRating: 7.76,
        goals: 13,
        assists: 11,
        keyMomentsCount: 24,
        votingPercentagePct: 15.2,
      },
      {
        rank: 4,
        playerId: 4,
        playerName: "Memphis Depay",
        teamName: "Corinthians",
        teamLogoUrl: "https://api.sofascore.app/api/v1/team/1957/image",
        position: "FORWARD",
        averageRating: 7.71,
        goals: 14,
        assists: 9,
        keyMomentsCount: 23,
        votingPercentagePct: 10.1,
      },
      {
        rank: 5,
        playerId: 5,
        playerName: "Hulk",
        teamName: "Atlético-MG",
        teamLogoUrl: "https://api.sofascore.app/api/v1/team/1977/image",
        position: "FORWARD",
        averageRating: 7.68,
        goals: 17,
        assists: 7,
        keyMomentsCount: 24,
        votingPercentagePct: 5.4,
      },
    ];

    const revelacao: AwardCandidate = {
      rank: 1,
      playerId: 99,
      playerName: "Estêvão",
      teamName: "Palmeiras",
      teamLogoUrl: "https://api.sofascore.app/api/v1/team/1963/image",
      position: "FORWARD",
      averageRating: 7.78,
      goals: 12,
      assists: 8,
      keyMomentsCount: 20,
      votingPercentagePct: 62.0,
    };

    return {
      competitionId,
      seasonName: "2026",
      playerOfTheSeason: ranking[0],
      goldenBoyRevelacao: revelacao,
      goldenGloveGoalkeeper: {
        playerId: 12,
        goalkeeperName: "Agustín Rossi",
        teamName: "Flamengo",
        cleanSheets: 18,
        savePercentagePct: 81.4,
      },
      coachOfTheSeason: {
        coachName: "Filipe Luís",
        teamName: "Flamengo",
        pointsWon: 74,
        trophies: ["Copa do Brasil 2024", "Supercopa do Brasil 2025"],
      },
      ballonDorRanking: ranking,
      idealStartingEleven: {
        formation: "4-3-3",
        eleven: [
          { position: "GK", name: "Agustín Rossi", team: "Flamengo", rating: 7.6 },
          { position: "RB", name: "William", team: "Cruzeiro", rating: 7.4 },
          { position: "CB", name: "Murilo", team: "Palmeiras", rating: 7.5 },
          { position: "CB", name: "Léo Ortiz", team: "Flamengo", rating: 7.6 },
          { position: "LB", name: "Guilherme Arana", team: "Atlético-MG", rating: 7.5 },
          { position: "DM", name: "Aníbal Moreno", team: "Palmeiras", rating: 7.6 },
          { position: "CM", name: "Gerson", team: "Flamengo", rating: 7.8 },
          { position: "AM", name: "Raphael Veiga", team: "Palmeiras", rating: 7.9 },
          { position: "RW", name: "Estêvão", team: "Palmeiras", rating: 7.8 },
          { position: "ST", name: "Pedro", team: "Flamengo", rating: 8.2 },
          { position: "LW", name: "Lucas Moura", team: "São Paulo", rating: 7.8 },
        ],
      },
    };
  }
}
