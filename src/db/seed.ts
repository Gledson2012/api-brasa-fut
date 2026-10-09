import { db, client } from "./index.js";
import {
  venues,
  teams,
  competitions,
  seasons,
  players,
  teamRosters,
  matches,
  matchEvents,
  matchLineups,
  matchStatistics,
  standings,
  apiKeys,
  playerSeasonStatistics,
  payments,
} from "./schema.js";
import { hashPassword } from "../utils/password.js";
import { apiKeyPrefix, generateApiKey, hashApiKey } from "../utils/apiKey.js";
import { randomBytes } from "node:crypto";

export async function seed(closeClient: boolean = true) {
  console.log("🌱 Iniciando o seed de dados da BrasaFut API...");

  // Limpar tabelas existentes e resetar sequências de ID para 1
  await client.unsafe(`
    TRUNCATE TABLE
      webhook_deliveries,
      webhooks,
      team_absences,
      transfers,
      referees,
      payments,
      api_keys,
      player_season_statistics,
      match_statistics,
      match_events,
      match_lineups,
      standings,
      matches,
      team_rosters,
      players,
      seasons,
      competitions,
      teams,
      venues
    RESTART IDENTITY CASCADE;
  `);

  console.log("🏟️ Inserindo estádios...");
  const insertedVenues = await db
    .insert(venues)
    .values([
      { name: "Maracanã", city: "Rio de Janeiro", country: "Brasil", capacity: 78838, surface: "Grass" },
      { name: "Allianz Parque", city: "São Paulo", country: "Brasil", capacity: 43713, surface: "Artificial" },
      { name: "Neo Química Arena", city: "São Paulo", country: "Brasil", capacity: 49205, surface: "Grass" },
      { name: "MorumBIS", city: "São Paulo", country: "Brasil", capacity: 66795, surface: "Grass" },
      { name: "Mineirão", city: "Belo Horizonte", country: "Brasil", capacity: 61846, surface: "Grass" },
      { name: "Beira-Rio", city: "Porto Alegre", country: "Brasil", capacity: 50842, surface: "Grass" },
      { name: "Arena do Grêmio", city: "Porto Alegre", country: "Brasil", capacity: 55662, surface: "Grass" },
      { name: "Ligga Arena", city: "Curitiba", country: "Brasil", capacity: 42372, surface: "Artificial" },
      { name: "Casa de Apostas Arena Fonte Nova", city: "Salvador", country: "Brasil", capacity: 50025, surface: "Grass" },
      { name: "Arena Castelão", city: "Fortaleza", country: "Brasil", capacity: 63903, surface: "Grass" },
      { name: "Nilton Santos", city: "Rio de Janeiro", country: "Brasil", capacity: 44661, surface: "Artificial" },
      { name: "São Januário", city: "Rio de Janeiro", country: "Brasil", capacity: 21880, surface: "Grass" },
    ])
    .returning();

  const venueMap = new Map(insertedVenues.map((v) => [v.name, v.id]));

  console.log("🛡️ Inserindo clubes da Série A...");
  const insertedTeams = await db
    .insert(teams)
    .values([
      { name: "Clube de Regatas do Flamengo", shortName: "Flamengo", acronym: "FLA", foundedYear: 1895, country: "Brasil", venueId: venueMap.get("Maracanã"), logoUrl: "https://api.sofascore.app/api/v1/team/5981/image" },
      { name: "Sociedade Esportiva Palmeiras", shortName: "Palmeiras", acronym: "PAL", foundedYear: 1914, country: "Brasil", venueId: venueMap.get("Allianz Parque"), logoUrl: "https://api.sofascore.app/api/v1/team/1963/image" },
      { name: "São Paulo Futebol Clube", shortName: "São Paulo", acronym: "SAO", foundedYear: 1930, country: "Brasil", venueId: venueMap.get("MorumBIS"), logoUrl: "https://api.sofascore.app/api/v1/team/1981/image" },
      { name: "Sport Club Corinthians Paulista", shortName: "Corinthians", acronym: "COR", foundedYear: 1910, country: "Brasil", venueId: venueMap.get("Neo Química Arena"), logoUrl: "https://api.sofascore.app/api/v1/team/1957/image" },
      { name: "Botafogo de Futebol e Regatas", shortName: "Botafogo", acronym: "BOT", foundedYear: 1904, country: "Brasil", venueId: venueMap.get("Nilton Santos"), logoUrl: "https://api.sofascore.app/api/v1/team/1958/image" },
      { name: "Fluminense Football Club", shortName: "Fluminense", acronym: "FLU", foundedYear: 1902, country: "Brasil", venueId: venueMap.get("Maracanã"), logoUrl: "https://api.sofascore.app/api/v1/team/1961/image" },
      { name: "Club de Regatas Vasco da Gama", shortName: "Vasco da Gama", acronym: "VAS", foundedYear: 1898, country: "Brasil", venueId: venueMap.get("São Januário"), logoUrl: "https://api.sofascore.app/api/v1/team/1974/image" },
      { name: "Clube Atlético Mineiro", shortName: "Atlético-MG", acronym: "CAM", foundedYear: 1908, country: "Brasil", venueId: venueMap.get("Mineirão"), logoUrl: "https://api.sofascore.app/api/v1/team/1977/image" },
      { name: "Cruzeiro Esporte Clube", shortName: "Cruzeiro", acronym: "CRU", foundedYear: 1921, country: "Brasil", venueId: venueMap.get("Mineirão"), logoUrl: "https://api.sofascore.app/api/v1/team/1954/image" },
      { name: "Sport Club Internacional", shortName: "Internacional", acronym: "INT", foundedYear: 1909, country: "Brasil", venueId: venueMap.get("Beira-Rio"), logoUrl: "https://api.sofascore.app/api/v1/team/1966/image" },
      { name: "Grêmio Foot-Ball Porto Alegrense", shortName: "Grêmio", acronym: "GRE", foundedYear: 1903, country: "Brasil", venueId: venueMap.get("Arena do Grêmio"), logoUrl: "https://api.sofascore.app/api/v1/team/5926/image" },
      { name: "Esporte Clube Bahia", shortName: "Bahia", acronym: "BAH", foundedYear: 1931, country: "Brasil", venueId: venueMap.get("Casa de Apostas Arena Fonte Nova"), logoUrl: "https://api.sofascore.app/api/v1/team/1955/image" },
      { name: "Fortaleza Esporte Clube", shortName: "Fortaleza", acronym: "FOR", foundedYear: 1918, country: "Brasil", venueId: venueMap.get("Arena Castelão"), logoUrl: "https://api.sofascore.app/api/v1/team/2020/image" },
      { name: "Club Athletico Paranaense", shortName: "Athletico-PR", acronym: "CAP", foundedYear: 1924, country: "Brasil", venueId: venueMap.get("Ligga Arena"), logoUrl: "https://api.sofascore.app/api/v1/team/1967/image" },
    ])
    .returning();

  const teamMap = new Map(insertedTeams.map((t) => [t.shortName, t.id]));

  console.log("🏆 Inserindo catálogo completo de campeonatos e ligas...");
  const competitionsData = [
    // Brasil - Nacionais
    { name: "Brasileirão Série A", code: "BRA-1", country: "Brasil", type: "LEAGUE" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/pt/b/b4/Campeonato_Brasileiro_S%C3%A9rie_A_logo.png" },
    { name: "Brasileirão Série B", code: "BRA-2", country: "Brasil", type: "LEAGUE" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/pt/f/f4/Campeonato_Brasileiro_S%C3%A9rie_B_logo.png" },
    { name: "Brasileirão Série C", code: "BRA-3", country: "Brasil", type: "LEAGUE" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/pt/b/bd/Campeonato_Brasileiro_S%C3%A9rie_C_logo.png" },
    { name: "Copa do Brasil", code: "CDB", country: "Brasil", type: "CUP" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/pt/9/9e/Copa_do_Brasil_de_Futebol_logo.png" },
    { name: "Supercopa do Brasil", code: "SCB", country: "Brasil", type: "CUP" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/pt/4/41/Supercopa_do_Brasil_logo.png" },

    // Brasil - Estaduais e Regionais
    { name: "Campeonato Paulista", code: "PAULISTAO", country: "Brasil", type: "LEAGUE" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/pt/3/30/Campeonato_Paulista_logo.png" },
    { name: "Campeonato Carioca", code: "CARIOCAO", country: "Brasil", type: "LEAGUE" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/pt/8/8f/Campeonato_Carioca_logo.png" },
    { name: "Campeonato Mineiro", code: "MINEIRO", country: "Brasil", type: "LEAGUE" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/pt/b/b2/Campeonato_Mineiro_logo.png" },
    { name: "Campeonato Gaúcho", code: "GAUCHAO", country: "Brasil", type: "LEAGUE" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/pt/9/90/Campeonato_Gaucho_logo.png" },
    { name: "Copa do Nordeste", code: "CNE", country: "Brasil", type: "CUP" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/pt/a/a2/Copa_do_Nordeste_logo.png" },

    // América do Sul (CONMEBOL)
    { name: "CONMEBOL Libertadores", code: "LIB", country: "América do Sul", type: "INTERNATIONAL" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/pt/c/c2/Copa_Libertadores_da_Am%C3%A9rica_logo.png" },
    { name: "CONMEBOL Sul-Americana", code: "SUL", country: "América do Sul", type: "INTERNATIONAL" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/pt/f/fb/Copa_Sul-Americana_logo.png" },
    { name: "Recopa Sul-Americana", code: "REC", country: "América do Sul", type: "INTERNATIONAL" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/pt/b/b8/Recopa_Sul-Americana_logo.png" },

    // Europa (UEFA & Ligas Nacionais)
    { name: "UEFA Champions League", code: "UCL", country: "Europa", type: "INTERNATIONAL" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f3/UEFA_Champions_League_logo_2.svg" },
    { name: "UEFA Europa League", code: "UEL", country: "Europa", type: "INTERNATIONAL" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6b/UEFA_Europa_League_logo_%282021%29.svg" },
    { name: "UEFA Conference League", code: "UECL", country: "Europa", type: "INTERNATIONAL" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ec/UEFA_Europa_Conference_League_logo.svg" },
    { name: "Premier League", code: "PL", country: "Inglaterra", type: "LEAGUE" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg" },
    { name: "La Liga", code: "LAL", country: "Espanha", type: "LEAGUE" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0f/LaLiga_logo_2023.svg" },
    { name: "Serie A Italiana", code: "SA-ITA", country: "Itália", type: "LEAGUE" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Serie_A_logo_2019.svg" },
    { name: "Bundesliga", code: "BUN", country: "Alemanha", type: "LEAGUE" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/en/d/df/Bundesliga_logo_%282017%29.svg" },
    { name: "Ligue 1", code: "LIG-1", country: "França", type: "LEAGUE" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Ligue_1_logo_%282024%29.svg" },
    { name: "Primeira Liga", code: "POR-1", country: "Portugal", type: "LEAGUE" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/pt/4/4b/Liga_Portugal_Betclic_logo.png" },

    // Torneios Mundiais e de Seleções (FIFA / CONMEBOL / UEFA)
    { name: "Copa do Mundo FIFA", code: "WC-2026", country: "Mundial", type: "INTERNATIONAL" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e0/FIFA_World_Cup_2026_Emblem.svg" },
    { name: "Copa do Mundo de Clubes da FIFA", code: "FCWC", country: "Mundial", type: "INTERNATIONAL" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/87/FIFA_Club_World_Cup_logo.svg" },
    { name: "Copa América", code: "CA", country: "América do Sul", type: "INTERNATIONAL" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/pt/2/25/Copa_Am%C3%A9rica_logo.png" },
    { name: "UEFA Eurocopa", code: "EURO", country: "Europa", type: "INTERNATIONAL" as const, logoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/15/UEFA_Euro_2024_Logo.svg" },
  ];

  const insertedCompetitions = await db
    .insert(competitions)
    .values(competitionsData)
    .returning();

  const compMap = new Map(insertedCompetitions.map((c) => [c.code, c]));
  const brasileirao = compMap.get("BRA-1")!;

  // Criar temporadas correspondentes para cada torneio
  const seasonsData = insertedCompetitions.map((comp) => {
    const isEuropean = ["UCL", "UEL", "UECL", "PL", "LAL", "SA-ITA", "BUN", "LIG-1", "POR-1"].includes(comp.code || "");
    return {
      competitionId: comp.id,
      name: isEuropean ? "2025/2026" : "2026",
      startDate: isEuropean ? "2025-08-15" : "2026-01-15",
      endDate: isEuropean ? "2026-05-30" : "2026-12-10",
      isCurrent: true,
    };
  });

  const insertedSeasons = await db.insert(seasons).values(seasonsData).returning();
  const seasonMap = new Map(insertedSeasons.map((s) => [s.competitionId, s]));
  const season2026 = seasonMap.get(brasileirao.id)!;

  console.log("⚽ Inserindo jogadores e elencos...");
  const insertedPlayers = await db
    .insert(players)
    .values([
      // Flamengo
      { firstName: "Agustín", lastName: "Rossi", knownName: "Rossi", nationality: "Argentina", primaryPosition: "GOALKEEPER", heightCm: 193, weightKg: 85, photoUrl: "https://api.sofascore.app/api/v1/player/820689/image" },
      { firstName: "Giorgian", lastName: "De Arrascaeta", knownName: "Arrascaeta", nationality: "Uruguai", primaryPosition: "MIDFIELDER", heightCm: 172, weightKg: 67, photoUrl: "https://api.sofascore.app/api/v1/player/341648/image" },
      { firstName: "Pedro", lastName: "Guilherme", knownName: "Pedro", nationality: "Brasil", primaryPosition: "FORWARD", heightCm: 185, weightKg: 78, photoUrl: "https://api.sofascore.app/api/v1/player/885315/image" },
      { firstName: "Gerson", lastName: "Santos", knownName: "Gerson", nationality: "Brasil", primaryPosition: "MIDFIELDER", heightCm: 184, weightKg: 70, photoUrl: "https://api.sofascore.app/api/v1/player/795493/image" },
      // Palmeiras
      { firstName: "Weverton", lastName: "Pereira", knownName: "Weverton", nationality: "Brasil", primaryPosition: "GOALKEEPER", heightCm: 189, weightKg: 89, photoUrl: "https://api.sofascore.app/api/v1/player/47990/image" },
      { firstName: "Raphael", lastName: "Veiga", knownName: "Raphael Veiga", nationality: "Brasil", primaryPosition: "MIDFIELDER", heightCm: 178, weightKg: 73, photoUrl: "https://api.sofascore.app/api/v1/player/846747/image" },
      { firstName: "Estêvão", lastName: "Willian", knownName: "Estêvão", nationality: "Brasil", primaryPosition: "FORWARD", heightCm: 176, weightKg: 66, photoUrl: "https://api.sofascore.app/api/v1/player/1478142/image" },
      { firstName: "Gustavo", lastName: "Gómez", knownName: "Gustavo Gómez", nationality: "Paraguai", primaryPosition: "DEFENDER", heightCm: 185, weightKg: 86, photoUrl: "https://api.sofascore.app/api/v1/player/260389/image" },
      // Corinthians
      { firstName: "Hugo", lastName: "Souza", knownName: "Hugo Souza", nationality: "Brasil", primaryPosition: "GOALKEEPER", heightCm: 199, weightKg: 95, photoUrl: "https://api.sofascore.app/api/v1/player/978939/image" },
      { firstName: "Rodrigo", lastName: "Garro", knownName: "Rodrigo Garro", nationality: "Argentina", primaryPosition: "MIDFIELDER", heightCm: 174, weightKg: 69, photoUrl: "https://api.sofascore.app/api/v1/player/914041/image" },
      { firstName: "Memphis", lastName: "Depay", knownName: "Memphis Depay", nationality: "Holanda", primaryPosition: "FORWARD", heightCm: 176, weightKg: 78, photoUrl: "https://api.sofascore.app/api/v1/player/138833/image" },
      { firstName: "Yuri", lastName: "Alberto", knownName: "Yuri Alberto", nationality: "Brasil", primaryPosition: "FORWARD", heightCm: 182, weightKg: 77, photoUrl: "https://api.sofascore.app/api/v1/player/905463/image" },
      // São Paulo
      { firstName: "Rafael", lastName: "Pires", knownName: "Rafael", nationality: "Brasil", primaryPosition: "GOALKEEPER", heightCm: 192, weightKg: 87, photoUrl: "https://api.sofascore.app/api/v1/player/49454/image" },
      { firstName: "Lucas", lastName: "Moura", knownName: "Lucas Moura", nationality: "Brasil", primaryPosition: "FORWARD", heightCm: 172, weightKg: 70, photoUrl: "https://api.sofascore.app/api/v1/player/104683/image" },
      { firstName: "Jonathan", lastName: "Calleri", knownName: "Calleri", nationality: "Argentina", primaryPosition: "FORWARD", heightCm: 181, weightKg: 75, photoUrl: "https://api.sofascore.app/api/v1/player/343949/image" },
      // Atlético-MG
      { firstName: "Givanildo", lastName: "Vieira", knownName: "Hulk", nationality: "Brasil", primaryPosition: "FORWARD", heightCm: 180, weightKg: 85, photoUrl: "https://api.sofascore.app/api/v1/player/29778/image" },
      { firstName: "Gustavo", lastName: "Scarpa", knownName: "Gustavo Scarpa", nationality: "Brasil", primaryPosition: "MIDFIELDER", heightCm: 176, weightKg: 70, photoUrl: "https://api.sofascore.app/api/v1/player/785806/image" },
    ])
    .returning();

  const playerMap = new Map(insertedPlayers.map((p) => [p.knownName || p.lastName, p.id]));

  // Vincular elencos
  const rostersData = [
    { team: "Flamengo", player: "Rossi", number: 1, pos: "GOALKEEPER" as const },
    { team: "Flamengo", player: "Arrascaeta", number: 14, pos: "MIDFIELDER" as const },
    { team: "Flamengo", player: "Pedro", number: 9, pos: "FORWARD" as const },
    { team: "Flamengo", player: "Gerson", number: 8, pos: "MIDFIELDER" as const },
    { team: "Palmeiras", player: "Weverton", number: 21, pos: "GOALKEEPER" as const },
    { team: "Palmeiras", player: "Raphael Veiga", number: 23, pos: "MIDFIELDER" as const },
    { team: "Palmeiras", player: "Estêvão", number: 41, pos: "FORWARD" as const },
    { team: "Palmeiras", player: "Gustavo Gómez", number: 15, pos: "DEFENDER" as const },
    { team: "Corinthians", player: "Hugo Souza", number: 1, pos: "GOALKEEPER" as const },
    { team: "Corinthians", player: "Rodrigo Garro", number: 10, pos: "MIDFIELDER" as const },
    { team: "Corinthians", player: "Memphis Depay", number: 94, pos: "FORWARD" as const },
    { team: "Corinthians", player: "Yuri Alberto", number: 9, pos: "FORWARD" as const },
    { team: "São Paulo", player: "Rafael", number: 23, pos: "GOALKEEPER" as const },
    { team: "São Paulo", player: "Lucas Moura", number: 7, pos: "FORWARD" as const },
    { team: "São Paulo", player: "Calleri", number: 9, pos: "FORWARD" as const },
    { team: "Atlético-MG", player: "Hulk", number: 7, pos: "FORWARD" as const },
    { team: "Atlético-MG", player: "Gustavo Scarpa", number: 6, pos: "MIDFIELDER" as const },
  ];

  await db.insert(teamRosters).values(
    rostersData.map((r) => ({
      teamId: teamMap.get(r.team)!,
      playerId: playerMap.get(r.player)!,
      seasonId: season2026.id,
      jerseyNumber: r.number,
      position: r.pos,
    }))
  );

  console.log("📊 Inserindo estatísticas individuais dos atletas...");
  const statsData = [
    { player: "Pedro", team: "Flamengo", appearances: 15, matchesStarted: 15, minutesPlayed: 1250, goals: 12, assists: 3, rating: "7.6", shotsTotal: 45, shotsOnTarget: 25, cleanSheets: 0, saves: 0, goalsConceded: 0, penaltySaves: 0 },
    { player: "Estêvão", team: "Palmeiras", appearances: 16, matchesStarted: 15, minutesPlayed: 1300, goals: 10, assists: 6, rating: "7.8", shotsTotal: 38, shotsOnTarget: 20, cleanSheets: 0, saves: 0, goalsConceded: 0, penaltySaves: 0 },
    { player: "Yuri Alberto", team: "Corinthians", appearances: 17, matchesStarted: 16, minutesPlayed: 1400, goals: 9, assists: 2, rating: "7.2", shotsTotal: 40, shotsOnTarget: 18, cleanSheets: 0, saves: 0, goalsConceded: 0, penaltySaves: 0 },
    { player: "Hulk", team: "Atlético-MG", appearances: 14, matchesStarted: 14, minutesPlayed: 1200, goals: 8, assists: 5, rating: "7.5", shotsTotal: 35, shotsOnTarget: 17, cleanSheets: 0, saves: 0, goalsConceded: 0, penaltySaves: 0 },
    { player: "Calleri", team: "São Paulo", appearances: 15, matchesStarted: 14, minutesPlayed: 1180, goals: 7, assists: 2, rating: "7.1", shotsTotal: 30, shotsOnTarget: 15, cleanSheets: 0, saves: 0, goalsConceded: 0, penaltySaves: 0 },
    { player: "Memphis Depay", team: "Corinthians", appearances: 10, matchesStarted: 8, minutesPlayed: 750, goals: 6, assists: 4, rating: "7.4", shotsTotal: 28, shotsOnTarget: 14, cleanSheets: 0, saves: 0, goalsConceded: 0, penaltySaves: 0 },
    { player: "Raphael Veiga", team: "Palmeiras", appearances: 16, matchesStarted: 16, minutesPlayed: 1350, goals: 6, assists: 7, rating: "7.5", shotsTotal: 32, shotsOnTarget: 14, cleanSheets: 0, saves: 0, goalsConceded: 0, penaltySaves: 0 },
    { player: "Arrascaeta", team: "Flamengo", appearances: 14, matchesStarted: 13, minutesPlayed: 1100, goals: 5, assists: 8, rating: "7.7", shotsTotal: 25, shotsOnTarget: 12, cleanSheets: 0, saves: 0, goalsConceded: 0, penaltySaves: 0 },
    { player: "Rodrigo Garro", team: "Corinthians", appearances: 17, matchesStarted: 17, minutesPlayed: 1450, goals: 4, assists: 9, rating: "7.6", shotsTotal: 26, shotsOnTarget: 11, cleanSheets: 0, saves: 0, goalsConceded: 0, penaltySaves: 0 },
    { player: "Gustavo Scarpa", team: "Atlético-MG", appearances: 16, matchesStarted: 15, minutesPlayed: 1280, goals: 4, assists: 6, rating: "7.3", shotsTotal: 22, shotsOnTarget: 9, cleanSheets: 0, saves: 0, goalsConceded: 0, penaltySaves: 0 },
    { player: "Lucas Moura", team: "São Paulo", appearances: 15, matchesStarted: 14, minutesPlayed: 1220, goals: 5, assists: 4, rating: "7.4", shotsTotal: 27, shotsOnTarget: 12, cleanSheets: 0, saves: 0, goalsConceded: 0, penaltySaves: 0 },
    { player: "Gerson", team: "Flamengo", appearances: 16, matchesStarted: 16, minutesPlayed: 1380, goals: 3, assists: 5, rating: "7.4", shotsTotal: 18, shotsOnTarget: 8, cleanSheets: 0, saves: 0, goalsConceded: 0, penaltySaves: 0 },
    { player: "Gustavo Gómez", team: "Palmeiras", appearances: 16, matchesStarted: 16, minutesPlayed: 1440, goals: 2, assists: 1, rating: "7.2", shotsTotal: 12, shotsOnTarget: 5, cleanSheets: 8, saves: 0, goalsConceded: 0, penaltySaves: 0 },
    { player: "Rossi", team: "Flamengo", appearances: 16, matchesStarted: 16, minutesPlayed: 1440, goals: 0, assists: 0, rating: "7.3", shotsTotal: 0, shotsOnTarget: 0, cleanSheets: 9, saves: 42, goalsConceded: 11, penaltySaves: 1 },
    { player: "Weverton", team: "Palmeiras", appearances: 16, matchesStarted: 16, minutesPlayed: 1440, goals: 0, assists: 0, rating: "7.2", shotsTotal: 0, shotsOnTarget: 0, cleanSheets: 8, saves: 48, goalsConceded: 13, penaltySaves: 2 },
    { player: "Hugo Souza", team: "Corinthians", appearances: 17, matchesStarted: 17, minutesPlayed: 1530, goals: 0, assists: 0, rating: "7.4", shotsTotal: 0, shotsOnTarget: 0, cleanSheets: 6, saves: 65, goalsConceded: 19, penaltySaves: 3 },
    { player: "Rafael", team: "São Paulo", appearances: 16, matchesStarted: 16, minutesPlayed: 1440, goals: 0, assists: 0, rating: "7.1", shotsTotal: 0, shotsOnTarget: 0, cleanSheets: 7, saves: 50, goalsConceded: 15, penaltySaves: 1 },
  ];

  await db.insert(playerSeasonStatistics).values(
    statsData.map((s) => ({
      playerId: playerMap.get(s.player)!,
      teamId: teamMap.get(s.team)!,
      seasonId: season2026.id,
      appearances: s.appearances,
      matchesStarted: s.matchesStarted,
      minutesPlayed: s.minutesPlayed,
      goals: s.goals,
      assists: s.assists,
      rating: s.rating,
      shotsTotal: s.shotsTotal,
      shotsOnTarget: s.shotsOnTarget,
      cleanSheets: s.cleanSheets,
      saves: s.saves,
      goalsConceded: s.goalsConceded,
      penaltySaves: s.penaltySaves,
    }))
  );

  console.log("🌐 Sincronizando partidas e classificações com provedores oficiais...");
  const { SofascoreSyncService } = await import("../services/sofascoreSync.js");
  await SofascoreSyncService.sync(true);

  console.log("⚽ Sincronizando partidas reais multi-liga com ESPN Oficial...");
  const { EspnSyncService } = await import("../services/espnSync.js");
  await EspnSyncService.syncAll();

  console.log("🔑 Criando a conta administrativa inicial...");

  // Nenhuma credencial é fixada no código: informe via ambiente ou receba
  // valores aleatórios impressos apenas uma vez.
  const bootstrapEmail =
    process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@brasafut.local";
  const bootstrapUserName = process.env.BOOTSTRAP_ADMIN_USER || "enterprise_admin";

  const generatedPassword = `Bf!${randomBytes(12).toString("base64url")}`;
  const generatedKey = generateApiKey("ENTERPRISE");

  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const bootstrapKey = process.env.BOOTSTRAP_ADMIN_KEY;
  const adminKey = bootstrapKey || generatedKey;

  await db.insert(apiKeys).values({
    userName: bootstrapUserName,
    email: bootstrapEmail,
    passwordHash: hashPassword(bootstrapPassword || generatedPassword),
    keyHash: hashApiKey(adminKey),
    keyPrefix: apiKeyPrefix(adminKey),
    plan: "ENTERPRISE",
    rateLimitPerMinute: 1000,
    isActive: true,
  });

  console.log(`   ↳ Conta ENTERPRISE criada para ${bootstrapEmail}`);
  if (!bootstrapPassword) {
    console.log(`   ↳ Senha gerada (guarde agora, não será exibida novamente): ${generatedPassword}`);
  }
  if (!bootstrapKey) {
    console.log(`   ↳ API Key gerada (guarde agora, não será exibida novamente): ${generatedKey}`);
  }

  console.log("✅ Seed concluído com sucesso!");
  if (closeClient) {
    await client.end();
  }
}

// Executar se chamado diretamente via CLI
if (
  process.argv[1] &&
  (process.argv[1].endsWith("seed.ts") || process.argv[1].endsWith("seed.js"))
) {
  seed().catch((err) => {
    console.error("❌ Erro ao executar seed:", err);
    process.exit(1);
  });
}
