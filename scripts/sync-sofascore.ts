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

async function run() {
  console.log("🚀 [Sofascore Scraper Worker] Iniciando coleta de dados reais...");
  console.log(`📡 Destino da sincronização: ${TARGET_URL}`);

  // 1. Descobrir rodada atual do Brasileirão Série A 2026
  console.log("🔍 Consultando rodadas da Série A 2026...");
  const roundsData = await fetchJson<{ currentRound?: { round: number } }>(
    "https://api.sofascore.com/api/v1/unique-tournament/325/season/87678/rounds"
  );

  const currentRoundNum = roundsData?.currentRound?.round || 27;
  console.log(`📌 Rodada atual identificada: Rodada ${currentRoundNum}`);

  // Coletar rodadas recentes e próximas para ter histórico e calendário real
  const roundsToFetch = [
    Math.max(1, currentRoundNum - 2),
    Math.max(1, currentRoundNum - 1),
    currentRoundNum,
    Math.min(38, currentRoundNum + 1),
    Math.min(38, currentRoundNum + 2),
  ];

  const uniqueRounds = Array.from(new Set(roundsToFetch));
  console.log(`⚽ Rodadas a coletar: ${uniqueRounds.join(", ")}`);

  const allEvents: any[] = [];

  for (const round of uniqueRounds) {
    console.log(`📥 Coletando eventos da Rodada ${round}...`);
    const roundRes = await fetchJson<{ events?: any[] }>(
      `https://api.sofascore.com/api/v1/unique-tournament/325/season/87678/events/round/${round}`
    );
    if (roundRes?.events && Array.isArray(roundRes.events)) {
      allEvents.push(...roundRes.events);
      console.log(`   ↳ ${roundRes.events.length} jogos encontrados na Rodada ${round}`);
    }
  }

  // 2. Coletar partidas ao vivo
  console.log("⚡ Coletando jogos ao vivo...");
  const liveRes = await fetchJson<{ events?: any[] }>(
    "https://api.sofascore.com/api/v1/sport/football/events/live"
  );

  if (liveRes?.events && Array.isArray(liveRes.events)) {
    for (const liveEv of liveRes.events) {
      if (!allEvents.some((e) => e.id === liveEv.id)) {
        allEvents.push(liveEv);
      }
    }
    console.log(`   ↳ ${liveRes.events.length} jogos ao vivo capturados`);
  }

  // 3. Coletar classificação total do Brasileirão 2026
  console.log("📊 Coletando classificação oficial...");
  const standingsRes = await fetchJson<{ standings?: Array<{ rows?: any[] }> }>(
    "https://api.sofascore.com/api/v1/unique-tournament/325/season/87678/standings/total"
  );
  const standingsRows = standingsRes?.standings?.[0]?.rows || [];
  console.log(`   ↳ ${standingsRows.length} clubes na classificação`);

  console.log(
    `📦 Total consolidado: ${allEvents.length} partidas e ${standingsRows.length} linhas de classificação.`
  );

  if (allEvents.length === 0 && standingsRows.length === 0) {
    console.error("❌ Nenhum dado obtido do Sofascore. Abortando push.");
    process.exit(1);
  }

  // 4. Enviar payload consolidado para a API via POST /api/v1/sync/push
  console.log(`📤 Enviando push para ${TARGET_URL}/api/v1/sync/push...`);
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
      }),
    });

    const responseData = await response.json();
    console.log("✨ Resposta da API:", responseData);

    if (response.ok) {
      console.log("🎉 Sincronização concluída com sucesso absoluto!");
    } else {
      console.error(`⚠️ API retornou status ${response.status}:`, responseData);
      process.exit(1);
    }
  } catch (err: any) {
    console.error("❌ Falha na requisição HTTP para a API:", err.message);
    process.exit(1);
  }
}

run();
