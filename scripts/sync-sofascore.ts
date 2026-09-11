import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const TARGET_URL = process.env.TARGET_URL || "https://api-brasa-fut.vercel.app";
const API_KEY = process.env.API_KEY || "bf_live_55d453438b0372a3582e34584110438a1eecbd87";

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
      console.warn(`[Scraper] Resposta inesperada de ${url}: ${trimmed.slice(0, 100)}`);
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
}

const LEAGUES: LeagueConfig[] = [
  { code: "BRA-1", name: "Brasileirão Série A", tournamentId: 325, seasonId: 87678 },
  { code: "BRA-2", name: "Brasileirão Série B", tournamentId: 390, seasonId: 89840 },
  { code: "LIB", name: "CONMEBOL Libertadores", tournamentId: 384, seasonId: 87760 },
];

async function syncLeague(league: LeagueConfig, liveEvents: any[]) {
  console.log(`\n========================================`);
  console.log(`🏆 Sincronizando ${league.name} (${league.code})...`);
  console.log(`========================================`);

  // 1. Descobrir rodadas
  const roundsData = await fetchJson<{ currentRound?: { round: number } }>(
    `https://api.sofascore.com/api/v1/unique-tournament/${league.tournamentId}/season/${league.seasonId}/rounds`
  );

  const currentRoundNum = roundsData?.currentRound?.round || 27;
  console.log(`📌 Rodada atual identificada: Rodada ${currentRoundNum}`);

  const roundsToFetch = [
    Math.max(1, currentRoundNum - 1),
    currentRoundNum,
    Math.min(38, currentRoundNum + 1),
  ];

  const uniqueRounds = Array.from(new Set(roundsToFetch));
  const allEvents: any[] = [];

  for (const round of uniqueRounds) {
    console.log(`📥 Coletando eventos da Rodada ${round}...`);
    const roundRes = await fetchJson<{ events?: any[] }>(
      `https://api.sofascore.com/api/v1/unique-tournament/${league.tournamentId}/season/${league.seasonId}/events/round/${round}`
    );
    if (roundRes?.events && Array.isArray(roundRes.events)) {
      allEvents.push(...roundRes.events);
      console.log(`   ↳ ${roundRes.events.length} jogos encontrados na Rodada ${round}`);
    }
  }

  // 2. Classificação
  console.log(`📊 Coletando classificação oficial de ${league.name}...`);
  const standingsRes = await fetchJson<{ standings?: Array<{ rows?: any[] }> }>(
    `https://api.sofascore.com/api/v1/unique-tournament/${league.tournamentId}/season/${league.seasonId}/standings/total`
  );
  const standingsRows = standingsRes?.standings?.[0]?.rows || [];
  console.log(`   ↳ ${standingsRows.length} clubes na classificação`);

  // 3. Adicionar jogos ao vivo correspondentes
  for (const liveEv of liveEvents) {
    if (
      liveEv.tournament?.uniqueTournament?.id === league.tournamentId &&
      !allEvents.some((e) => e.id === liveEv.id)
    ) {
      allEvents.push(liveEv);
    }
  }

  if (allEvents.length === 0 && standingsRows.length === 0) {
    console.warn(`⚠️ Nenhum dado retornado para ${league.name}. Pulando.`);
    return;
  }

  // 4. Enviar push
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
      }),
    });

    const responseData = await response.json();
    console.log(`✨ Resposta para ${league.code}:`, responseData);
  } catch (err: any) {
    console.error(`❌ Erro no push de ${league.code}:`, err.message);
  }
}

async function run() {
  console.log("🚀 [Sofascore Scraper Worker Multi-Ligas] Iniciando...");
  console.log(`📡 Destino da sincronização: ${TARGET_URL}`);

  // Coleta inicial de jogos ao vivo
  console.log("⚡ Coletando jogos ao vivo globais...");
  const liveRes = await fetchJson<{ events?: any[] }>(
    "https://api.sofascore.com/api/v1/sport/football/events/live"
  );
  const liveEvents = liveRes?.events || [];
  console.log(`   ↳ ${liveEvents.length} partidas ao vivo encontradas`);

  for (const league of LEAGUES) {
    await syncLeague(league, liveEvents);
  }

  console.log("\n🎉 Todas as ligas foram sincronizadas com sucesso!");
}

run();
