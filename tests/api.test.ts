import { test, describe, beforeAll as before, afterAll as after } from "vitest";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { buildApp } from "../src/app.js";
import { client, db } from "../src/db/index.js";
import { apiKeys } from "../src/db/schema.js";
import { hashPassword } from "../src/utils/password.js";
import { apiKeyPrefix, hashApiKey } from "../src/utils/apiKey.js";
import { eq, inArray } from "drizzle-orm";

describe("BrasaFut API - Testes de Integração e Melhorias", () => {
  let app: ReturnType<typeof buildApp>;

  // Credenciais criadas em runtime: nenhuma chave ou senha fica fixa no código.
  let DEMO_KEY: string;
  let FREE_KEY: string;
  let FREE_ONLY_KEY: string;
  let ENTERPRISE_KEY: string;
  const ENTERPRISE_EMAIL = `enterprise_test_${randomBytes(6).toString("hex")}@brasafut.internal`;
  const ENTERPRISE_PASSWORD = `Pwd!${randomBytes(9).toString("base64url")}`;

  before(async () => {
    app = buildApp();
    await app.ready();

    const suffix = randomBytes(10).toString("hex");
    DEMO_KEY = `bf_live_demo_${suffix}`;
    FREE_KEY = `bf_live_free_${suffix}`;
    FREE_ONLY_KEY = `bf_live_freeonly_${suffix}`;
    ENTERPRISE_KEY = `bf_live_enterprise_${suffix}`;

    await db.insert(apiKeys).values([
      {
        userName: `Test Demo ${suffix}`,
        email: `demo_${suffix}@brasafut.internal`,
        passwordHash: hashPassword("testpassword123"),
        keyHash: hashApiKey(DEMO_KEY),
        keyPrefix: apiKeyPrefix(DEMO_KEY),
        plan: "ENTERPRISE",
        rateLimitPerMinute: 1000,
        isActive: true,
      },
      {
        userName: `Test Free ${suffix}`,
        email: `free_${suffix}@brasafut.internal`,
        passwordHash: hashPassword("testpassword123"),
        keyHash: hashApiKey(FREE_KEY),
        keyPrefix: apiKeyPrefix(FREE_KEY),
        plan: "FREE",
        rateLimitPerMinute: 10,
        isActive: true,
      },
      {
        userName: `Test Free Only ${suffix}`,
        email: `freeonly_${suffix}@brasafut.internal`,
        passwordHash: hashPassword("testpassword123"),
        keyHash: hashApiKey(FREE_ONLY_KEY),
        keyPrefix: apiKeyPrefix(FREE_ONLY_KEY),
        plan: "FREE",
        rateLimitPerMinute: 10,
        isActive: true,
      },
      {
        userName: `Test Enterprise ${suffix}`,
        email: ENTERPRISE_EMAIL,
        passwordHash: hashPassword(ENTERPRISE_PASSWORD),
        keyHash: hashApiKey(ENTERPRISE_KEY),
        keyPrefix: apiKeyPrefix(ENTERPRISE_KEY),
        plan: "ENTERPRISE",
        rateLimitPerMinute: 1000,
        isActive: true,
      },
    ]);
  });

  after(async () => {
    await db
      .delete(apiKeys)
      .where(
        inArray(apiKeys.keyHash, [
          hashApiKey(DEMO_KEY),
          hashApiKey(FREE_KEY),
          hashApiKey(FREE_ONLY_KEY),
          hashApiKey(ENTERPRISE_KEY),
        ])
      )
      .catch(() => {});
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
        apiKey: FREE_KEY,
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

    // 3. Status atualizado (somente a conta dona da cobrança)
    const statusRes = await app.inject({
      method: "GET",
      url: `/api/v1/billing/status/${checkoutData.paymentId}`,
      headers: { "x-api-key": FREE_KEY },
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
        login: ENTERPRISE_EMAIL,
        password: ENTERPRISE_PASSWORD,
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const body = JSON.parse(loginRes.payload);
    assert.ok(body.message.startsWith("Login realizado com sucesso!"));
    // A chave não é mais devolvida no login: apenas o prefixo de identificação.
    assert.equal(body.apiKey, undefined);
    assert.equal(body.keyPrefix.length, 12);
    assert.ok(body.keyPrefix.startsWith("bf_live"));
    assert.equal(body.user.plan, "ENTERPRISE");
    assert.equal(body.user.rateLimitPerMinute, 1000);
  });

  test("9. Login com senha incorreta deve falhar com 401", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        login: ENTERPRISE_EMAIL,
        password: "SenhaErrada123",
      },
    });
    assert.equal(loginRes.statusCode, 401);
    const body = JSON.parse(loginRes.payload);
    assert.ok(body.error.includes("Credenciais inválidas"));
  });

  test("9b. Rotação de chave emite nova chave e invalida a anterior", async () => {
    const rotateRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/keys/rotate",
      payload: {
        login: ENTERPRISE_EMAIL,
        password: ENTERPRISE_PASSWORD,
      },
    });
    assert.equal(rotateRes.statusCode, 200);
    const rotated = JSON.parse(rotateRes.payload);
    assert.ok(rotated.key.startsWith("bf_live_enterprise_"));
    assert.equal(rotated.keyPrefix.length, 12);

    // A nova chave autentica normalmente
    const comNovaChave = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { "x-api-key": rotated.key },
    });
    assert.equal(comNovaChave.statusCode, 200);
    assert.equal(JSON.parse(comNovaChave.payload).keyPrefix, rotated.keyPrefix);

    // A chave anterior deixa de existir
    const comChaveAntiga = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { "x-api-key": ENTERPRISE_KEY },
    });
    assert.equal(comChaveAntiga.statusCode, 401);

    // Senha errada não permite rotação
    const senhaErrada = await app.inject({
      method: "POST",
      url: "/api/v1/auth/keys/rotate",
      payload: { login: ENTERPRISE_EMAIL, password: "SenhaErrada123" },
    });
    assert.equal(senhaErrada.statusCode, 401);

    ENTERPRISE_KEY = rotated.key;
  });

  test("10. Acesso com chave Enterprise retorna perfil correto em /api/v1/auth/me", async () => {
    const meRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { "x-api-key": ENTERPRISE_KEY },
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
      headers: { "x-api-key": ENTERPRISE_KEY },
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
      headers: { "x-api-key": ENTERPRISE_KEY },
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

  test("25. Inteligência Preditiva e Probabilidades Pré-Jogo (/api/v1/matches/:id/predictions)", async () => {
    // Buscar primeira partida do banco
    const matchesRes = await app.inject({
      method: "GET",
      url: "/api/v1/matches?limit=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    const matchesList = JSON.parse(matchesRes.payload);
    const match = Array.isArray(matchesList) ? matchesList[0] : matchesList.data[0];

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/matches/${match.id}/predictions`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.matchId, match.id);
    assert.ok(body.homeTeam);
    assert.ok(body.awayTeam);
    assert.ok(body.probabilities);
    assert.ok(typeof body.probabilities.homeWinPct === "number");
    assert.ok(typeof body.probabilities.drawPct === "number");
    assert.ok(typeof body.probabilities.awayWinPct === "number");
    assert.equal(
      body.probabilities.homeWinPct + body.probabilities.drawPct + body.probabilities.awayWinPct,
      100
    );
    assert.ok(body.goalsExpected);
    assert.ok(body.bothTeamsToScore);
    assert.ok(Array.isArray(body.mostLikelyScores));
    assert.ok(Array.isArray(body.insights));
  });

  test("26. Gráfico de Pressão e Attack Momentum (/api/v1/matches/:id/momentum)", async () => {
    const matchesRes = await app.inject({
      method: "GET",
      url: "/api/v1/matches?limit=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    const matchesList = JSON.parse(matchesRes.payload);
    const match = Array.isArray(matchesList) ? matchesList[0] : matchesList.data[0];

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/matches/${match.id}/momentum`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.matchId, match.id);
    assert.ok(body.summary);
    assert.ok(typeof body.summary.homeDominancePct === "number");
    assert.ok(Array.isArray(body.timeline));
    assert.ok(body.timeline.length >= 80);
    const point = body.timeline[10];
    assert.ok(point.minute);
    assert.ok(typeof point.value === "number");
    assert.ok(["home", "away", "neutral"].includes(point.dominantTeam));
  });

  test("27. Mapa de Finalizações no Campo / Shot Map (/api/v1/matches/:id/shot-map)", async () => {
    const matchesRes = await app.inject({
      method: "GET",
      url: "/api/v1/matches?limit=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    const matchesList = JSON.parse(matchesRes.payload);
    const match = Array.isArray(matchesList) ? matchesList[0] : matchesList.data[0];

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/matches/${match.id}/shot-map`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.matchId, match.id);
    assert.ok(body.summary);
    assert.ok(body.summary.home);
    assert.ok(body.summary.away);
    assert.ok(typeof body.summary.home.expectedGoals === "number");
    assert.ok(Array.isArray(body.shots));
    assert.ok(body.shots.length > 0);
    const shot = body.shots[0];
    assert.ok(shot.coordinates);
    assert.ok(typeof shot.coordinates.x === "number");
    assert.ok(typeof shot.coordinates.y === "number");
    assert.ok(["GOAL", "SAVED", "MISSED", "BLOCKED", "POST"].includes(shot.outcome));
    assert.ok(typeof shot.expectedGoals === "number");
  });

  test("28. Departamento Médico e Desfalques (/api/v1/teams/:id/absences e /api/v1/matches/:id/absences)", async () => {
    // Buscar primeiro time
    const teamsRes = await app.inject({
      method: "GET",
      url: "/api/v1/teams?limit=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    const teamsList = JSON.parse(teamsRes.payload);
    const firstTeam = Array.isArray(teamsList) ? teamsList[0] : teamsList.data[0];

    const teamAbsRes = await app.inject({
      method: "GET",
      url: `/api/v1/teams/${firstTeam.id}/absences`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(teamAbsRes.statusCode, 200);
    const teamAbsBody = JSON.parse(teamAbsRes.payload);
    assert.ok(teamAbsBody.team);
    assert.ok(Array.isArray(teamAbsBody.absences));

    // Partida absences
    const matchesRes = await app.inject({
      method: "GET",
      url: "/api/v1/matches?limit=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    const matchesList = JSON.parse(matchesRes.payload);
    const match = Array.isArray(matchesList) ? matchesList[0] : matchesList.data[0];

    const matchAbsRes = await app.inject({
      method: "GET",
      url: `/api/v1/matches/${match.id}/absences`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(matchAbsRes.statusCode, 200);
    const matchAbsBody = JSON.parse(matchAbsRes.payload);
    assert.equal(matchAbsBody.matchId, match.id);
    assert.ok(matchAbsBody.homeTeam);
    assert.ok(matchAbsBody.awayTeam);
    assert.ok(typeof matchAbsBody.totalAbsences === "number");
  });

  test("29. Seleção da Rodada (Team of the Week / Best XI) (/api/v1/competitions/:id/team-of-the-week)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/competitions/1/team-of-the-week?round=26",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.competitionId, 1);
    assert.equal(body.formation, "4-3-3");
    assert.ok(body.playerOfTheRound);
    assert.ok(Array.isArray(body.eleven));
    assert.equal(body.eleven.length, 11);
    const player1 = body.eleven[0];
    assert.ok(player1.player.name);
    assert.ok(player1.tacticalRole);
    assert.ok(player1.roundRating);
  });

  test("30. Simulador de Tabela e Probabilidades (/api/v1/standings/simulate)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/standings/simulate",
      headers: { "x-api-key": DEMO_KEY },
      payload: {
        seasonId: 3,
        predictions: [
          { matchId: 33, homeScore: 3, awayScore: 0 },
          { matchId: 34, homeScore: 1, awayScore: 2 },
        ],
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.seasonId, 3);
    assert.equal(body.simulatedMatchesCount, 2);
    assert.ok(Array.isArray(body.standings));
    assert.ok(body.standings.length > 0);
    const topTeam = body.standings[0];
    assert.equal(topTeam.currentPosition, 1);
    assert.ok(topTeam.probabilities);
    assert.ok(typeof topTeam.probabilities.championPct === "number");
    assert.ok(typeof topTeam.probabilities.libertadoresPct === "number");
    assert.ok(typeof topTeam.probabilities.relegationPct === "number");
  });

  test("31. Engine de Pontuação Fantasy da Partida (/api/v1/matches/:id/fantasy)", async () => {
    const matchesRes = await app.inject({
      method: "GET",
      url: "/api/v1/matches?limit=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    const matchesList = JSON.parse(matchesRes.payload);
    const match = Array.isArray(matchesList) ? matchesList[0] : matchesList.data[0];

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/matches/${match.id}/fantasy`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.matchId, match.id);
    assert.ok(body.mvpFantasy);
    assert.ok(Array.isArray(body.homePlayers));
    assert.ok(Array.isArray(body.awayPlayers));
    const p1 = body.homePlayers[0];
    assert.ok(p1.player.name);
    assert.ok(typeof p1.fantasyScore === "number");
    assert.ok(p1.breakdown);
  });

  test("32. Histórico de Pontuação Fantasy do Atleta (/api/v1/players/:id/fantasy)", async () => {
    const playersRes = await app.inject({
      method: "GET",
      url: "/api/v1/players?limit=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    const player = JSON.parse(playersRes.payload).data[0];

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/players/${player.id}/fantasy`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.player.id, player.id);
    assert.ok(body.seasonSummary);
    assert.ok(typeof body.seasonSummary.averageFantasyScore === "number");
    assert.ok(Array.isArray(body.rounds));
  });

  test("33. Raio-X Histórico de Duelo de Clubes (/api/v1/teams/:team1Id/vs/:team2Id)", async () => {
    const teamsRes = await app.inject({
      method: "GET",
      url: "/api/v1/teams?limit=2",
      headers: { "x-api-key": DEMO_KEY },
    });
    const teamsList = JSON.parse(teamsRes.payload);
    const t1 = teamsList[0].id;
    const t2 = teamsList[1].id;

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/teams/${t1}/vs/${t2}`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.team1.id, t1);
    assert.equal(body.team2.id, t2);
    assert.ok(body.summary);
    assert.ok(typeof body.summary.totalMatches === "number");
    assert.ok(typeof body.summary.averageGoalsPerMatch === "number");
    assert.ok(Array.isArray(body.recentMatches));
  });

  test("34. Central de Árbitros e Scouts de Arbitragem (/api/v1/referees)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/referees",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.total > 0);
    assert.ok(Array.isArray(body.data));
    const ref1 = body.data[0];
    assert.ok(ref1.name);
    assert.ok(ref1.stats);
    assert.ok(typeof ref1.stats.yellowCardsPerMatch === "number");

    // Detalhes do árbitro
    const statsRes = await app.inject({
      method: "GET",
      url: `/api/v1/referees/${ref1.id}/stats`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(statsRes.statusCode, 200);
    const statsBody = JSON.parse(statsRes.payload);
    assert.equal(statsBody.referee.id, ref1.id);
    assert.ok(statsBody.scout.profile);
    assert.ok(statsBody.scout.matchOutcomes);
  });

  test("35. Exportação de Dados em Formato CSV (/api/v1/export/*)", async () => {
    // Exportar Tabela
    const stdRes = await app.inject({
      method: "GET",
      url: "/api/v1/export/standings?seasonId=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(stdRes.statusCode, 200);
    assert.ok(stdRes.headers["content-type"]?.includes("text/csv"));
    assert.ok(stdRes.payload.includes("Posicao,Clube,Sigla,Pontos"));

    // Exportar Atletas
    const plyRes = await app.inject({
      method: "GET",
      url: "/api/v1/export/players?seasonId=1&limit=5",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(plyRes.statusCode, 200);
    assert.ok(plyRes.headers["content-type"]?.includes("text/csv"));
    assert.ok(plyRes.payload.includes("ID,Nome,Clube,Posicao"));
  });

  test("36. Heatmaps e Zonas de Ação (/matches/:id/heatmap e /players/:id/heatmap)", async () => {
    // Heatmap da partida
    const matchHeatRes = await app.inject({
      method: "GET",
      url: "/api/v1/matches/1/heatmap",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(matchHeatRes.statusCode, 200);
    const matchHeatBody = JSON.parse(matchHeatRes.payload);
    assert.ok(matchHeatBody.homeTeam);
    assert.ok(matchHeatBody.awayTeam);
    assert.ok(Array.isArray(matchHeatBody.homeTeam.points));
    assert.ok(matchHeatBody.homeTeam.actionZones.thirds);
    assert.ok(typeof matchHeatBody.homeTeam.actionZones.thirds.defensiveThird === "number");

    // Heatmap do jogador
    const playerHeatRes = await app.inject({
      method: "GET",
      url: "/api/v1/players/1/heatmap?matchId=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(playerHeatRes.statusCode, 200);
    const playerHeatBody = JSON.parse(playerHeatRes.payload);
    assert.ok(playerHeatBody.playerId > 0);
    assert.ok(Array.isArray(playerHeatBody.points));
    assert.ok(playerHeatBody.actionZones.flanks);
  });

  test("37. Comparador Tático de Clubes na Temporada (/teams/compare)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/teams/compare?team1=1&team2=2&seasonId=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.team1);
    assert.ok(body.team2);
    assert.ok(body.tacticalVerdict);
    assert.ok(typeof body.team1.stats.points === "number");
    assert.ok(typeof body.team2.stats.winPercentage === "number");
    assert.ok(body.tacticalVerdict.offensiveAdvantage);
  });

  test("38. Central de Odds e Fair Odds de Partidas (/odds/matches/:id)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/odds/matches/1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.fairOdds);
    assert.ok(body.consensusOdds);
    assert.ok(Array.isArray(body.bookmakers));
    assert.ok(body.bookmakers.length >= 3);
    assert.ok(typeof body.fairOdds.market1X2.home === "number");
    assert.ok(typeof body.bookmakers[0].market1X2.draw === "number");
  });

  test("39. Radar de Value Bets (EV+) (/odds/value-bets)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/odds/value-bets?minEv=2.0",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(typeof body.totalFound === "number");
    assert.ok(Array.isArray(body.opportunities));
    if (body.opportunities.length > 0) {
      const opp = body.opportunities[0];
      assert.ok(opp.offeredOdd > opp.fairOdd || opp.expectedValuePct >= 2.0);
      assert.ok(opp.bookmaker);
      assert.ok(opp.recommendation);
    }
  });

  test("40. Central de DM e Observatório de Lesões (/injuries/report e /injuries/teams/:id)", async () => {
    // Relatório geral
    const repRes = await app.inject({
      method: "GET",
      url: "/api/v1/injuries/report?seasonId=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(repRes.statusCode, 200);
    const repBody = JSON.parse(repRes.payload);
    assert.ok(repBody.overview);
    assert.ok(typeof repBody.overview.totalPlayersInjured === "number");
    assert.ok(Array.isArray(repBody.clubsRanking));

    // Boletim do clube
    const teamInjRes = await app.inject({
      method: "GET",
      url: "/api/v1/injuries/teams/1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(teamInjRes.statusCode, 200);
    const teamInjBody = JSON.parse(teamInjRes.payload);
    assert.ok(teamInjBody.team.id > 0);
    assert.ok(Array.isArray(teamInjBody.medicalReport));
    if (teamInjBody.medicalReport.length > 0) {
      assert.ok(teamInjBody.medicalReport[0].injuryDiagnosis);
      assert.ok(teamInjBody.medicalReport[0].returnEstimate);
    }
  });

  test("41. Sala de Troféus e Histórico de Campeões (/teams/:id/trophies e /competitions/:id/champions)", async () => {
    // Troféus do clube
    const trofRes = await app.inject({
      method: "GET",
      url: "/api/v1/teams/1/trophies",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(trofRes.statusCode, 200);
    const trofBody = JSON.parse(trofRes.payload);
    assert.ok(trofBody.team.id > 0);
    assert.ok(trofBody.totalTrophiesCount > 0);
    assert.ok(Array.isArray(trofBody.trophies.national));

    // Campeões da competição
    const champRes = await app.inject({
      method: "GET",
      url: "/api/v1/competitions/1/champions",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(champRes.statusCode, 200);
    const champBody = JSON.parse(champRes.payload);
    assert.ok(champBody.competition.id > 0);
    assert.ok(Array.isArray(champBody.allTimeTitlesRanking));
    assert.ok(Array.isArray(champBody.editions));
    assert.ok(champBody.editions[0].champion);
  });

  test("42. Guia de Transmissão de TV & Streaming (/matches/:id/broadcast)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/matches/1/broadcast",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.matchId, 1);
    assert.ok(Array.isArray(body.channels));
    assert.ok(body.channels.length > 0);
    const ch = body.channels[0];
    assert.ok(ch.channelName);
    assert.ok(ch.type);
    assert.ok(typeof ch.isFreeToAir === "boolean");
  });

  test("43. Feed de Narração Lance a Lance Textual (/matches/:id/commentary)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/matches/1/commentary",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.matchId, 1);
    assert.ok(body.totalComments > 0);
    assert.ok(Array.isArray(body.commentary));
    const firstComment = body.commentary[0];
    assert.ok(typeof firstComment.minute === "number");
    assert.ok(firstComment.headline);
    assert.ok(firstComment.text);
    assert.ok(firstComment.type);

    // Teste com filtro importantOnly
    const impRes = await app.inject({
      method: "GET",
      url: "/api/v1/matches/1/commentary?importantOnly=true",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(impRes.statusCode, 200);
    const impBody = JSON.parse(impRes.payload);
    assert.ok(impBody.commentary.every((c: any) => c.isImportant));
  });

  test("44. Supercomputador Preditivo Monte Carlo (/standings/supercomputer)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/standings/supercomputer?seasonId=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.seasonId, 1);
    assert.equal(body.simulationsRun, 10000);
    assert.ok(body.cutoffScores);
    assert.equal(body.cutoffScores.safetyScoreZ4, 45);
    assert.ok(Array.isArray(body.projections));
    assert.ok(body.projections.length > 0);
    const topProj = body.projections[0];
    assert.ok(topProj.projectedFinalPoints > 0);
    assert.ok(typeof topProj.titleProbabilityPct === "number");
    assert.ok(typeof topProj.libertadoresG4ProbabilityPct === "number");
  });

  test("45. Folha Salarial e Fair Play Financeiro (/finances/teams/:id e /finances/ranking)", async () => {
    // Finanças de um clube
    const teamFinRes = await app.inject({
      method: "GET",
      url: "/api/v1/finances/teams/1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(teamFinRes.statusCode, 200);
    const teamFinBody = JSON.parse(teamFinRes.payload);
    assert.ok(teamFinBody.teamId > 0);
    assert.ok(teamFinBody.monthlyPayrollMillionsBrl > 0);
    assert.ok(["HEALTHY", "MODERATE", "RISK_DEFICIT"].includes(teamFinBody.financialFairPlayStatus));
    assert.ok(teamFinBody.costPerPointThousandsBrl > 0);

    // Ranking de finanças
    const rankRes = await app.inject({
      method: "GET",
      url: "/api/v1/finances/ranking?seasonId=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(rankRes.statusCode, 200);
    const rankBody = JSON.parse(rankRes.payload);
    assert.ok(Array.isArray(rankBody.rankingByPayroll));
    assert.ok(Array.isArray(rankBody.rankingByEfficiency));
    assert.ok(rankBody.totalClubsAnalyzed > 0);
  });

  test("46. Radar de Wonderkids e Relatório de Olheiro (/scouting/talents e /scouting/players/:id)", async () => {
    // Lista de promessas
    const talentsRes = await app.inject({
      method: "GET",
      url: "/api/v1/scouting/talents?maxAge=22",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(talentsRes.statusCode, 200);
    const talentsBody = JSON.parse(talentsRes.payload);
    assert.ok(Array.isArray(talentsBody.wonderkids));
    if (talentsBody.wonderkids.length > 0) {
      const kid = talentsBody.wonderkids[0];
      assert.ok(kid.age <= 22);
      assert.ok(kid.potentialRating > 0);
      assert.ok(kid.attributes.pace > 0);
      assert.ok(kid.similarPlaystyle);
    }

    // Ficha individual de scouting
    const scoutRes = await app.inject({
      method: "GET",
      url: "/api/v1/scouting/players/1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(scoutRes.statusCode, 200);
    const scoutBody = JSON.parse(scoutRes.payload);
    assert.ok(scoutBody.playerId > 0);
    assert.ok(scoutBody.attributes.tacticalIQ > 0);
    assert.ok(scoutBody.scoutVerdict.recommendation);
  });

  test("47. Central de Treinadores e Comissões Técnicas (/coaches, /coaches/:id e /coaches/ranking)", async () => {
    // Listar técnicos
    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/coaches",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.payload);
    assert.ok(listBody.total > 0);
    assert.ok(Array.isArray(listBody.data));
    const c1 = listBody.data[0];
    assert.ok(c1.name);
    assert.ok(c1.tacticalDNA.preferredFormation);

    // Ranking de técnicos
    const rankRes = await app.inject({
      method: "GET",
      url: "/api/v1/coaches/ranking?sortBy=winRate",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(rankRes.statusCode, 200);
    const rankBody = JSON.parse(rankRes.payload);
    assert.equal(rankBody.sortBy, "winRate");
    assert.ok(rankBody.ranking[0].overallStats.winPercentage >= rankBody.ranking[1].overallStats.winPercentage);

    // Perfil e carreira de técnico
    const coachRes = await app.inject({
      method: "GET",
      url: "/api/v1/coaches/1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(coachRes.statusCode, 200);
    const coachBody = JSON.parse(coachRes.payload);
    assert.equal(coachBody.shortName, "Filipe Luís");
    assert.ok(coachBody.trophiesCount > 0);

    const careerRes = await app.inject({
      method: "GET",
      url: "/api/v1/coaches/1/career",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(careerRes.statusCode, 200);
    const careerBody = JSON.parse(careerRes.payload);
    assert.ok(Array.isArray(careerBody.careerHistory));
  });

  test("48. Grandes Clássicos e Dérbis Históricos (/derbies e /derbies/:slug)", async () => {
    // Listar dérbis
    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/derbies",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.payload);
    assert.ok(listBody.total >= 4);
    assert.ok(listBody.derbies.some((d: any) => d.slug === "derbi-paulista"));
    assert.ok(listBody.derbies.some((d: any) => d.slug === "fla-flu"));

    // Detalhes do Dérbi Paulista
    const derbyRes = await app.inject({
      method: "GET",
      url: "/api/v1/derbies/derbi-paulista",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(derbyRes.statusCode, 200);
    const derbyBody = JSON.parse(derbyRes.payload);
    assert.equal(derbyBody.slug, "derbi-paulista");
    assert.ok(derbyBody.allTimeStats.totalMatches > 350);
    assert.ok(derbyBody.biggestVictories.team1.score);
    assert.ok(Array.isArray(derbyBody.allTimeTopScorers));
    assert.ok(derbyBody.allTimeTopScorers.length > 0);
  });

  test("49. Central do VAR e Tabela do VAR Líquido (/var/matches/:id e /var/competitions/:id/table)", async () => {
    // Auditoria de partida
    const varRes = await app.inject({
      method: "GET",
      url: "/api/v1/var/matches/1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(varRes.statusCode, 200);
    const varBody = JSON.parse(varRes.payload);
    assert.equal(varBody.matchId, 1);
    assert.ok(Array.isArray(varBody.incidents));
    if (varBody.incidents.length > 0) {
      assert.ok(varBody.incidents[0].varRecommendation);
      assert.ok(varBody.incidents[0].audioTranscript);
    }

    // Tabela do VAR da competição
    const tableRes = await app.inject({
      method: "GET",
      url: "/api/v1/var/competitions/1/table",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(tableRes.statusCode, 200);
    const tableBody = JSON.parse(tableRes.payload);
    assert.ok(Array.isArray(tableBody.table));
    assert.ok(tableBody.mostFavoredTeam);
    assert.ok(tableBody.mostPenalizedTeam);
  });

  test("50. Prancheta Tática 2D e DNA Tático (/matches/:id/tactical-lineup e /teams/:id/tactical-dna)", async () => {
    // Prancheta tática do jogo
    const tacticRes = await app.inject({
      method: "GET",
      url: "/api/v1/matches/1/tactical-lineup",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(tacticRes.statusCode, 200);
    const tacticBody = JSON.parse(tacticRes.payload);
    assert.ok(tacticBody.homeTeam.starters);
    assert.equal(tacticBody.homeTeam.starters.length, 11);
    const p1 = tacticBody.homeTeam.starters[0];
    assert.ok(p1.coordinates);
    assert.ok(typeof p1.coordinates.x === "number");
    assert.ok(typeof p1.coordinates.y === "number");
    assert.ok(p1.tacticalRole);

    // DNA Tático do time
    const dnaRes = await app.inject({
      method: "GET",
      url: "/api/v1/teams/1/tactical-dna",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(dnaRes.statusCode, 200);
    const dnaBody = JSON.parse(dnaRes.payload);
    assert.ok(dnaBody.philosophy);
    assert.ok(dnaBody.metrics.possessionAveragePct > 0);
    assert.ok(dnaBody.metrics.highPressingIntensityPpda > 0);
  });

  test("51. Central de Pênaltis e Goleiros Pegadores (/penalties/takers, /penalties/goalkeepers e /penalties/matches/:id/shootout)", async () => {
    // Ranking batedores
    const takersRes = await app.inject({
      method: "GET",
      url: "/api/v1/penalties/takers?limit=5",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(takersRes.statusCode, 200);
    const takersBody = JSON.parse(takersRes.payload);
    assert.ok(Array.isArray(takersBody.ranking));
    assert.ok(takersBody.ranking[0].conversionRatePct > 80);
    assert.ok(takersBody.ranking[0].favoriteTargetZone);

    // Ranking goleiros
    const gkRes = await app.inject({
      method: "GET",
      url: "/api/v1/penalties/goalkeepers?limit=5",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(gkRes.statusCode, 200);
    const gkBody = JSON.parse(gkRes.payload);
    assert.ok(Array.isArray(gkBody.ranking));
    assert.ok(gkBody.ranking[0].savePercentagePct > 20);

    // Disputa pós-jogo
    const shootRes = await app.inject({
      method: "GET",
      url: "/api/v1/penalties/matches/1/shootout",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(shootRes.statusCode, 200);
    const shootBody = JSON.parse(shootRes.payload);
    assert.ok(shootBody.winnerTeam);
    assert.ok(Array.isArray(shootBody.kicks));
    assert.ok(shootBody.kicks.length >= 5);
  });

  test("52. Público, Bilheteria e Ocupação dos Estádios (/attendance/competitions/:id e /attendance/venues/:id)", async () => {
    // Ranking de público da liga
    const attRes = await app.inject({
      method: "GET",
      url: "/api/v1/attendance/competitions/1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(attRes.statusCode, 200);
    const attBody = JSON.parse(attRes.payload);
    assert.ok(attBody.leagueTotalAttendance > 0);
    assert.ok(Array.isArray(attBody.ranking));
    const topClub = attBody.ranking[0];
    assert.ok(topClub.averageAttendance > 0);
    assert.ok(topClub.averageOccupancyRatePct > 0);
    assert.ok(topClub.recordCrowd);

    // Estádio recordes
    const venRes = await app.inject({
      method: "GET",
      url: "/api/v1/attendance/venues/1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(venRes.statusCode, 200);
    const venBody = JSON.parse(venRes.payload);
    assert.ok(venBody.venueName);
    assert.ok(venBody.allTimeRecord.crowd > 0);
  });

  test("53. Paleta de Cores e Uniformes de Jogo (/teams/:id/kits e /matches/:id/kits)", async () => {
    // Uniformes do clube
    const teamKitsRes = await app.inject({
      method: "GET",
      url: "/api/v1/teams/1/kits",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(teamKitsRes.statusCode, 200);
    const teamKitsBody = JSON.parse(teamKitsRes.payload);
    assert.ok(teamKitsBody.kits.home.shirtColor.startsWith("#"));
    assert.ok(teamKitsBody.kits.away.shirtColor.startsWith("#"));

    // Combinação para a partida
    const matchKitsRes = await app.inject({
      method: "GET",
      url: "/api/v1/matches/1/kits",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(matchKitsRes.statusCode, 200);
    const matchKitsBody = JSON.parse(matchKitsRes.payload);
    assert.ok(matchKitsBody.homeTeam.kit.shirtColor);
    assert.ok(matchKitsBody.awayTeam.kit.shirtColor);
    assert.equal(matchKitsBody.contrastQuality, "OPTIMAL");
  });

  test("54. Premiações da Temporada, Bola de Ouro e Seleção Ideal (/awards/season)", async () => {
    const awardsRes = await app.inject({
      method: "GET",
      url: "/api/v1/awards/season?competitionId=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(awardsRes.statusCode, 200);
    const awardsBody = JSON.parse(awardsRes.payload);
    assert.ok(awardsBody.playerOfTheSeason);
    assert.ok(awardsBody.playerOfTheSeason.playerName);
    assert.ok(awardsBody.goldenBoyRevelacao.playerName);
    assert.ok(awardsBody.coachOfTheSeason.coachName);
    assert.ok(Array.isArray(awardsBody.ballonDorRanking));
    assert.ok(Array.isArray(awardsBody.idealStartingEleven.eleven));
    assert.equal(awardsBody.idealStartingEleven.eleven.length, 11);
  });

  test("55. Feeds de Vídeos, Highlights e Geo-Restrictions (/highlights e /highlights/:id/geo-restrictions)", async () => {
    // Feed de highlights com filtro de país
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/highlights?countryCode=BR",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.total > 0);
    assert.equal(body.filters.appliedCountry, "BR");
    assert.ok(Array.isArray(body.data));
    const first = body.data[0];
    assert.ok(first.videoUrl);
    assert.ok(first.embedUrl);
    assert.ok(first.geoRestrictions);
    assert.ok(Array.isArray(first.keyMoments));

    // Consulta de Geo-Restrictions
    const geoRes = await app.inject({
      method: "GET",
      url: `/api/v1/highlights/${first.id}/geo-restrictions`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(geoRes.statusCode, 200);
    const geoBody = JSON.parse(geoRes.payload);
    assert.equal(geoBody.highlightId, first.id);
    assert.ok(["NO_RESTRICTIONS", "ALLOWED_COUNTRIES", "BLOCKED_COUNTRIES"].includes(geoBody.state));
    assert.equal(typeof geoBody.embeddable, "boolean");
  });

  test("56. Melhores Momentos Vinculados à Partida (/matches/:id/highlights)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/matches/1/highlights",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
    assert.equal(body[0].matchId, 1);
    assert.ok(body[0].embedUrl);
  });

  test("57. Scout Individual de Atuação / Match Box Score (/matches/:id/box-score)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/matches/1/box-score",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.matchId, 1);
    assert.ok(body.homeTeam);
    assert.ok(body.awayTeam);
    assert.ok(Array.isArray(body.homeTeam.players));
    assert.ok(Array.isArray(body.awayTeam.players));
    assert.ok(body.mvp);
    assert.ok(body.mvp.playerName);
    assert.ok(body.mvp.rating >= 8.0);

    const starter = body.homeTeam.players[0];
    assert.ok(starter.name);
    assert.ok(typeof starter.rating === "number");
    assert.ok(starter.statistics);
    assert.ok(typeof starter.statistics.passesTotal === "number");
    assert.ok(typeof starter.statistics.tackles === "number");
  });

  test("58. Catálogo de Bookmakers / Casas de Apostas (/odds/bookmakers e /odds/bookmakers/:id)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/odds/bookmakers",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.total >= 5);
    assert.ok(Array.isArray(body.bookmakers));

    // Detalhe de um bookmaker
    const detailRes = await app.inject({
      method: "GET",
      url: "/api/v1/odds/bookmakers/1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(detailRes.statusCode, 200);
    const detail = JSON.parse(detailRes.payload);
    assert.equal(detail.id, 1);
    assert.equal(detail.name, "Bet365");
    assert.ok(detail.averagePayoutPct > 90);
  });

  test("59. Valuation de Atletas e Ranking de Valores de Mercado (/players/:id/market-value e /players/market-values/ranking)", async () => {
    // Ranking de jogadores mais valiosos
    const rankingRes = await app.inject({
      method: "GET",
      url: "/api/v1/players/market-values/ranking?limit=10",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(rankingRes.statusCode, 200);
    const rankingBody = JSON.parse(rankingRes.payload);
    assert.ok(rankingBody.total > 0);
    assert.ok(Array.isArray(rankingBody.ranking));
    assert.ok(rankingBody.ranking[0].marketValueEurMillions > 0);
    assert.ok(rankingBody.ranking[0].marketValueBrlMillions > 0);

    // Detalhe financeiro de um atleta
    const valRes = await app.inject({
      method: "GET",
      url: "/api/v1/players/1/market-value",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(valRes.statusCode, 200);
    const valBody = JSON.parse(valRes.payload);
    assert.equal(valBody.playerId, 1);
    assert.ok(valBody.marketValueEur > 0);
    assert.ok(valBody.releaseClauseDomesticBrl > 0);
    assert.ok(valBody.releaseClauseInternationalEur > 0);
    assert.ok(Array.isArray(valBody.historicalValuation));
  });

  test("60. Power Ranking Dinâmico dos Clubes com Elo e Momentum (/rankings/power-ranking)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/rankings/power-ranking?competitionId=1",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body.rankings));
    assert.ok(body.rankings.length >= 8);
    const top = body.rankings[0];
    assert.equal(top.rank, 1);
    assert.ok(top.eloRating > 1800);
    assert.ok(Array.isArray(top.recentForm));
    assert.ok(typeof top.momentumIndex === "number");
    assert.ok(top.strengthOfSchedule);
  });

  test("61. Guia Global de Transmissões na TV e Streaming (/broadcasts/guide e /broadcasts/today)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/broadcasts/guide",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.totalMatches > 0);
    assert.ok(Array.isArray(body.availableNetworks));
    assert.ok(Array.isArray(body.matches));
    const firstMatch = body.matches[0];
    assert.ok(firstMatch.channels.length > 0);
    assert.ok(firstMatch.channels[0].channelName);

    // Alias /today
    const todayRes = await app.inject({
      method: "GET",
      url: "/api/v1/broadcasts/today",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(todayRes.statusCode, 200);
  });

  test("62. Condições Climáticas, Gramado e Altitude da Partida (/matches/:id/conditions)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/matches/1/conditions",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.matchId, 1);
    assert.ok(body.venue);
    assert.ok(body.pitch);
    assert.ok(body.pitch.surfaceType);
    assert.ok(body.weather);
    assert.ok(typeof body.weather.temperatureCelsius === "number");
    assert.ok(typeof body.weather.humidityPercentage === "number");
    assert.ok(body.intelAnalysis);
    assert.ok(body.intelAnalysis.ballTrajectoryBehavior);
  });

  test("63. Retrospecto Direto da Partida H2H (/matches/:id/h2h)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/matches/1/h2h",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.homeTeamId);
    assert.ok(body.awayTeamId);
    assert.equal(typeof body.totalMatches, "number");
    assert.ok(Array.isArray(body.matches));
  });

  test("64. Tabela de Fair Play e Disciplina da Liga (/competitions/:id/fair-play)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/competitions/1/fair-play",
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.competitionId, 1);
    assert.ok(Array.isArray(body.fairPlayTable));
    assert.ok(body.fairPlayTable.length > 0);
    const leader = body.fairPlayTable[0];
    assert.equal(leader.rank, 1);
    assert.ok(typeof leader.penaltyPoints === "number");
  });

  test("65. Rotas administrativas recusam chave FREE (403)", async () => {
    const rotasAdministrativas: Array<[string, string]> = [
      ["GET", "/api/v1/sync/fix-logos"],
      ["GET", "/api/v1/sync/debug"],
      ["POST", "/api/v1/live/test-fcm-topic"],
      ["POST", "/api/v1/live/test-fcm-goal"],
      ["POST", "/api/v1/auth/enterprise/register"],
      ["POST", "/api/v1/billing/simulate-pix-paid/pay_inexistente"],
    ];

    for (const [method, url] of rotasAdministrativas) {
      const res = await app.inject({
        method: method as "GET" | "POST",
        url,
        headers: { "x-api-key": FREE_ONLY_KEY },
        payload:
          method === "POST"
            ? { userName: "Invasor", email: "invasor@teste.local", password: "senha123" }
            : undefined,
      });
      assert.equal(res.statusCode, 403, `${method} ${url} deveria responder 403`);
    }

    // Nada foi criado indevidamente
    const tentativas = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(eq(apiKeys.email, "invasor@teste.local"));
    assert.equal(tentativas.length, 0);
  });

  test("66. Endpoints administrativos recusam chave sem autenticação (401) e chave inválida", async () => {
    const semChave = await app.inject({ method: "GET", url: "/api/v1/sync/fix-logos" });
    assert.equal(semChave.statusCode, 401);

    const chaveInvalida = await app.inject({
      method: "GET",
      url: "/api/v1/competitions",
      headers: { "x-api-key": "bf_live_chave_que_nao_existe" },
    });
    assert.equal(chaveInvalida.statusCode, 401);
  });

  test("67. API key via query string é recusada (401)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/competitions?api_key=${DEMO_KEY}`,
    });
    assert.equal(res.statusCode, 401);
  });

  test("68. Webhook de Pix exige segredo do gateway e confirma o pagamento", async () => {
    // Cobrança criada para a chave FREE
    const checkout = await app.inject({
      method: "POST",
      url: "/api/v1/billing/checkout",
      headers: { "x-api-key": DEMO_KEY },
      payload: { apiKey: FREE_KEY, targetPlan: "PRO" },
    });
    assert.equal(checkout.statusCode, 200);
    const { paymentId } = JSON.parse(checkout.payload);

    // Sem segredo / com segredo errado → 403
    const semSegredo = await app.inject({
      method: "POST",
      url: "/api/v1/billing/webhook",
      payload: { paymentId },
    });
    assert.equal(semSegredo.statusCode, 403);

    const segredoErrado = await app.inject({
      method: "POST",
      url: "/api/v1/billing/webhook",
      headers: { "x-pix-secret": "segredo-errado" },
      payload: { paymentId },
    });
    assert.equal(segredoErrado.statusCode, 403);

    // Com o segredo correto → confirma e sobe o plano
    const segredoAnterior = process.env.PIX_WEBHOOK_SECRET;
    process.env.PIX_WEBHOOK_SECRET = "segredo-de-teste-pix";
    try {
      const confirmado = await app.inject({
        method: "POST",
        url: "/api/v1/billing/webhook",
        headers: { "x-pix-secret": "segredo-de-teste-pix" },
        payload: { paymentId },
      });
      assert.equal(confirmado.statusCode, 200);
      const body = JSON.parse(confirmado.payload);
      assert.equal(body.success, true);
      assert.equal(body.targetPlan, "PRO");
    } finally {
      if (segredoAnterior === undefined) delete process.env.PIX_WEBHOOK_SECRET;
      else process.env.PIX_WEBHOOK_SECRET = segredoAnterior;
    }

    // A cobrança pertence à conta FREE: outra conta não consegue consultá-la
    const deOutraConta = await app.inject({
      method: "GET",
      url: `/api/v1/billing/status/${paymentId}`,
      headers: { "x-api-key": DEMO_KEY },
    });
    assert.equal(deOutraConta.statusCode, 404);

    const doDono = await app.inject({
      method: "GET",
      url: `/api/v1/billing/status/${paymentId}`,
      headers: { "x-api-key": FREE_KEY },
    });
    assert.equal(doDono.statusCode, 200);
    const status = JSON.parse(doDono.payload);
    assert.equal(status.status, "PAID");
    assert.equal(status.apiKey.keyPrefix, apiKeyPrefix(FREE_KEY));
    assert.equal(status.apiKey.key, undefined);
  });
});





