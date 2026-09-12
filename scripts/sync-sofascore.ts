import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const TARGET_URL = process.env.TARGET_URL || "https://api-brasa-fut.vercel.app";
const API_KEY =
  process.env.API_KEY || "bf_live_enterprise_9f83a21c45e87b60d4e92a11bf738e45";

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const { stdout } = await execFileAsync("curl", [
      "-s",
      "-m",
      "15",
      "-A",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "-H",
      "Accept: application/json, text/plain, */*",
      "-H",
      "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      url,
    ]);

    const trimmed = stdout.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      return null;
    }
    return JSON.parse(trimmed) as T;
  } catch (err: any) {
    console.warn(`[Scraper] Falha ao consultar ${url}: ${err.message}`);
    return null;
  }
}

interface LeagueConfig {
  code: string;
  name: string;
  tournamentId: number;
  seasonId: number;
  country: string;
  type: "LEAGUE" | "CUP" | "INTERNATIONAL";
  hasStandings: boolean;
  seasonName: string;
}

const LEAGUES: LeagueConfig[] = [
  // Brasil
  { code: "BRA-1", name: "Brasileirão Série A", tournamentId: 325, seasonId: 87678, country: "Brasil", type: "LEAGUE", hasStandings: true, seasonName: "2026" },
  { code: "BRA-2", name: "Brasileirão Série B", tournamentId: 390, seasonId: 89840, country: "Brasil", type: "LEAGUE", hasStandings: true, seasonName: "2026" },
  { code: "CDB", name: "Copa Betano do Brasil", tournamentId: 373, seasonId: 89353, country: "Brasil", type: "CUP", hasStandings: false, seasonName: "2026" },
  // América do Sul
  { code: "LIB", name: "CONMEBOL Libertadores", tournamentId: 384, seasonId: 87760, country: "América do Sul", type: "INTERNATIONAL", hasStandings: false, seasonName: "2026" },
  { code: "SUL", name: "CONMEBOL Sul-Americana", tournamentId: 480, seasonId: 87770, country: "América do Sul", type: "INTERNATIONAL", hasStandings: false, seasonName: "2026" },
  // Europa
  { code: "PL", name: "Premier League", tournamentId: 17, seasonId: 96668, country: "Inglaterra", type: "LEAGUE", hasStandings: true, seasonName: "2026/2027" },
  { code: "LAL", name: "LaLiga", tournamentId: 8, seasonId: 97268, country: "Espanha", type: "LEAGUE", hasStandings: true, seasonName: "2026/2027" },
  { code: "SA-ITA", name: "Serie A Italiana", tournamentId: 23, seasonId: 95836, country: "Itália", type: "LEAGUE", hasStandings: true, seasonName: "2026/2027" },
  { code: "BUN", name: "Bundesliga", tournamentId: 35, seasonId: 97464, country: "Alemanha", type: "LEAGUE", hasStandings: true, seasonName: "2026/2027" },
  { code: "LIG-1", name: "Ligue 1", tournamentId: 34, seasonId: 96127, country: "França", type: "LEAGUE", hasStandings: true, seasonName: "2026/2027" },
  { code: "UCL", name: "UEFA Champions League", tournamentId: 7, seasonId: 96518, country: "Europa", type: "INTERNATIONAL", hasStandings: true, seasonName: "2026/2027" },
  // Futebol Feminino
  { code: "BRA-W1", name: "Brasileirão Feminino A1", tournamentId: 10257, seasonId: 89138, country: "Brasil", type: "LEAGUE", hasStandings: true, seasonName: "2026" },
  { code: "NWSL", name: "National Women's Soccer League", tournamentId: 1690, seasonId: 88711, country: "Estados Unidos", type: "LEAGUE", hasStandings: true, seasonName: "2026" },
  { code: "UWCL", name: "UEFA Women's Champions League", tournamentId: 696, seasonId: 96633, country: "Europa", type: "INTERNATIONAL", hasStandings: true, seasonName: "2026/2027" },
  { code: "LIGA-F", name: "Liga F Moeve (Espanha Feminino)", tournamentId: 1127, seasonId: 97379, country: "Espanha", type: "LEAGUE", hasStandings: true, seasonName: "2026/2027" },
];

