import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { client } from "../src/db/index.js";
import { randomBytes } from "node:crypto";

/**
 * Suite de segurança + contrato (sem segredos hardcoded, sem dependência
 * de fixtures específicas como BRA-1/Memphis).
 *
 * - Testes 1-6 rodam SEM banco (validam boot, 401 e remoção de DDL público).
 * - Testes com banco são pulados graciosamente se DATABASE_URL indisponível.
 */
describe("BrasaFut API - Segurança e contrato", () => {
  let app: ReturnType<typeof buildApp>;
  let dbAvailable = false;

  before(async () => {
    app = buildApp();
    await app.ready();
    try {
      await client`SELECT 1`;
      dbAvailable = true;
    } catch {
      dbAvailable = false;
      console.warn("⚠️ Banco indisponível — testes de integração com DB serão pulados.");
    }
  });

  after(async () => {
    // Limpeza: remover chaves de teste criadas pela suite (@example.com)
    if (dbAvailable) {
      try {
        await client`DELETE FROM api_keys WHERE email LIKE '%@example.com'`;
      } catch {}
    }
    await app.close();
    try {
      await client.end();
    } catch {}
  });

  test("1. Rota raiz online (sem DB)", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, "online");
    assert.equal(body.name, "BrasaFut API");
  });

  test("1b. Health público e headers de segurança (sem DB)", async () => {
    for (const url of ["/health", "/api/v1/health"]) {
      const res = await app.inject({ method: "GET", url });
      assert.equal(res.statusCode, 200);
      assert.equal(JSON.parse(res.payload).status, "ok");
    }
    const res = await app.inject({ method: "GET", url: "/health" });
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["x-frame-options"], "DENY");
    assert.ok(!res.headers["x-powered-by"]);
  });

  test("2. Rotas protegidas bloqueiam sem API Key (401, sem DB)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/competitions" });
    assert.equal(res.statusCode, 401);
  });

  test("3. /auth/migrate-db NÃO executa DDL sem auth (401/410, nunca 200 com chave)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/auth/migrate-db" });
    assert.ok([401, 410].includes(res.statusCode), `esperado 401/410, obteve ${res.statusCode}`);
    if (res.statusCode === 200) {
      assert.fail("migrate-db retornou 200 — DDL público ainda exposto!");
    }
  });

  test("4. /sync/setup-enterprise NÃO expõe seed sem auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/sync/setup-enterprise" });
    assert.ok([401, 410].includes(res.statusCode), `esperado 401/410, obteve ${res.statusCode}`);
  });

  test("5. /sync/debug exige ENTERPRISE (sem chave => 401)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/sync/debug" });
    assert.equal(res.statusCode, 401);
  });

  test("6. /live/test-fcm-goal sem chave => 401 (anti-abuso)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/live/test-fcm-goal",
      payload: { teamId: 1 },
    });
    assert.equal(res.statusCode, 401);
  });

  test("7. Fluxo register -> me funciona (requer DB)", async (t) => {
    if (!dbAvailable) return t.skip("sem banco");
    const email = `test_${randomBytes(6).toString("hex")}@example.com`;
    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { userName: "CI Tester", email, password: "SenhaForte123!" },
    });
    assert.equal(reg.statusCode, 201);
    const regBody = JSON.parse(reg.payload);
    assert.ok(regBody.key.startsWith("bf_live_"));

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { "x-api-key": regBody.key },
    });
    assert.equal(me.statusCode, 200);
    assert.equal(JSON.parse(me.payload).plan, "FREE");
  });

  test("8. enterprise/register sem x-admin-key => 403 (requer DB)", async (t) => {
    if (!dbAvailable) return t.skip("sem banco");
    const email = `ent_${randomBytes(6).toString("hex")}@example.com`;
    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { userName: "Owner", email, password: "SenhaForte123!" },
    });
    const key = JSON.parse(reg.payload).key;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/enterprise/register",
      headers: { "x-api-key": key },
      payload: { userName: "Hacker", email: `hack_${randomBytes(4).toString("hex")}@example.com`, password: "SenhaForte123!" },
    });
    assert.equal(res.statusCode, 403);
  });

  test("9. FCM com chave FREE => 403 (requer DB)", async (t) => {
    if (!dbAvailable) return t.skip("sem banco");
    const email = `fcm_${randomBytes(6).toString("hex")}@example.com`;
    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { userName: "Fcm User", email, password: "SenhaForte123!" },
    });
    const key = JSON.parse(reg.payload).key;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/live/test-fcm-goal",
      headers: { "x-api-key": key },
      payload: { teamId: 1 },
    });
    assert.equal(res.statusCode, 403);
  });

  test("10. Billing checkout com IDOR bloqueado (requer DB)", async (t) => {
    if (!dbAvailable) return t.skip("sem banco");
    const a = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { userName: "User A", email: `a_${randomBytes(6).toString("hex")}@example.com`, password: "SenhaForte123!" },
    });
    const b = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { userName: "User B", email: `b_${randomBytes(6).toString("hex")}@example.com`, password: "SenhaForte123!" },
    });
    const keyA = JSON.parse(a.payload).key;
    const keyB = JSON.parse(b.payload).key;

    // A tenta gerar cobrança para a chave de B => 403
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/billing/checkout",
      headers: { "x-api-key": keyA },
      payload: { apiKey: keyB, targetPlan: "PRO" },
    });
    assert.equal(res.statusCode, 403);
  });

  test("11. Billing webhook sem segredo válido => 401 quando configurado (requer DB)", async (t) => {
    if (!dbAvailable) return t.skip("sem banco");
    if (!process.env.BILLING_WEBHOOK_SECRET) return t.skip("BILLING_WEBHOOK_SECRET não configurado");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/billing/webhook",
      headers: { "x-api-key": "qualquer" },
      payload: { paymentId: "pay_inexistente", event: "PAYMENT_CONFIRMED" },
    });
    assert.equal(res.statusCode, 401);
  });

  test("12. Rate limit responde headers padrão (requer DB)", async (t) => {
    if (!dbAvailable) return t.skip("sem banco");
    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { userName: "RL User", email: `rl_${randomBytes(6).toString("hex")}@example.com`, password: "SenhaForte123!" },
    });
    const key = JSON.parse(reg.payload).key;
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { "x-api-key": key },
    });
    assert.equal(res.statusCode, 200);
    assert.ok(res.headers["x-ratelimit-limit"]);
    assert.ok(res.headers["x-ratelimit-remaining"] !== undefined);
    assert.ok(res.headers["x-ratelimit-reset"]);
  });
});
