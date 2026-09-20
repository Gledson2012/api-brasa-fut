import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { getTestApp, getTestApiKey, seedTestData } from "../setup.js";

describe("API BrasaFut - Testes de Integração", () => {
  let app: ReturnType<typeof getTestApp>;
  let apiKey: string;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    app = getTestApp();
    apiKey = getTestApiKey();
    testData = await seedTestData();
  });

  describe("Health & Root", () => {
    it("GET / - deve retornar status da API", async () => {
      const response = await request(app.server)
        .get("/")
        .expect(200);

      expect(response.body).toMatchObject({
        name: "BrasaFut API",
        status: "online",
        version: expect.any(String),
        documentation: "/docs",
      });
    });

    it("GET /docs - deve servir Swagger UI", async () => {
      await request(app.server)
        .get("/docs")
        .expect(200);
    });
  });

  describe("Autenticação e Planos", () => {
    it("GET /api/v1/auth/plans - deve listar planos disponíveis", async () => {
      const response = await request(app.server)
        .get("/api/v1/auth/plans")
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body.map((p: any) => p.plan)).toEqual(["FREE", "PRO", "ENTERPRISE"]);
    });

    it("POST /api/v1/auth/register - deve registrar novo desenvolvedor", async () => {
      const response = await request(app.server)
        .post("/api/v1/auth/register")
        .send({
          userName: "Novo Dev",
          email: "novodev@example.com",
          password: "senha123",
        })
        .expect(201);

      expect(response.body).toMatchObject({
        message: expect.any(String),
        key: expect.stringMatching(/^bf_live_[a-f0-9]+$/),
        userName: "Novo Dev",
        email: "novodev@example.com",
        plan: "FREE",
        rateLimitPerMinute: 10,
      });
    });

    it("POST /api/v1/auth/register - deve falhar com email duplicado", async () => {
      await request(app.server)
        .post("/api/v1/auth/register")
        .send({
          userName: "Dev 1",
          email: "duplicado@example.com",
        })
        .expect(201);

      const response = await request(app.server)
        .post("/api/v1/auth/register")
        .send({
          userName: "Dev 2",
          email: "duplicado@example.com",
        })
        .expect(409);

      expect(response.body.error).toContain("E-mail já cadastrado");
    });

    it("POST /api/v1/auth/login - deve autenticar e retornar API Key", async () => {
      await request(app.server)
        .post("/api/v1/auth/register")
        .send({
          userName: "Login Test",
          email: "logintest@example.com",
          password: "senha123",
        })
        .expect(201);

      const response = await request(app.server)
        .post("/api/v1/auth/login")
        .send({
          login: "logintest@example.com",
          password: "senha123",
        })
        .expect(200);

      // A chave não é mais devolvida no login: apenas o prefixo identificador.
      expect(response.body).toMatchObject({
        keyPrefix: expect.stringMatching(/^bf_live/),
        user: expect.objectContaining({
          userName: "Login Test",
          email: "logintest@example.com",
          plan: "FREE",
        }),
      });
      expect(response.body.message).toContain("Login realizado com sucesso!");
      expect(response.body.apiKey).toBeUndefined();
    });

    it("POST /api/v1/auth/keys/rotate - deve emitir nova chave e invalidar a anterior", async () => {
      const key = await import("../setup.js").then((m) =>
        m.createTestApiKey("FREE", "rotatetest@example.com")
      );

      const novoAcesso = await request(app.server)
        .get("/api/v1/auth/me")
        .set("x-api-key", key)
        .expect(200);
      expect(novoAcesso.body.keyPrefix).toHaveLength(12);

      const response = await request(app.server)
        .post("/api/v1/auth/keys/rotate")
        .send({ login: "rotatetest@example.com", password: "testpassword123" })
        .expect(200);

      expect(response.body.key).toMatch(/^bf_live_[a-f0-9]+$/);

      await request(app.server)
        .get("/api/v1/auth/me")
        .set("x-api-key", response.body.key)
        .expect(200);

      await request(app.server)
        .get("/api/v1/auth/me")
        .set("x-api-key", key)
        .expect(401);
    });
  });

  describe("Rate Limiting", () => {
    it("deve bloquear requisições além do limite do plano FREE (10/min)", async () => {
      const freeKey = await import("../setup.js").then((m) => m.createTestApiKey("FREE"));

      // Fazer 10 requisições (limite do FREE)
      for (let i = 0; i < 10; i++) {
        await request(app.server)
          .get("/api/v1/competitions")
          .set("x-api-key", freeKey)
          .expect(200);
      }

      // 11ª requisição deve ser bloqueada
      const response = await request(app.server)
        .get("/api/v1/competitions")
        .set("x-api-key", freeKey)
        .expect(429);

      expect(response.body).toMatchObject({
        error: "Too Many Requests",
        limit: 10,
        plan: "FREE",
      });
      expect(response.headers).toHaveProperty("x-ratelimit-limit");
      expect(response.headers).toHaveProperty("x-ratelimit-remaining");
      expect(response.headers).toHaveProperty("x-ratelimit-reset");
    });

    it("não deve aplicar rate limit em rotas públicas", async () => {
      for (let i = 0; i < 20; i++) {
        await request(app.server)
          .get("/api/v1/auth/plans")
          .expect(200);
      }
    });
  });

  describe("Competições", () => {
    it("GET /api/v1/competitions - deve listar competições", async () => {
      const response = await request(app.server)
        .get("/api/v1/competitions")
        .set("x-api-key", apiKey)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("GET /api/v1/competitions/:id - deve retornar detalhes da competição", async () => {
      const response = await request(app.server)
        .get(`/api/v1/competitions/${testData.competition.id}`)
        .set("x-api-key", apiKey)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testData.competition.id,
        name: "Brasileirão Série A",
        code: "BRA1",
      });
    });
  });

  describe("Clubes", () => {
    it("GET /api/v1/teams - deve listar clubes", async () => {
      const response = await request(app.server)
        .get("/api/v1/teams")
        .set("x-api-key", apiKey)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it("GET /api/v1/teams/:id - deve retornar detalhes do clube", async () => {
      const response = await request(app.server)
        .get(`/api/v1/teams/${testData.homeTeam.id}`)
        .set("x-api-key", apiKey)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testData.homeTeam.id,
        name: "Time Casa FC",
        shortName: "TCFC",
      });
    });

    it("GET /api/v1/teams/:id/roster - deve retornar elenco do time na temporada", async () => {
      const response = await request(app.server)
        .get(`/api/v1/teams/${testData.homeTeam.id}/roster`)
        .query({ seasonId: testData.season.id })
        .set("x-api-key", apiKey)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe("Atletas", () => {
    it("GET /api/v1/players - deve listar jogadores com paginação", async () => {
      const response = await request(app.server)
        .get("/api/v1/players")
        .set("x-api-key", apiKey)
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.any(Array),
        pagination: expect.objectContaining({
          page: 1,
          limit: expect.any(Number),
        }),
      });
    });

    it("GET /api/v1/players/:id - deve retornar perfil do jogador", async () => {
      const response = await request(app.server)
        .get(`/api/v1/players/${testData.player1.id}`)
        .set("x-api-key", apiKey)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testData.player1.id,
        firstName: "João",
        lastName: "Silva",
        knownName: "João",
      });
    });
  });

  describe("Partidas", () => {
    it("GET /api/v1/matches - deve listar partidas com filtros", async () => {
      const response = await request(app.server)
        .get("/api/v1/matches")
        .set("x-api-key", apiKey)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("GET /api/v1/matches/live - deve retornar partidas ao vivo", async () => {
      const response = await request(app.server)
        .get("/api/v1/matches/live")
        .set("x-api-key", apiKey)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("GET /api/v1/matches/:id - deve retornar detalhes da partida", async () => {
      const response = await request(app.server)
        .get(`/api/v1/matches/${testData.match.id}`)
        .set("x-api-key", apiKey)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testData.match.id,
        homeTeamId: testData.homeTeam.id,
        awayTeamId: testData.awayTeam.id,
        status: "SCHEDULED",
      });
    });

    it("GET /api/v1/matches/:id/events - deve retornar timeline de eventos", async () => {
      const response = await request(app.server)
        .get(`/api/v1/matches/${testData.match.id}/events`)
        .set("x-api-key", apiKey)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("GET /api/v1/matches/:id/statistics - deve retornar estatísticas", async () => {
      const response = await request(app.server)
        .get(`/api/v1/matches/${testData.match.id}/statistics`)
        .set("x-api-key", apiKey)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("GET /api/v1/matches/:id/h2h - deve retornar confronto direto", async () => {
      const response = await request(app.server)
        .get(`/api/v1/matches/${testData.match.id}/h2h`)
        .set("x-api-key", apiKey)
        .expect(200);

      expect(response.body).toMatchObject({
        homeTeamId: testData.homeTeam.id,
        awayTeamId: testData.awayTeam.id,
        totalMatches: expect.any(Number),
      });
    });
  });

  describe("Classificação", () => {
    it("GET /api/v1/standings - deve retornar tabela de classificação", async () => {
      const response = await request(app.server)
        .get("/api/v1/standings")
        .query({ seasonId: testData.season.id })
        .set("x-api-key", apiKey)
        .expect(200);

      const list = Array.isArray(response.body) ? response.body : response.body.standings;
      expect(Array.isArray(list)).toBe(true);
    });
  });

  describe("Webhooks", () => {
    it("POST /api/v1/webhooks - deve criar webhook (requer plano PRO+)", async () => {
      const proKey = await import("../setup.js").then(m => m.createTestApiKey("PRO"));

      const response = await request(app.server)
        .post("/api/v1/webhooks")
        .set("x-api-key", proKey)
        .send({
          url: "https://example.com/webhook",
          events: ["MATCH_EVENT", "SCORE_UPDATE"],
        })
        .expect(201);

      const target = response.body.webhook || response.body;
      expect(target).toMatchObject({
        url: "https://example.com/webhook",
        events: ["MATCH_EVENT", "SCORE_UPDATE"],
        isActive: true,
      });
    });
  });

  describe("Busca Global", () => {
    it("GET /api/v1/search - deve buscar em múltiplas entidades", async () => {
      const response = await request(app.server)
        .get("/api/v1/search")
        .query({ q: "Time" })
        .set("x-api-key", apiKey)
        .expect(200);

      expect(response.body).toMatchObject({
        teams: expect.any(Array),
        players: expect.any(Array),
        competitions: expect.any(Array),
      });
    });
  });

  describe("Endpoints Administrativos (ENTERPRISE)", () => {
    it("POST /api/v1/matches/:id/events - deve permitir inserir evento (PRO+)", async () => {
      const proKey = await import("../setup.js").then(m => m.createTestApiKey("PRO"));

      const response = await request(app.server)
        .post(`/api/v1/matches/${testData.match.id}/events`)
        .set("x-api-key", proKey)
        .send({
          teamId: testData.homeTeam.id,
          playerId: testData.player1.id,
          type: "GOAL",
          minute: 23,
          description: "Gol de cabeça",
        })
        .expect(201);

      expect(response.body).toMatchObject({
        matchId: testData.match.id,
        teamId: testData.homeTeam.id,
        playerId: testData.player1.id,
        type: "GOAL",
        minute: 23,
      });
    });

    it("PATCH /api/v1/matches/:id/score - deve permitir atualizar placar (PRO+)", async () => {
      const proKey = await import("../setup.js").then(m => m.createTestApiKey("PRO"));

      const response = await request(app.server)
        .patch(`/api/v1/matches/${testData.match.id}/score`)
        .set("x-api-key", proKey)
        .send({
          homeScore: 2,
          awayScore: 1,
          status: "FINISHED",
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: testData.match.id,
        homeScore: 2,
        awayScore: 1,
        status: "FINISHED",
      });
    });
  });
});

describe("Validação de Esquemas (Zod)", () => {
  let app: ReturnType<typeof getTestApp>;
  let apiKey: string;

  beforeEach(async () => {
    app = getTestApp();
    apiKey = getTestApiKey();
  });

  it("deve rejeitar query parameters inválidos", async () => {
    const response = await request(app.server)
      .get("/api/v1/matches")
      .query({ limit: "invalid" })
      .set("x-api-key", apiKey)
      .expect(400);

    expect(response.body).toHaveProperty("error");
  });

  it("deve rejeitar body inválido em POST", async () => {
    const proKey = await import("../setup.js").then(m => m.createTestApiKey("PRO"));

    const response = await request(app.server)
      .post("/api/v1/matches/1/events")
      .set("x-api-key", proKey)
      .send({
        teamId: "invalid",
        playerId: 1,
        type: "INVALID_TYPE",
        minute: 200,
      })
      .expect(400);

    expect(response.body).toHaveProperty("error");
  });
});