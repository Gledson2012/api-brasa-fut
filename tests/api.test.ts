import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { client } from "../src/db/index.js";

describe("BrasaFut API - Testes de Integração e Melhorias", () => {
  let app: ReturnType<typeof buildApp>;
  const DEMO_KEY = "bf_live_demo_test_key_123";

  before(async () => {
    app = buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
    await client.end();
  });

  test("1. Rota raiz deve estar online", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/",
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, "online");
    assert.equal(body.name, "BrasaFut API");
  });

  test("2. Rotas protegidas devem bloquear requisições sem API Key (401)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/competitions",
    });
    assert.equal(res.statusCode, 401);
  });

  test("3. Listar competições com API Key válida", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/competitions",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const comps = JSON.parse(res.payload);
    assert.ok(Array.isArray(comps));
    assert.ok(comps.some((c: any) => c.code === "BRA-1"));
  });

  test("4. Artilharia oficial (top-scorers) com scouts e gols reais", async () => {
    const compsRes = await app.inject({
      method: "GET",
      url: "/api/v1/competitions",
      headers: { "x-api-key": DEMO_KEY },
    });
    const comps = JSON.parse(compsRes.payload);
    const serieA = comps.find((c: any) => c.code === "BRA-1");
    assert.ok(serieA);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/competitions/${serieA.id}/top-scorers?limit=5`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.payload);
    assert.ok(Array.isArray(data.topScorers));
    assert.ok(data.topScorers.length > 0);
    assert.ok(typeof data.topScorers[0].goals === "number");
    assert.ok(data.topScorers[0].goals >= data.topScorers[data.topScorers.length - 1].goals);
  });

  test("5. Líderes de assistência (top-assists) com ranking correto", async () => {
    const compsRes = await app.inject({
      method: "GET",
      url: "/api/v1/competitions",
      headers: { "x-api-key": DEMO_KEY },
    });
    const comps = JSON.parse(compsRes.payload);
    const serieA = comps.find((c: any) => c.code === "BRA-1");

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/competitions/${serieA.id}/top-assists?limit=5`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.payload);
    assert.ok(Array.isArray(data.topAssists));
    assert.ok(data.topAssists.length > 0);
    assert.ok(typeof data.topAssists[0].assists === "number");
  });

  test("6. Busca e estatísticas do atleta Memphis Depay", async () => {
    const searchRes = await app.inject({
      method: "GET",
      url: "/api/v1/players?search=Memphis",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(searchRes.statusCode, 200);
    const searchData = JSON.parse(searchRes.payload);
    assert.ok(searchData.data.length > 0);
    const depay = searchData.data[0];

    const statsRes = await app.inject({
      method: "GET",
      url: `/api/v1/players/${depay.id}/statistics`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(statsRes.statusCode, 200);
    const statsData = JSON.parse(statsRes.payload);
    assert.equal(statsData.player.knownName, "Memphis Depay");
    assert.ok(Array.isArray(statsData.statistics));
    assert.ok(statsData.statistics.length > 0);
    assert.equal(statsData.statistics[0].teamShortName, "Corinthians");
  });

  test("7. Fluxo completo de Billing Pix (Checkout, Simulação de Pagamento e Upgrade de Plano)", async () => {
    // 1. Checkout
    const checkoutRes = await app.inject({
      method: "POST",
      url: "/api/v1/billing/checkout",
      headers: { "x-api-key": DEMO_KEY },
      payload: {
        apiKey: "bf_live_free_test_key_456",
        targetPlan: "PRO",
      },
    });
    assert.equal(checkoutRes.statusCode, 200);
    const checkoutData = JSON.parse(checkoutRes.payload);
    assert.ok(checkoutData.paymentId);
    assert.equal(checkoutData.targetPlan, "PRO");
    assert.ok(checkoutData.pixCopyPaste.startsWith("00020126"));

    // 2. Simular liquidação Pix
    const simRes = await app.inject({
      method: "POST",
      url: `/api/v1/billing/simulate-pix-paid/${checkoutData.paymentId}`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(simRes.statusCode, 200);
    const simData = JSON.parse(simRes.payload);
    assert.equal(simData.success, true);
    assert.equal(simData.rateLimitPerMinute, 60);

    // 3. Status atualizado
    const statusRes = await app.inject({
      method: "GET",
      url: `/api/v1/billing/status/${checkoutData.paymentId}`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(statusRes.statusCode, 200);
    const statusData = JSON.parse(statusRes.payload);
    assert.equal(statusData.status, "PAID");
    assert.equal(statusData.apiKey.currentPlan, "PRO");
    assert.equal(statusData.apiKey.rateLimitPerMinute, 60);
  });

  test("8. Login com sucesso usando login/senha da conta Enterprise", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        login: "enterprise@brasafut.com.br",
        password: "BrasaFut@Enterprise2026",
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const body = JSON.parse(loginRes.payload);
    assert.equal(body.message, "Login realizado com sucesso!");
    assert.ok(body.apiKey.startsWith("bf_live_enterprise_"));
    assert.equal(body.user.plan, "ENTERPRISE");
    assert.equal(body.user.rateLimitPerMinute, 1000);
  });

  test("9. Login com senha incorreta deve falhar com 401", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        login: "enterprise@brasafut.com.br",
        password: "SenhaErrada123",
      },
    });
    assert.equal(loginRes.statusCode, 401);
    const body = JSON.parse(loginRes.payload);
    assert.ok(body.error.includes("Credenciais inválidas"));
  });

  test("10. Acesso com chave Enterprise retorna perfil correto em /api/v1/auth/me", async () => {
    const meRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { "x-api-key": "bf_live_enterprise_9f83a21c45e87b60d4e92a11bf738e45" },
    });
    assert.equal(meRes.statusCode, 200);
    const body = JSON.parse(meRes.payload);
    assert.equal(body.plan, "ENTERPRISE");
    assert.equal(body.rateLimitPerMinute, 1000);
  });

  test("11. Disparo de Notificação Push FCM de Gol para tópico de time", async () => {
    const pushRes = await app.inject({
      method: "POST",
      url: "/api/v1/live/test-fcm-goal",
      headers: { "x-api-key": "bf_live_enterprise_9f83a21c45e87b60d4e92a11bf738e45" },
      payload: {
        teamId: 1957,
        teamName: "Corinthians",
        opponentName: "Palmeiras",
        minute: 88,
        scorerName: "Memphis Depay",
        homeScore: 1,
        awayScore: 0,
        matchId: 10,
      },
    });
    assert.equal(pushRes.statusCode, 200);
    const body = JSON.parse(pushRes.payload);
    assert.equal(body.success, true);
    assert.equal(body.topic, "team_1957");
    assert.ok(body.payload.notification.title.includes("CORINTHIANS"));
    assert.ok(body.payload.notification.body.includes("Memphis Depay"));
  });

  test("12. Sincronização ultra-rápida de partidas ao vivo (/api/v1/sync/live)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/sync/live",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(typeof body.liveMatchesCount, "number");
    assert.equal(typeof body.eventsProcessed, "number");
  });

  test("13. Receber e persistir eventos de push do Scraper Multi-Liga (/api/v1/sync/push)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sync/push",
      headers: { "x-api-key": "bf_live_enterprise_9f83a21c45e87b60d4e92a11bf738e45" },
      payload: {
        competitionCode: "PL",
        currentRound: 4,
        competitionMeta: {
          name: "Premier League",
          country: "Inglaterra",
          type: "LEAGUE",
          tournamentId: 17,
          seasonName: "2026/2027",
        },
        events: [
          {
            id: 9999001,
            slug: "arsenal-chelsea",
            startTimestamp: 1789243200,
            status: { code: 100, description: "Ended", type: "finished" },
            homeTeam: { id: 42, name: "Arsenal", shortName: "Arsenal", nameCode: "ARS", country: { name: "Inglaterra" } },
            awayTeam: { id: 38, name: "Chelsea", shortName: "Chelsea", nameCode: "CHE", country: { name: "Inglaterra" } },
            homeScore: { current: 2, display: 2 },
            awayScore: { current: 1, display: 1 },
          },
        ],
        standings: [
          {
            position: 1,
            team: { id: 42, name: "Arsenal", shortName: "Arsenal", nameCode: "ARS" },
            points: 12,
            matches: 4,
            wins: 4,
            draws: 0,
            losses: 0,
            scoresFor: 10,
            scoresAgainst: 2,
          },
        ],
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.matchesSynced >= 1);
    assert.ok(body.standingsSynced >= 1);
  });

  test("14. Listar ligas e competições suportadas para notícias (/api/v1/news/leagues)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/news/leagues",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.total >= 10);
    assert.ok(Array.isArray(body.leagues));
    assert.ok(body.leagues.some((l: any) => l.espnCode === "bra.1"));
    assert.ok(body.leagues.some((l: any) => l.espnCode === "eng.1"));
    assert.ok(body.leagues.some((l: any) => l.espnCode === "conmebol.libertadores"));
  });

  test("15. Obter feed de notícias do Brasileirão (/api/v1/news?league=bra.1&limit=5)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/news?league=bra.1&limit=5",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.league, "bra.1");
    assert.ok(body.total > 0);
    assert.ok(Array.isArray(body.articles));
    const first = body.articles[0];
    assert.ok(first.id);
    assert.ok(first.title);
    assert.equal(first.source, "ESPN Brasil");
    assert.ok(first.url.startsWith("http"));
  });

  test("16. Obter notícias com filtro de clube (/api/v1/news?team=santos&limit=5)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/news?team=santos&limit=5",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body.articles));
    // Cada notícia retornada deve ter ligação com o termo filtrado
    for (const article of body.articles) {
      const match =
        article.title.toLowerCase().includes("santos") ||
        article.description.toLowerCase().includes("santos") ||
        article.categories.teams.some((t: any) => t.name.toLowerCase().includes("santos"));
      assert.ok(match, `Notícia "${article.title}" deve ter relação com o Santos`);
    }
  });

  test("17. Obter currículo de carreira consolidado do atleta (/api/v1/players/:id/career)", async () => {
    // Buscar Memphis Depay
    const searchRes = await app.inject({
      method: "GET",
      url: "/api/v1/players?search=Memphis",
      headers: { "x-api-key": DEMO_KEY },
    });
    const depay = JSON.parse(searchRes.payload).data[0];

    const careerRes = await app.inject({
      method: "GET",
      url: `/api/v1/players/${depay.id}/career`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(careerRes.statusCode, 200);
    const body = JSON.parse(careerRes.payload);
    assert.ok(body.player);
    assert.equal(body.player.knownName, "Memphis Depay");
    assert.ok(body.careerTotals);
    assert.equal(typeof body.careerTotals.totalAppearances, "number");
    assert.equal(typeof body.careerTotals.totalGoals, "number");
    assert.ok(Array.isArray(body.breakdownBySeason));
    assert.ok(Array.isArray(body.clubs));
  });

  test("18. Obter ranking de Clean Sheets / Goleiros (/api/v1/competitions/:id/top-clean-sheets)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/competitions/29/top-clean-sheets?limit=5",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.competitionId, 29);
    assert.ok(Array.isArray(body.topCleanSheets));
  });

  test("19. Configuração e suporte a Futebol Feminino (Brasileirão Feminino, NWSL, UWCL, Liga F)", async () => {
    const { TOURNAMENTS_CONFIG } = await import("../src/services/sofascoreSync.js");
    const femaleCodes = ["BRA-W1", "NWSL", "UWCL", "LIGA-F"];
    for (const code of femaleCodes) {
      const found = TOURNAMENTS_CONFIG.find((t) => t.code === code);
      assert.ok(found, `Torneio feminino ${code} deve estar configurado no TOURNAMENTS_CONFIG`);
      assert.ok(found.tournamentId > 0);
      assert.ok(found.seasonId > 0);
      assert.ok(found.hasStandings === true);
    }
  });

  test("20. Busca Global Unificada (/api/v1/search?q=Flamengo)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=Flamengo&limit=3",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.query, "Flamengo");
    assert.ok(body.counts);
    assert.ok(Array.isArray(body.teams));
    assert.ok(Array.isArray(body.players));
    assert.ok(Array.isArray(body.competitions));
    assert.ok(Array.isArray(body.news));
  });

  test("21. Calendário e Forma Recente do Clube (/api/v1/teams/:id/fixtures)", async () => {
    // Buscar primeiro time da base
    const teamsRes = await app.inject({
      method: "GET",
      url: "/api/v1/teams?limit=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    const teamsList = JSON.parse(teamsRes.payload);
    const firstTeam = Array.isArray(teamsList) ? teamsList[0] : teamsList.data[0];

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/teams/${firstTeam.id}/fixtures?limit=5`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.team);
    assert.equal(body.team.id, firstTeam.id);
    assert.ok(Array.isArray(body.form));
    assert.ok(Array.isArray(body.pastMatches));
    assert.ok(Array.isArray(body.nextMatches));
  });

  test("22. Comparador Raio-X de Atletas (/api/v1/players/compare)", async () => {
    const playersRes = await app.inject({
      method: "GET",
      url: "/api/v1/players?limit=2",
      headers: { "x-api-key": DEMO_KEY },
    });
    const playerList = JSON.parse(playersRes.payload).data;
    const p1 = playerList[0].id;
    const p2 = playerList[1].id;

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/players/compare?p1=${p1}&p2=${p2}`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.player1);
    assert.ok(body.player2);
    assert.equal(body.player1.id, p1);
    assert.equal(body.player2.id, p2);
    assert.ok(body.player1.stats);
    assert.ok(body.player2.stats);
    assert.ok(typeof body.player1.stats.goalsPer90 === "number");
    assert.ok(body.statisticalEdge);
  });

  test("23. Tabela Virtual em Tempo Real (/api/v1/standings/live)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/standings/live?seasonId=3",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.seasonId, 3);
    assert.ok(typeof body.liveMatchesCount === "number");
    assert.ok(typeof body.hasLiveChanges === "boolean");
    assert.ok(Array.isArray(body.standings));
    if (body.standings.length > 0) {
      assert.ok(["UP", "DOWN", "SAME"].includes(body.standings[0].movement));
      assert.ok(typeof body.standings[0].movementDelta === "number");
    }
  });

  test("24. Mercado da Bola e Transferências (/api/v1/transfers)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transfers?limit=5",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.total > 0);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.marketSummary);
    const transfer = body.data[0];
    assert.ok(transfer.player.name);
    assert.ok(transfer.fromTeam.name);
    assert.ok(transfer.toTeam.name);
    assert.ok(transfer.type);
    assert.ok(transfer.transferDate);
  });
});



