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
} from "./schema.js";

async function seed() {
  console.log("🌱 Iniciando o seed de dados da BrasaFut API...");

  // Limpar tabelas existentes (ordem reversa de dependências)
  await db.delete(apiKeys);
  await db.delete(matchStatistics);
  await db.delete(matchEvents);
  await db.delete(matchLineups);
  await db.delete(standings);
  await db.delete(matches);
  await db.delete(teamRosters);
  await db.delete(players);
  await db.delete(seasons);
  await db.delete(competitions);
  await db.delete(teams);
  await db.delete(venues);

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
      { name: "Clube de Regatas do Flamengo", shortName: "Flamengo", acronym: "FLA", foundedYear: 1895, country: "Brasil", venueId: venueMap.get("Maracanã"), logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2e/Flamengo_braz_logo.svg" },
      { name: "Sociedade Esportiva Palmeiras", shortName: "Palmeiras", acronym: "PAL", foundedYear: 1914, country: "Brasil", venueId: venueMap.get("Allianz Parque"), logoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/10/Palmeiras_logo.svg" },
      { name: "São Paulo Futebol Clube", shortName: "São Paulo", acronym: "SAO", foundedYear: 1930, country: "Brasil", venueId: venueMap.get("MorumBIS"), logoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6f/Brasao_do_Sao_Paulo_Futebol_Clube.svg" },
      { name: "Sport Club Corinthians Paulista", shortName: "Corinthians", acronym: "COR", foundedYear: 1910, country: "Brasil", venueId: venueMap.get("Neo Química Arena"), logoUrl: "https://upload.wikimedia.org/wikipedia/pt/b/b4/Corinthians_simbolo.png" },
      { name: "Botafogo de Futebol e Regatas", shortName: "Botafogo", acronym: "BOT", foundedYear: 1904, country: "Brasil", venueId: venueMap.get("Nilton Santos"), logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/cb/Escudo_Botafogo.png" },
      { name: "Fluminense Football Club", shortName: "Fluminense", acronym: "FLU", foundedYear: 1902, country: "Brasil", venueId: venueMap.get("Maracanã"), logoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ad/Fluminense_FC_escudo.png" },
      { name: "Club de Regatas Vasco da Gama", shortName: "Vasco da Gama", acronym: "VAS", foundedYear: 1898, country: "Brasil", venueId: venueMap.get("São Januário"), logoUrl: "https://upload.wikimedia.org/wikipedia/pt/a/ac/CRVascodaGama.png" },
      { name: "Clube Atlético Mineiro", shortName: "Atlético-MG", acronym: "CAM", foundedYear: 1908, country: "Brasil", venueId: venueMap.get("Mineirão"), logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/27/Clube_Atl%C3%A9tico_Mineiro_logo.svg" },
      { name: "Cruzeiro Esporte Clube", shortName: "Cruzeiro", acronym: "CRU", foundedYear: 1921, country: "Brasil", venueId: venueMap.get("Mineirão"), logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/bc/Cruzeiro_Esporte_Clube_%28logo%29.svg" },
      { name: "Sport Club Internacional", shortName: "Internacional", acronym: "INT", foundedYear: 1909, country: "Brasil", venueId: venueMap.get("Beira-Rio"), logoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f1/Escudo_do_Sport_Club_Internacional.svg" },
      { name: "Grêmio Foot-Ball Porto Alegrense", shortName: "Grêmio", acronym: "GRE", foundedYear: 1903, country: "Brasil", venueId: venueMap.get("Arena do Grêmio"), logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b3/Gremio-logo.svg" },
      { name: "Esporte Clube Bahia", shortName: "Bahia", acronym: "BAH", foundedYear: 1931, country: "Brasil", venueId: venueMap.get("Casa de Apostas Arena Fonte Nova"), logoUrl: "https://upload.wikimedia.org/wikipedia/pt/9/90/ECBahia.png" },
      { name: "Fortaleza Esporte Clube", shortName: "Fortaleza", acronym: "FOR", foundedYear: 1918, country: "Brasil", venueId: venueMap.get("Arena Castelão"), logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/44/FortalezaEC.svg" },
      { name: "Club Athletico Paranaense", shortName: "Athletico-PR", acronym: "CAP", foundedYear: 1924, country: "Brasil", venueId: venueMap.get("Ligga Arena"), logoUrl: "https://upload.wikimedia.org/wikipedia/pt/c/c7/Club_Athletico_Paranaense_2018.png" },
    ])
    .returning();

  const teamMap = new Map(insertedTeams.map((t) => [t.shortName, t.id]));

  console.log("🏆 Inserindo competição e temporada 2026...");
  const [brasileirao] = await db
    .insert(competitions)
    .values({
      name: "Brasileirão Série A",
      code: "BRA-1",
      country: "Brasil",
      type: "LEAGUE",
      logoUrl: "https://upload.wikimedia.org/wikipedia/pt/b/b4/Campeonato_Brasileiro_S%C3%A9rie_A_logo.png",
    })
    .returning();

  const [season2026] = await db
    .insert(seasons)
    .values({
      competitionId: brasileirao.id,
      name: "2026",
      startDate: "2026-04-12",
      endDate: "2026-12-06",
      isCurrent: true,
    })
    .returning();

  console.log("⚽ Inserindo jogadores e elencos...");
  const insertedPlayers = await db
    .insert(players)
    .values([
      // Flamengo
      { firstName: "Agustín", lastName: "Rossi", knownName: "Rossi", nationality: "Argentina", primaryPosition: "GOALKEEPER", heightCm: 193, weightKg: 85 },
      { firstName: "Giorgian", lastName: "De Arrascaeta", knownName: "Arrascaeta", nationality: "Uruguai", primaryPosition: "MIDFIELDER", heightCm: 172, weightKg: 67 },
      { firstName: "Pedro", lastName: "Guilherme", knownName: "Pedro", nationality: "Brasil", primaryPosition: "FORWARD", heightCm: 185, weightKg: 78 },
      { firstName: "Gerson", lastName: "Santos", knownName: "Gerson", nationality: "Brasil", primaryPosition: "MIDFIELDER", heightCm: 184, weightKg: 70 },
      // Palmeiras
      { firstName: "Weverton", lastName: "Pereira", knownName: "Weverton", nationality: "Brasil", primaryPosition: "GOALKEEPER", heightCm: 189, weightKg: 89 },
      { firstName: "Raphael", lastName: "Veiga", knownName: "Raphael Veiga", nationality: "Brasil", primaryPosition: "MIDFIELDER", heightCm: 178, weightKg: 73 },
      { firstName: "Estêvão", lastName: "Willian", knownName: "Estêvão", nationality: "Brasil", primaryPosition: "FORWARD", heightCm: 176, weightKg: 66 },
      { firstName: "Gustavo", lastName: "Gómez", knownName: "Gustavo Gómez", nationality: "Paraguai", primaryPosition: "DEFENDER", heightCm: 185, weightKg: 86 },
      // Corinthians
      { firstName: "Hugo", lastName: "Souza", knownName: "Hugo Souza", nationality: "Brasil", primaryPosition: "GOALKEEPER", heightCm: 199, weightKg: 95 },
      { firstName: "Rodrigo", lastName: "Garro", knownName: "Rodrigo Garro", nationality: "Argentina", primaryPosition: "MIDFIELDER", heightCm: 174, weightKg: 69 },
      { firstName: "Memphis", lastName: "Depay", knownName: "Memphis Depay", nationality: "Holanda", primaryPosition: "FORWARD", heightCm: 176, weightKg: 78 },
      { firstName: "Yuri", lastName: "Alberto", knownName: "Yuri Alberto", nationality: "Brasil", primaryPosition: "FORWARD", heightCm: 182, weightKg: 77 },
      // São Paulo
      { firstName: "Rafael", lastName: "Pires", knownName: "Rafael", nationality: "Brasil", primaryPosition: "GOALKEEPER", heightCm: 192, weightKg: 87 },
      { firstName: "Lucas", lastName: "Moura", knownName: "Lucas Moura", nationality: "Brasil", primaryPosition: "FORWARD", heightCm: 172, weightKg: 70 },
      { firstName: "Jonathan", lastName: "Calleri", knownName: "Calleri", nationality: "Argentina", primaryPosition: "FORWARD", heightCm: 181, weightKg: 75 },
      // Atlético-MG
      { firstName: "Givanildo", lastName: "Vieira", knownName: "Hulk", nationality: "Brasil", primaryPosition: "FORWARD", heightCm: 180, weightKg: 85 },
      { firstName: "Gustavo", lastName: "Scarpa", knownName: "Gustavo Scarpa", nationality: "Brasil", primaryPosition: "MIDFIELDER", heightCm: 176, weightKg: 70 },
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

  console.log("📅 Inserindo partidas (Passadas, Ao Vivo e Futuras)...");

  // Partida 1: Clássico Flamengo x Palmeiras (AO VIVO - Segundo Tempo!)
  const [liveMatch] = await db
    .insert(matches)
    .values({
      seasonId: season2026.id,
      venueId: venueMap.get("Maracanã"),
      homeTeamId: teamMap.get("Flamengo")!,
      awayTeamId: teamMap.get("Palmeiras")!,
      round: "Rodada 1",
      kickoffTime: new Date(Date.now() - 65 * 60 * 1000), // Iniciou há 65 minutos
      status: "SECOND_HALF",
      homeScore: 2,
      awayScore: 1,
      homeScoreHt: 1,
      awayScoreHt: 1,
    })
    .returning();

  // Partida 2: Corinthians x São Paulo (Majestoso - FINALIZADO)
  const [finishedMatch] = await db
    .insert(matches)
    .values({
      seasonId: season2026.id,
      venueId: venueMap.get("Neo Química Arena"),
      homeTeamId: teamMap.get("Corinthians")!,
      awayTeamId: teamMap.get("São Paulo")!,
      round: "Rodada 1",
      kickoffTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Ontem
      status: "FINISHED",
      homeScore: 2,
      awayScore: 2,
      homeScoreHt: 1,
      awayScoreHt: 0,
    })
    .returning();

  // Partida 3: Atlético-MG x Cruzeiro (Clássico Mineiro - AGENDADO)
  await db.insert(matches).values({
    seasonId: season2026.id,
    venueId: venueMap.get("Mineirão"),
    homeTeamId: teamMap.get("Atlético-MG")!,
    awayTeamId: teamMap.get("Cruzeiro")!,
    round: "Rodada 1",
    kickoffTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // Daqui a 4 horas
    status: "SCHEDULED",
    homeScore: 0,
    awayScore: 0,
  });

  // Partida 4: Internacional x Grêmio (Grenal - AGENDADO)
  await db.insert(matches).values({
    seasonId: season2026.id,
    venueId: venueMap.get("Beira-Rio"),
    homeTeamId: teamMap.get("Internacional")!,
    awayTeamId: teamMap.get("Grêmio")!,
    round: "Rodada 1",
    kickoffTime: new Date(Date.now() + 28 * 60 * 60 * 1000), // Amanhã
    status: "SCHEDULED",
    homeScore: 0,
    awayScore: 0,
  });

  console.log("⚡ Inserindo eventos da partida AO VIVO (Flamengo x Palmeiras)...");
  await db.insert(matchEvents).values([
    {
      matchId: liveMatch.id,
      teamId: teamMap.get("Flamengo")!,
      playerId: playerMap.get("Pedro")!,
      relatedPlayerId: playerMap.get("Arrascaeta"),
      type: "GOAL",
      minute: 18,
      description: "Gol de cobertura após assistência magistral de Arrascaeta.",
    },
    {
      matchId: liveMatch.id,
      teamId: teamMap.get("Palmeiras")!,
      playerId: playerMap.get("Raphael Veiga")!,
      type: "PENALTY_SCORED",
      minute: 39,
      description: "Cobrança de pênalti com categoria no canto esquerdo.",
    },
    {
      matchId: liveMatch.id,
      teamId: teamMap.get("Flamengo")!,
      playerId: playerMap.get("Gerson")!,
      type: "YELLOW_CARD",
      minute: 44,
      description: "Falta tática no meio campo.",
    },
    {
      matchId: liveMatch.id,
      teamId: teamMap.get("Flamengo")!,
      playerId: playerMap.get("Arrascaeta")!,
      type: "GOAL",
      minute: 58,
      description: "Chute colocado de fora da área no ângulo de Weverton!",
    },
  ]);

  console.log("📊 Inserindo estatísticas avançadas do jogo ao vivo...");
  await db.insert(matchStatistics).values([
    {
      matchId: liveMatch.id,
      teamId: teamMap.get("Flamengo")!,
      possessionPct: 56,
      shotsTotal: 12,
      shotsOnTarget: 6,
      corners: 5,
      fouls: 9,
      offsides: 2,
      yellowCards: 1,
      redCards: 0,
      saves: 2,
      passesTotal: 340,
      passesAccurate: 298,
    },
    {
      matchId: liveMatch.id,
      teamId: teamMap.get("Palmeiras")!,
      possessionPct: 44,
      shotsTotal: 8,
      shotsOnTarget: 3,
      corners: 3,
      fouls: 11,
      offsides: 1,
      yellowCards: 0,
      redCards: 0,
      saves: 4,
      passesTotal: 275,
      passesAccurate: 220,
    },
  ]);

  console.log("📈 Inserindo tabela de classificação inicial...");
  await db.insert(standings).values([
    { seasonId: season2026.id, teamId: teamMap.get("Flamengo")!, position: 1, points: 3, played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 1, goalDifference: 1, form: "V" },
    { seasonId: season2026.id, teamId: teamMap.get("Corinthians")!, position: 2, points: 1, played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 2, goalsAgainst: 2, goalDifference: 0, form: "E" },
    { seasonId: season2026.id, teamId: teamMap.get("São Paulo")!, position: 3, points: 1, played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 2, goalsAgainst: 2, goalDifference: 0, form: "E" },
    { seasonId: season2026.id, teamId: teamMap.get("Palmeiras")!, position: 4, points: 0, played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 2, goalDifference: -1, form: "D" },
    { seasonId: season2026.id, teamId: teamMap.get("Botafogo")!, position: 5, points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, form: "" },
    { seasonId: season2026.id, teamId: teamMap.get("Atlético-MG")!, position: 6, points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, form: "" },
    { seasonId: season2026.id, teamId: teamMap.get("Cruzeiro")!, position: 7, points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, form: "" },
    { seasonId: season2026.id, teamId: teamMap.get("Internacional")!, position: 8, points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, form: "" },
  ]);

  console.log("🔑 Inserindo Chaves de API para demonstração...");
  await db.insert(apiKeys).values([
    {
      userName: "Dev Demonstração",
      email: "dev@brasafut.com.br",
      key: "bf_live_demo_test_key_123",
      plan: "PRO",
      rateLimitPerMinute: 120,
      isActive: true,
    },
    {
      userName: "Usuário Gratuito",
      email: "free@brasafut.com.br",
      key: "bf_live_free_test_key_456",
      plan: "FREE",
      rateLimitPerMinute: 10,
      isActive: true,
    },
  ]);

  console.log("✅ Seed concluído com sucesso!");
  await client.end();
}

seed().catch((err) => {
  console.error("❌ Erro ao executar seed:", err);
  process.exit(1);
});
