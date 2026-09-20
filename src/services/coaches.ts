/**
 * BrasaFut API - Central de Treinadores e Comissões Técnicas
 * Serviço para perfis de técnicos, histórico de carreira, títulos e aproveitamento tático
 */

export interface CoachCareerEntry {
  clubName: string;
  clubLogoUrl?: string;
  startDate: string;
  endDate: string | "ATUAL";
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  winPercentage: number;
  trophiesWon: string[];
}

export interface CoachProfile {
  id: number;
  name: string;
  shortName: string;
  nationality: string;
  countryFlag: string;
  age: number;
  photoUrl: string;
  status: "ACTIVE" | "AVAILABLE";
  currentTeam?: {
    id: number;
    name: string;
    shortName: string;
    logoUrl?: string;
    appointmentDate: string;
    contractUntil: string;
  };
  tacticalDNA: {
    preferredFormation: string;
    style: string;
    possessionFocus: "HIGH" | "BALANCED" | "COUNTER_ATTACK";
    pressingIntensity: "HIGH" | "MEDIUM" | "LOW";
  };
  overallStats: {
    totalMatches: number;
    wins: number;
    draws: number;
    losses: number;
    winPercentage: number;
    pointsPerMatch: number;
    yellowCardsTotal: number;
    redCardsTotal: number;
  };
  trophiesCount: number;
  majorHonors: string[];
  careerHistory: CoachCareerEntry[];
}

