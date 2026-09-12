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
});

