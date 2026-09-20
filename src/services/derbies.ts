/**
 * BrasaFut API - Grandes Clássicos e Dérbis Históricos
 * Serviço oficial para consulta de rivalidades, estatísticas históricas e retrospecto
 */

export interface DerbyProfile {
  slug: string;
  name: string;
  popularNickname: string;
  region: string;
  country: string;
  rivalryIntensityScore: number; // 1 a 10
  teams: [
    {
      id: number;
      name: string;
      shortName: string;
      acronym: string;
      logoUrl: string;
      titlesCount: number;
    },
    {
      id: number;
      name: string;
      shortName: string;
      acronym: string;
      logoUrl: string;
      titlesCount: number;
    }
  ];
  firstMatch: {
    date: string;
    result: string;
    description: string;
  };
  allTimeStats: {
    totalMatches: number;
    team1Wins: number;
    team2Wins: number;
    draws: number;
    team1Goals: number;
    team2Goals: number;
    historicAdvantage: string;
  };
  biggestVictories: {
    team1: { score: string; date: string; competition: string };
    team2: { score: string; date: string; competition: string };
  };
  allTimeTopScorers: {
    name: string;
    team: string;
    goals: number;
  }[];
  recentForm: {
    last5Matches: {
      date: string;
      competition: string;
      homeTeam: string;
      awayTeam: string;
      score: string;
      winner: string | "DRAW";
    }[];
  };
  nextFixture?: {
    competition: string;
    venue: string;
    date: string;
  };
}