export const COACHES_DATABASE: CoachProfile[] = [
  {
    id: 1,
    name: "Filipe Luís Kasmirski",
    shortName: "Filipe Luís",
    nationality: "Brasil",
    countryFlag: "🇧🇷",
    age: 40,
    photoUrl: "https://api.sofascore.app/api/v1/manager/80512/image",
    status: "ACTIVE",
    currentTeam: {
      id: 1,
      name: "Clube de Regatas do Flamengo",
      shortName: "Flamengo",
      logoUrl: "https://api.sofascore.app/api/v1/team/5981/image",
      appointmentDate: "2024-09-30",
      contractUntil: "2026-12-31",
    },
    tacticalDNA: {
      preferredFormation: "4-2-3-1",
      style: "Ataque posicional agressivo com amplitude total dos pontas",
      possessionFocus: "HIGH",
      pressingIntensity: "HIGH",
    },
    overallStats: {
      totalMatches: 84,
      wins: 55,
      draws: 18,
      losses: 11,
      winPercentage: 72.6,
      pointsPerMatch: 2.18,
      yellowCardsTotal: 14,
      redCardsTotal: 1,
    },
    trophiesCount: 3,
    majorHonors: [
      "Copa do Brasil 2024",
      "Supercopa do Brasil 2025",
      "Campeonato Carioca 2025",
    ],
    careerHistory: [
      {
        clubName: "Flamengo Sub-20",
        startDate: "2024-06-15",
        endDate: "2024-09-29",
        matches: 17,
        wins: 11,
        draws: 4,
        losses: 2,
        winPercentage: 72.5,
        trophiesWon: ["Copa Intercontinental Sub-20 2024"],
      },
      {
        clubName: "Flamengo Profissional",
        startDate: "2024-09-30",
        endDate: "ATUAL",
        matches: 67,
        wins: 44,
        draws: 14,
        losses: 9,
        winPercentage: 72.6,
        trophiesWon: ["Copa do Brasil 2024", "Supercopa do Brasil 2025"],
      },
    ],
  },
  {
    id: 2,
    name: "Abel Fernando Moreira Ferreira",
    shortName: "Abel Ferreira",
    nationality: "Portugal",
    countryFlag: "🇵🇹",
    age: 47,
    photoUrl: "https://api.sofascore.app/api/v1/manager/787948/image",
    status: "ACTIVE",
    currentTeam: {
      id: 2,
      name: "Sociedade Esportiva Palmeiras",
      shortName: "Palmeiras",
      logoUrl: "https://api.sofascore.app/api/v1/team/1963/image",
      appointmentDate: "2020-11-04",
      contractUntil: "2027-12-31",
    },
    tacticalDNA: {
      preferredFormation: "3-4-2-1",
      style: "Transição ofensiva letal com solidez defensiva pragmática",
      possessionFocus: "BALANCED",
      pressingIntensity: "HIGH",
    },
    overallStats: {
      totalMatches: 312,
      wins: 184,
      draws: 73,
      losses: 55,
      winPercentage: 66.8,
      pointsPerMatch: 2.00,
      yellowCardsTotal: 62,
      redCardsTotal: 9,
    },
    trophiesCount: 10,
    majorHonors: [
      "CONMEBOL Libertadores 2020",
      "CONMEBOL Libertadores 2021",
      "Brasileirão Série A 2022",
      "Brasileirão Série A 2023",
      "Copa do Brasil 2020",
      "Recopa Sul-Americana 2022",
      "Supercopa do Brasil 2023",
      "Campeonato Paulista 2022",
      "Campeonato Paulista 2023",
      "Campeonato Paulista 2024",
    ],
    careerHistory: [
      {
        clubName: "Sporting Braga",
        startDate: "2017-04-26",
        endDate: "2019-06-30",
        matches: 102,
        wins: 62,
        draws: 15,
        losses: 25,
        winPercentage: 65.7,
        trophiesWon: [],
      },
      {
        clubName: "PAOK Salonica",
        startDate: "2019-07-01",
        endDate: "2020-10-30",
        matches: 57,
        wins: 31,
        draws: 16,
        losses: 10,
        winPercentage: 63.7,
        trophiesWon: [],
      },
      {
        clubName: "Palmeiras",
        startDate: "2020-11-04",
        endDate: "ATUAL",
        matches: 312,
        wins: 184,
        draws: 73,
        losses: 55,
        winPercentage: 66.8,
        trophiesWon: [
          "2x CONMEBOL Libertadores",
          "2x Brasileirão Série A",
          "1x Copa do Brasil",
          "3x Campeonato Paulista",
        ],
      },
    ],
  },
  {
    id: 3,
    name: "Luis Francisco Zubeldía",
    shortName: "Luis Zubeldía",
    nationality: "Argentina",
    countryFlag: "🇦🇷",
    age: 45,
    photoUrl: "https://api.sofascore.app/api/v1/manager/52311/image",
    status: "ACTIVE",
    currentTeam: {
      id: 3,
      name: "São Paulo Futebol Clube",
      shortName: "São Paulo",
      logoUrl: "https://api.sofascore.app/api/v1/team/1981/image",
      appointmentDate: "2024-04-20",
      contractUntil: "2026-12-31",
    },
    tacticalDNA: {
      preferredFormation: "4-2-3-1",
      style: "Intensidade alta de duelos físicos e ataque pelos flancos",
      possessionFocus: "BALANCED",
      pressingIntensity: "HIGH",
    },
    overallStats: {
      totalMatches: 198,
      wins: 105,
      draws: 51,
      losses: 42,
      winPercentage: 61.6,
      pointsPerMatch: 1.85,
      yellowCardsTotal: 41,
      redCardsTotal: 6,
    },
    trophiesCount: 2,
    majorHonors: [
      "CONMEBOL Sul-Americana 2023 (LDU)",
      "Liga Pro Ecuador 2023 (LDU)",
    ],
    careerHistory: [
      {
        clubName: "LDU Quito",
        startDate: "2022-04-22",
        endDate: "2023-12-31",
        matches: 71,
        wins: 40,
        draws: 22,
        losses: 9,
        winPercentage: 66.7,
        trophiesWon: ["CONMEBOL Sul-Americana 2023", "Liga Pro 2023"],
      },
      {
        clubName: "São Paulo",
        startDate: "2024-04-20",
        endDate: "ATUAL",
        matches: 82,
        wins: 43,
        draws: 21,
        losses: 18,
        winPercentage: 61.0,
        trophiesWon: [],
      },
    ],
  },
  {
    id: 4,
    name: "Artur Jorge Torres Gomes Araújo Amorim",
    shortName: "Artur Jorge",
    nationality: "Portugal",
    countryFlag: "🇵🇹",
    age: 54,
    photoUrl: "https://api.sofascore.app/api/v1/manager/787949/image",
    status: "ACTIVE",
    currentTeam: {
      id: 5,
      name: "Botafogo de Futebol e Regatas",
      shortName: "Botafogo",
      logoUrl: "https://api.sofascore.app/api/v1/team/1958/image",
      appointmentDate: "2024-04-05",
      contractUntil: "2026-12-31",
    },
    tacticalDNA: {
      preferredFormation: "4-2-2-2",
      style: "Futebol ofensivo vertiginoso com dois meias de ruptura e dois centroavantes",
      possessionFocus: "HIGH",
      pressingIntensity: "HIGH",
    },
    overallStats: {
      totalMatches: 174,
      wins: 104,
      draws: 34,
      losses: 36,
      winPercentage: 66.3,
      pointsPerMatch: 1.99,
      yellowCardsTotal: 29,
      redCardsTotal: 3,
    },
    trophiesCount: 3,
    majorHonors: [
      "CONMEBOL Libertadores 2024",
      "Brasileirão Série A 2024",
      "Taça da Liga de Portugal 2024 (Braga)",
    ],
    careerHistory: [
      {
        clubName: "Sporting Braga",
        startDate: "2022-07-01",
        endDate: "2024-04-03",
        matches: 99,
        wins: 64,
        draws: 13,
        losses: 22,
        winPercentage: 69.0,
        trophiesWon: ["Taça da Liga 2023/24"],
      },
      {
        clubName: "Botafogo",
        startDate: "2024-04-05",
        endDate: "ATUAL",
        matches: 75,
        wins: 40,
        draws: 21,
        losses: 14,
        winPercentage: 62.7,
        trophiesWon: ["CONMEBOL Libertadores 2024", "Brasileirão Série A 2024"],
      },
    ],
  },
  {
    id: 5,
    name: "Dorival Silvestre Júnior",
    shortName: "Dorival Júnior",
    nationality: "Brasil",
    countryFlag: "🇧🇷",
    age: 63,
    photoUrl: "https://api.sofascore.app/api/v1/manager/52309/image",
    status: "ACTIVE",
    currentTeam: {
      id: 99,
      name: "Seleção Brasileira de Futebol",
      shortName: "Brasil",
      logoUrl: "https://api.sofascore.app/api/v1/team/4776/image",
      appointmentDate: "2024-01-10",
      contractUntil: "2026-07-31",
    },
    tacticalDNA: {
      preferredFormation: "4-3-3",
      style: "Equilíbrio tático com apoio pelos corredores laterais e volante organizador",
      possessionFocus: "HIGH",
      pressingIntensity: "MEDIUM",
    },
    overallStats: {
      totalMatches: 480,
      wins: 265,
      draws: 118,
      losses: 97,
      winPercentage: 63.4,
      pointsPerMatch: 1.90,
      yellowCardsTotal: 45,
      redCardsTotal: 4,
    },
    trophiesCount: 8,
    majorHonors: [
      "CONMEBOL Libertadores 2022 (Flamengo)",
      "Copa do Brasil 2022 (Flamengo)",
      "Copa do Brasil 2023 (São Paulo)",
      "Copa do Brasil 2010 (Santos)",
      "Recopa Sul-Americana 2011 (Santos)",
    ],
    careerHistory: [
      {
        clubName: "Flamengo",
        startDate: "2022-06-10",
        endDate: "2022-12-31",
        matches: 43,
        wins: 26,
        draws: 8,
        losses: 9,
        winPercentage: 66.7,
        trophiesWon: ["CONMEBOL Libertadores 2022", "Copa do Brasil 2022"],
      },
      {
        clubName: "São Paulo",
        startDate: "2023-04-20",
        endDate: "2024-01-07",
        matches: 54,
        wins: 25,
        draws: 13,
        losses: 16,
        winPercentage: 54.3,
        trophiesWon: ["Copa do Brasil 2023"],
      },
      {
        clubName: "Seleção Brasileira",
        startDate: "2024-01-10",
        endDate: "ATUAL",
        matches: 22,
        wins: 13,
        draws: 7,
        losses: 2,
        winPercentage: 69.7,
        trophiesWon: [],
      },
    ],
  },
  {
    id: 6,
    name: "Josep Guardiola Sala",
    shortName: "Pep Guardiola",
    nationality: "Espanha",
    countryFlag: "🇪🇸",
    age: 55,
    photoUrl: "https://api.sofascore.app/api/v1/manager/52308/image",
    status: "ACTIVE",
    currentTeam: {
      id: 17,
      name: "Manchester City",
      shortName: "Man City",
      logoUrl: "https://api.sofascore.app/api/v1/team/17/image",
      appointmentDate: "2016-07-01",
      contractUntil: "2027-06-30",
    },
    tacticalDNA: {
      preferredFormation: "3-2-4-1",
      style: "Juego de Posición hegemônico, pressão sufocante pós-perda e lateral invertido",
      possessionFocus: "HIGH",
      pressingIntensity: "HIGH",
    },
    overallStats: {
      totalMatches: 890,
      wins: 652,
      draws: 132,
      losses: 106,
      winPercentage: 78.2,
      pointsPerMatch: 2.35,
      yellowCardsTotal: 38,
      redCardsTotal: 2,
    },
    trophiesCount: 38,
    majorHonors: [
      "3x UEFA Champions League (2009, 2011, 2023)",
      "6x Premier League",
      "3x LaLiga",
      "3x Bundesliga",
      "4x FIFA Club World Cup",
    ],
    careerHistory: [
      {
        clubName: "FC Barcelona",
        startDate: "2008-07-01",
        endDate: "2012-06-30",
        matches: 247,
        wins: 179,
        draws: 47,
        losses: 21,
        winPercentage: 78.8,
        trophiesWon: ["2x Champions League", "3x LaLiga", "2x Copa del Rey", "2x Club World Cup"],
      },
      {
        clubName: "Bayern de Munique",
        startDate: "2013-07-01",
        endDate: "2016-06-30",
        matches: 161,
        wins: 121,
        draws: 21,
        losses: 19,
        winPercentage: 79.5,
        trophiesWon: ["3x Bundesliga", "2x DFB-Pokal", "1x Club World Cup"],
      },
      {
        clubName: "Manchester City",
        startDate: "2016-07-01",
        endDate: "ATUAL",
        matches: 482,
        wins: 352,
        draws: 64,
        losses: 66,
        winPercentage: 77.4,
        trophiesWon: ["1x Champions League", "6x Premier League", "2x FA Cup"],
      },
    ],
  },
  {
    id: 7,
    name: "Carlo Ancelotti",
    shortName: "Carlo Ancelotti",
    nationality: "Itália",
    countryFlag: "🇮🇹",
    age: 67,
    photoUrl: "https://api.sofascore.app/api/v1/manager/52307/image",
    status: "ACTIVE",
    currentTeam: {
      id: 8,
      name: "Real Madrid CF",
      shortName: "Real Madrid",
      logoUrl: "https://api.sofascore.app/api/v1/team/2829/image",
      appointmentDate: "2021-06-01",
      contractUntil: "2026-06-30",
    },
    tacticalDNA: {
      preferredFormation: "4-3-1-2",
      style: "Gestão humana magistral, liberdade criativa na frente e transições letais",
      possessionFocus: "BALANCED",
      pressingIntensity: "MEDIUM",
    },
    overallStats: {
      totalMatches: 1320,
      wins: 780,
      draws: 290,
      losses: 250,
      winPercentage: 66.4,
      pointsPerMatch: 1.99,
      yellowCardsTotal: 25,
      redCardsTotal: 1,
    },
    trophiesCount: 29,
    majorHonors: [
      "5x UEFA Champions League (2003, 2007, 2014, 2022, 2024)",
      "2x LaLiga",
      "1x Premier League",
      "1x Serie A",
      "1x Bundesliga",
      "1x Ligue 1",
    ],
    careerHistory: [
      {
        clubName: "AC Milan",
        startDate: "2001-11-06",
        endDate: "2009-05-31",
        matches: 420,
        wins: 238,
        draws: 101,
        losses: 81,
        winPercentage: 64.7,
        trophiesWon: ["2x Champions League", "1x Serie A", "1x Club World Cup"],
      },
      {
        clubName: "Real Madrid (2ª Passagem)",
        startDate: "2021-06-01",
        endDate: "ATUAL",
        matches: 215,
        wins: 154,
        draws: 34,
        losses: 27,
        winPercentage: 76.9,
        trophiesWon: ["2x Champions League", "2x LaLiga", "1x Copa del Rey"],
      },
    ],
  },
];