async function syncLeague(league: LeagueConfig, liveEvents: any[]) {
  console.log(`\n========================================`);
  console.log(`🏆 Sincronizando ${league.name} (${league.code})...`);
  console.log(`========================================`);

  const allEvents: any[] = [];
  let currentRoundNum = 1;

  // 1. Coletar partidas recentes finalizadas e próximas
  console.log(`📥 Coletando partidas recentes e agendadas de ${league.name}...`);
  const lastRes = await fetchJson<{ events?: any[] }>(
    `https://api.sofascore.com/api/v1/unique-tournament/${league.tournamentId}/season/${league.seasonId}/events/last/0`
  );
  if (lastRes?.events && Array.isArray(lastRes.events)) {
    allEvents.push(...lastRes.events);
  }

  const nextRes = await fetchJson<{ events?: any[] }>(
    `https://api.sofascore.com/api/v1/unique-tournament/${league.tournamentId}/season/${league.seasonId}/events/next/0`
  );
  if (nextRes?.events && Array.isArray(nextRes.events)) {
    for (const ev of nextRes.events) {
      if (!allEvents.some((e) => e.id === ev.id)) {
        allEvents.push(ev);
      }
    }
  }

  // 2. Se a competição tiver classificação e rodadas numeradas
  let standingsRows: any[] = [];
  if (league.hasStandings) {
    const roundsData = await fetchJson<{ currentRound?: { round: number } }>(
      `https://api.sofascore.com/api/v1/unique-tournament/${league.tournamentId}/season/${league.seasonId}/rounds`
    );

    currentRoundNum = roundsData?.currentRound?.round || 1;
    console.log(`📌 Rodada atual identificada: Rodada ${currentRoundNum}`);

    const roundRes = await fetchJson<{ events?: any[] }>(
      `https://api.sofascore.com/api/v1/unique-tournament/${league.tournamentId}/season/${league.seasonId}/events/round/${currentRoundNum}`
    );
    if (roundRes?.events && Array.isArray(roundRes.events)) {
      for (const ev of roundRes.events) {
        if (!allEvents.some((e) => e.id === ev.id)) {
          allEvents.push(ev);
        }
      }
    }

    // Tabela de Classificação
    console.log(`📊 Coletando classificação oficial de ${league.name}...`);
    const standingsRes = await fetchJson<{ standings?: Array<{ rows?: any[] }> }>(
      `https://api.sofascore.com/api/v1/unique-tournament/${league.tournamentId}/season/${league.seasonId}/standings/total`
    );
    standingsRows = standingsRes?.standings?.[0]?.rows || [];
    console.log(`   ↳ ${standingsRows.length} clubes na classificação`);
  }

  // 3. Adicionar jogos ao vivo correspondentes
  let liveMatchCount = 0;
  for (const liveEv of liveEvents) {
    if (
      liveEv.tournament?.uniqueTournament?.id === league.tournamentId &&
      !allEvents.some((e) => e.id === liveEv.id)
    ) {
      allEvents.push(liveEv);
      liveMatchCount++;
    }
  }
  if (liveMatchCount > 0) {
    console.log(`⚡ ${liveMatchCount} jogos ao vivo vinculados a ${league.name}`);
  }

  if (allEvents.length === 0 && standingsRows.length === 0) {
    console.warn(`⚠️ Nenhum dado retornado para ${league.name}. Pulando.`);
    return;
  }

  // 4. Enviar push para a API central (Vercel / Localhost)
  console.log(`📤 Enviando push (${allEvents.length} jogos, ${standingsRows.length} posições)...`);
  const pushUrl = `${TARGET_URL}/api/v1/sync/push`;

  try {
    const response = await fetch(pushUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        events: allEvents,
        standings: standingsRows,
        currentRound: currentRoundNum,
        competitionCode: league.code,
        competitionMeta: {
          name: league.name,
          country: league.country,
          type: league.type,
          tournamentId: league.tournamentId,
          seasonName: league.seasonName,
        },
      }),
    });

    const responseData = await response.json();
    console.log(`✨ Resposta para ${league.code}:`, responseData);
  } catch (err: any) {
    console.error(`❌ Erro no push de ${league.code}:`, err.message);
  }
}

async function run() {
  const isLiveOnly = process.argv.includes("--live-only");
  console.log("🚀 [Sofascore Scraper Worker Multi-Ligas] Iniciando...");
  console.log(`📡 Destino da sincronização: ${TARGET_URL}`);

  // Coleta de jogos ao vivo globais
  console.log("⚡ Coletando jogos ao vivo globais...");
  const liveRes = await fetchJson<{ events?: any[] }>(
    "https://api.sofascore.com/api/v1/sport/football/events/live"
  );
  const liveEvents = liveRes?.events || [];
  console.log(`   ↳ ${liveEvents.length} partidas ao vivo encontradas globalmente`);

  if (isLiveOnly) {
    console.log("⚡ Modo --live-only ativado. Sincronizando apenas partidas em andamento...");
    for (const league of LEAGUES) {
      const activeForLeague = liveEvents.filter(
        (e) => e.tournament?.uniqueTournament?.id === league.tournamentId
      );
      if (activeForLeague.length > 0) {
        await syncLeague(league, activeForLeague);
      }
    }
    console.log("\n🎉 Sincronização ao vivo concluída!");
    return;
  }

  for (const league of LEAGUES) {
    await syncLeague(league, liveEvents);
  }

  console.log("\n🎉 Todas as ligas foram sincronizadas com sucesso!");
}

run();