export const DERBIES_DATABASE: DerbyProfile[] = [
  {
    slug: "derbi-paulista",
    name: "Dérbi Paulista",
    popularNickname: "O Maior Dérbi de São Paulo",
    region: "São Paulo, SP",
    country: "Brasil",
    rivalryIntensityScore: 10,
    teams: [
      {
        id: 2,
        name: "Sociedade Esportiva Palmeiras",
        shortName: "Palmeiras",
        acronym: "PAL",
        logoUrl: "https://api.sofascore.app/api/v1/team/1963/image",
        titlesCount: 18,
      },
      {
        id: 4,
        name: "Sport Club Corinthians Paulista",
        shortName: "Corinthians",
        acronym: "COR",
        logoUrl: "https://api.sofascore.app/api/v1/team/1957/image",
        titlesCount: 16,
      },
    ],
    firstMatch: {
      date: "06/05/1917",
      result: "Palestra Italia 3 x 0 Corinthians",
      description: "Primeiro confronto da história disputado no Estádio Parque Antarctica com três gols de Caetano.",
    },
    allTimeStats: {
      totalMatches: 382,
      team1Wins: 136,
      team2Wins: 130,
      draws: 116,
      team1Goals: 546,
      team2Goals: 499,
      historicAdvantage: "Palmeiras (+6 vitórias)",
    },
    biggestVictories: {
      team1: { score: "8 x 0", date: "05/11/1933", competition: "Campeonato Paulista & Torneio Rio-São Paulo" },
      team2: { score: "5 x 1", date: "27/08/1952", competition: "Taça Cidade de São Paulo" },
    },
    allTimeTopScorers: [
      { name: "Cláudio Christóvam", team: "Corinthians", goals: 21 },
      { name: "Heitor Marcelino", team: "Palmeiras", goals: 16 },
      { name: "Baltazar", team: "Corinthians", goals: 14 },
    ],
    recentForm: {
      last5Matches: [
        { date: "2024-11-04", competition: "Brasileirão Série A", homeTeam: "Corinthians", awayTeam: "Palmeiras", score: "2 x 0", winner: "Corinthians" },
        { date: "2024-07-01", competition: "Brasileirão Série A", homeTeam: "Palmeiras", awayTeam: "Corinthians", score: "2 x 0", winner: "Palmeiras" },
        { date: "2024-02-18", competition: "Campeonato Paulista", homeTeam: "Palmeiras", awayTeam: "Corinthians", score: "2 x 2", winner: "DRAW" },
        { date: "2023-09-03", competition: "Brasileirão Série A", homeTeam: "Corinthians", awayTeam: "Palmeiras", score: "0 x 0", winner: "DRAW" },
        { date: "2023-04-29", competition: "Brasileirão Série A", homeTeam: "Palmeiras", awayTeam: "Corinthians", score: "2 x 1", winner: "Palmeiras" },
      ],
    },
    nextFixture: {
      competition: "Brasileirão Série A",
      venue: "Neo Química Arena",
      date: "2026-10-18T16:00:00Z",
    },
  },
  {
    slug: "fla-flu",
    name: "Fla-Flu",
    popularNickname: "O Clássico das Multidões",
    region: "Rio de Janeiro, RJ",
    country: "Brasil",
    rivalryIntensityScore: 10,
    teams: [
      {
        id: 1,
        name: "Clube de Regatas do Flamengo",
        shortName: "Flamengo",
        acronym: "FLA",
        logoUrl: "https://api.sofascore.app/api/v1/team/5981/image",
        titlesCount: 22,
      },
      {
        id: 6,
        name: "Fluminense Football Club",
        shortName: "Fluminense",
        acronym: "FLU",
        logoUrl: "https://api.sofascore.app/api/v1/team/1961/image",
        titlesCount: 12,
      },
    ],
    firstMatch: {
      date: "07/07/1912",
      result: "Fluminense 3 x 2 Flamengo",
      description: "Disputado nas Laranjeiras perante 800 espectadores logo após a dissidência de atletas do Fluminense que fundaram o futebol rubro-negro.",
    },
    allTimeStats: {
      totalMatches: 450,
      team1Wins: 164,
      team2Wins: 141,
      draws: 145,
      team1Goals: 648,
      team2Goals: 588,
      historicAdvantage: "Flamengo (+23 vitórias)",
    },
    biggestVictories: {
      team1: { score: "7 x 0", date: "10/06/1945", competition: "Torneio Municipal de Futebol do Rio" },
      team2: { score: "5 x 1", date: "24/03/1943", competition: "Torneio Relâmpago" },
    },
    allTimeTopScorers: [
      { name: "Zico", team: "Flamengo", goals: 19 },
      { name: "Pirillo", team: "Flamengo", goals: 18 },
      { name: "Hércules", team: "Fluminense", goals: 15 },
    ],
    recentForm: {
      last5Matches: [
        { date: "2024-10-17", competition: "Brasileirão Série A", homeTeam: "Flamengo", awayTeam: "Fluminense", score: "0 x 2", winner: "Fluminense" },
        { date: "2024-06-23", competition: "Brasileirão Série A", homeTeam: "Fluminense", awayTeam: "Flamengo", score: "0 x 1", winner: "Flamengo" },
        { date: "2024-03-16", competition: "Campeonato Carioca", homeTeam: "Flamengo", awayTeam: "Fluminense", score: "0 x 0", winner: "DRAW" },
        { date: "2024-03-09", competition: "Campeonato Carioca", homeTeam: "Fluminense", awayTeam: "Flamengo", score: "0 x 2", winner: "Flamengo" },
        { date: "2024-02-25", competition: "Campeonato Carioca", homeTeam: "Flamengo", awayTeam: "Fluminense", score: "2 x 0", winner: "Flamengo" },
      ],
    },
    nextFixture: {
      competition: "Brasileirão Série A",
      venue: "Maracanã",
      date: "2026-11-01T16:00:00Z",
    },
  },
  {
    slug: "grenal",
    name: "Gre-Nal",
    popularNickname: "O Maior Clássico do Sul",
    region: "Porto Alegre, RS",
    country: "Brasil",
    rivalryIntensityScore: 10,
    teams: [
      {
        id: 11,
        name: "Grêmio Foot-Ball Porto Alegrense",
        shortName: "Grêmio",
        acronym: "GRE",
        logoUrl: "https://api.sofascore.app/api/v1/team/5926/image",
        titlesCount: 14,
      },
      {
        id: 10,
        name: "Sport Club Internacional",
        shortName: "Internacional",
        acronym: "INT",
        logoUrl: "https://api.sofascore.app/api/v1/team/1966/image",
        titlesCount: 15,
      },
    ],
    firstMatch: {
      date: "18/07/1909",
      result: "Grêmio 10 x 0 Internacional",
      description: "Primeiro clássico da história realizado no Estádio da Baixada com vitória elástica do Grêmio.",
    },
    allTimeStats: {
      totalMatches: 443,
      team1Wins: 141,
      team2Wins: 163,
      draws: 139,
      team1Goals: 574,
      team2Goals: 603,
      historicAdvantage: "Internacional (+22 vitórias)",
    },
    biggestVictories: {
      team1: { score: "10 x 0", date: "18/07/1909", competition: "Amistoso Gaúcho" },
      team2: { score: "7 x 0", date: "17/09/1948", competition: "Campeonato Citadino de Porto Alegre" },
    },
    allTimeTopScorers: [
      { name: "Carlitos", team: "Internacional", goals: 42 },
      { name: "Villalba", team: "Internacional", goals: 20 },
      { name: "Luiz Carvalho", team: "Grêmio", goals: 17 },
    ],
    recentForm: {
      last5Matches: [
        { date: "2024-10-19", competition: "Brasileirão Série A", homeTeam: "Internacional", awayTeam: "Grêmio", score: "1 x 0", winner: "Internacional" },
        { date: "2024-06-22", competition: "Brasileirão Série A", homeTeam: "Grêmio", awayTeam: "Internacional", score: "0 x 1", winner: "Internacional" },
        { date: "2024-02-25", competition: "Campeonato Gaúcho", homeTeam: "Internacional", awayTeam: "Grêmio", score: "3 x 2", winner: "Internacional" },
        { date: "2023-10-08", competition: "Brasileirão Série A", homeTeam: "Internacional", awayTeam: "Grêmio", score: "3 x 2", winner: "Internacional" },
        { date: "2023-05-21", competition: "Brasileirão Série A", homeTeam: "Grêmio", awayTeam: "Internacional", score: "3 x 1", winner: "Grêmio" },
      ],
    },
    nextFixture: {
      competition: "Brasileirão Série A",
      venue: "Beira-Rio",
      date: "2026-10-25T18:30:00Z",
    },
  },
  {
    slug: "classico-mineiro",
    name: "Clássico Mineiro",
    popularNickname: "O Clássico de Minas Gerais",
    region: "Belo Horizonte, MG",
    country: "Brasil",
    rivalryIntensityScore: 10,
    teams: [
      {
        id: 8,
        name: "Clube Atlético Mineiro",
        shortName: "Atlético-MG",
        acronym: "CAM",
        logoUrl: "https://api.sofascore.app/api/v1/team/1977/image",
        titlesCount: 11,
      },
      {
        id: 9,
        name: "Cruzeiro Esporte Clube",
        shortName: "Cruzeiro",
        acronym: "CRU",
        logoUrl: "https://api.sofascore.app/api/v1/team/1954/image",
        titlesCount: 14,
      },
    ],
    firstMatch: {
      date: "17/04/1921",
      result: "Palestra Itália-MG 3 x 0 Atlético-MG",
      description: "Confronto inaugural no Estádio do Prado com vitória do clube recém-fundado pela colônia italiana.",
    },
    allTimeStats: {
      totalMatches: 524,
      team1Wins: 211,
      team2Wins: 173,
      draws: 140,
      team1Goals: 739,
      team2Goals: 654,
      historicAdvantage: "Atlético-MG (+38 vitórias)",
    },
    biggestVictories: {
      team1: { score: "9 x 2", date: "27/11/1927", competition: "Campeonato Mineiro" },
      team2: { score: "6 x 1", date: "04/12/2011", competition: "Brasileirão Série A" },
    },
    allTimeTopScorers: [
      { name: "Guará", team: "Atlético-MG", goals: 26 },
      { name: "Reinaldo", team: "Atlético-MG", goals: 16 },
      { name: "Niginho", team: "Cruzeiro", goals: 25 },
    ],
    recentForm: {
      last5Matches: [
        { date: "2024-08-10", competition: "Brasileirão Série A", homeTeam: "Cruzeiro", awayTeam: "Atlético-MG", score: "0 x 0", winner: "DRAW" },
        { date: "2024-04-20", competition: "Brasileirão Série A", homeTeam: "Atlético-MG", awayTeam: "Cruzeiro", score: "3 x 0", winner: "Atlético-MG" },
        { date: "2024-04-07", competition: "Campeonato Mineiro", homeTeam: "Cruzeiro", awayTeam: "Atlético-MG", score: "1 x 3", winner: "Atlético-MG" },
        { date: "2024-03-30", competition: "Campeonato Mineiro", homeTeam: "Atlético-MG", awayTeam: "Cruzeiro", score: "2 x 2", winner: "DRAW" },
        { date: "2024-02-03", competition: "Campeonato Mineiro", homeTeam: "Atlético-MG", awayTeam: "Cruzeiro", score: "0 x 2", winner: "Cruzeiro" },
      ],
    },
  },
  {
    slug: "el-clasico",
    name: "El Clásico",
    popularNickname: "O Maior Clássico do Mundo",
    region: "Espanha",
    country: "Espanha",
    rivalryIntensityScore: 10,
    teams: [
      {
        id: 101,
        name: "Real Madrid CF",
        shortName: "Real Madrid",
        acronym: "RMA",
        logoUrl: "https://api.sofascore.app/api/v1/team/2829/image",
        titlesCount: 102,
      },
      {
        id: 102,
        name: "FC Barcelona",
        shortName: "Barcelona",
        acronym: "BAR",
        logoUrl: "https://api.sofascore.app/api/v1/team/2817/image",
        titlesCount: 99,
      },
    ],
    firstMatch: {
      date: "13/05/1902",
      result: "Barcelona 3 x 1 Madrid FC",
      description: "Semifinal da Copa de la Coronación disputada no Hipódromo de la Castellana.",
    },
    allTimeStats: {
      totalMatches: 257,
      team1Wins: 105,
      team2Wins: 100,
      draws: 52,
      team1Goals: 433,
      team2Goals: 419,
      historicAdvantage: "Real Madrid (+5 vitórias)",
    },
    biggestVictories: {
      team1: { score: "11 x 1", date: "19/06/1943", competition: "Copa del Generalísimo" },
      team2: { score: "5 x 0", date: "29/11/2010", competition: "LaLiga" },
    },
    allTimeTopScorers: [
      { name: "Lionel Messi", team: "Barcelona", goals: 26 },
      { name: "Alfredo Di Stéfano", team: "Real Madrid", goals: 18 },
      { name: "Cristiano Ronaldo", team: "Real Madrid", goals: 18 },
    ],
    recentForm: {
      last5Matches: [
        { date: "2024-10-26", competition: "LaLiga", homeTeam: "Real Madrid", awayTeam: "Barcelona", score: "0 x 4", winner: "Barcelona" },
        { date: "2024-04-21", competition: "LaLiga", homeTeam: "Real Madrid", awayTeam: "Barcelona", score: "3 x 2", winner: "Real Madrid" },
        { date: "2024-01-14", competition: "Supercopa da Espanha", homeTeam: "Real Madrid", awayTeam: "Barcelona", score: "4 x 1", winner: "Real Madrid" },
        { date: "2023-10-28", competition: "LaLiga", homeTeam: "Barcelona", awayTeam: "Real Madrid", score: "1 x 2", winner: "Real Madrid" },
        { date: "2023-04-05", competition: "Copa del Rey", homeTeam: "Barcelona", awayTeam: "Real Madrid", score: "0 x 4", winner: "Real Madrid" },
      ],
    },
  },
];

export class DerbiesService {
  public static listDerbies(country?: string): DerbyProfile[] {
    if (country) {
      return DERBIES_DATABASE.filter(
        (d) => d.country.toLowerCase() === country.toLowerCase()
      );
    }
    return DERBIES_DATABASE;
  }

  public static getDerbyBySlug(slug: string): DerbyProfile | null {
    return DERBIES_DATABASE.find((d) => d.slug.toLowerCase() === slug.toLowerCase()) || null;
  }
}