export class CoachesService {
  public static listCoaches(filters?: {
    nationality?: string;
    search?: string;
    status?: "ACTIVE" | "AVAILABLE";
  }): CoachProfile[] {
    let list = [...COACHES_DATABASE];

    if (filters?.nationality) {
      list = list.filter(
        (c) => c.nationality.toLowerCase() === filters.nationality!.toLowerCase()
      );
    }
    if (filters?.status) {
      list = list.filter((c) => c.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.shortName.toLowerCase().includes(q) ||
          c.currentTeam?.name.toLowerCase().includes(q) ||
          c.currentTeam?.shortName.toLowerCase().includes(q)
      );
    }

    return list;
  }

  public static getCoachById(id: number): CoachProfile | null {
    return COACHES_DATABASE.find((c) => c.id === id) || null;
  }

  public static getCoachRanking(sortBy: "winRate" | "trophies" | "pointsPerMatch" = "winRate"): CoachProfile[] {
    const list = [...COACHES_DATABASE];
    if (sortBy === "winRate") {
      return list.sort((a, b) => b.overallStats.winPercentage - a.overallStats.winPercentage);
    }
    if (sortBy === "trophies") {
      return list.sort((a, b) => b.trophiesCount - a.trophiesCount);
    }
    return list.sort((a, b) => b.overallStats.pointsPerMatch - a.overallStats.pointsPerMatch);
  }
}
