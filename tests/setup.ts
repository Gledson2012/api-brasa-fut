import { beforeAll, afterAll, beforeEach, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { client, db } from "../src/db/index.js";
import { apiKeys, teams, players, venues, competitions, seasons, matches, matchEvents, matchStatistics } from "../src/db/schema.js";
import { eq, ilike } from "drizzle-orm";
import { hashPassword } from "../src/utils/password.js";
import {
  apiKeyPrefix,
  generateApiKey,
  hashApiKey,
} from "../src/utils/apiKey.js";
import { randomBytes } from "node:crypto";

// Configuração global de testes
let app: ReturnType<typeof buildApp>;
let testApiKey: string;
let testAdminKey: string;

export async function setupTestApp() {
  app = buildApp();
  await app.ready();
  return app;
}

export async function teardownTestApp() {
  if (app) {
    await app.close();
  }
  await client.end();
}

export async function createTestApiKey(plan: "FREE" | "PRO" | "ENTERPRISE" = "FREE", email?: string): Promise<string> {
  const randomPart = randomBytes(20).toString("hex");
  const key = generateApiKey(plan);
  const testEmail = email || `system_test_${plan.toLowerCase()}_${randomPart}@brasafut.internal`;
  const passwordHash = hashPassword("testpassword123");

  const rateLimits = { FREE: 10, PRO: 120, ENTERPRISE: 1000 };

  await db.insert(apiKeys).values({
    userName: `Test User ${plan}`,
    email: testEmail,
    passwordHash,
    keyHash: hashApiKey(key),
    keyPrefix: apiKeyPrefix(key),
    plan,
    rateLimitPerMinute: rateLimits[plan],
    isActive: true,
  });

  return key;
}

let currentTestData: {
  matchId?: number;
  player1Id?: number;
  player2Id?: number;
  seasonId?: number;
  competitionId?: number;
  homeTeamId?: number;
  awayTeamId?: number;
  venueId?: number;
} = {};

export async function cleanupTestData() {
  if (currentTestData.matchId) {
    await db.delete(matchStatistics).where(eq(matchStatistics.matchId, currentTestData.matchId)).catch(() => {});
    await db.delete(matchEvents).where(eq(matchEvents.matchId, currentTestData.matchId)).catch(() => {});
    await db.delete(matches).where(eq(matches.id, currentTestData.matchId)).catch(() => {});
  }
  // Limpar por segurança qualquer match com round 'TEST_ROUND' ou id inserido
  await db.delete(matches).where(eq(matches.round, "TEST_ROUND")).catch(() => {});

  if (currentTestData.seasonId) {
    await db.delete(seasons).where(eq(seasons.id, currentTestData.seasonId)).catch(() => {});
  }
  if (currentTestData.competitionId) {
    await db.delete(competitions).where(eq(competitions.id, currentTestData.competitionId)).catch(() => {});
  }
  await db.delete(competitions).where(eq(competitions.code, "BRA1")).catch(() => {});

  if (currentTestData.player1Id) {
    await db.delete(players).where(eq(players.id, currentTestData.player1Id)).catch(() => {});
  }
  if (currentTestData.player2Id) {
    await db.delete(players).where(eq(players.id, currentTestData.player2Id)).catch(() => {});
  }

  if (currentTestData.homeTeamId) {
    await db.delete(teams).where(eq(teams.id, currentTestData.homeTeamId)).catch(() => {});
  }
  if (currentTestData.awayTeamId) {
    await db.delete(teams).where(eq(teams.id, currentTestData.awayTeamId)).catch(() => {});
  }
  await db.delete(teams).where(eq(teams.shortName, "TCFC")).catch(() => {});
  await db.delete(teams).where(eq(teams.shortName, "TFFC")).catch(() => {});

  if (currentTestData.venueId) {
    await db.delete(venues).where(eq(venues.id, currentTestData.venueId)).catch(() => {});
  }
  await db.delete(venues).where(eq(venues.name, "Estádio de Teste")).catch(() => {});

  await db.delete(apiKeys).where(ilike(apiKeys.email, "%@example.com")).catch(() => {});

  currentTestData = {};
}

export function getTestApp() {
  if (!app) throw new Error("App não inicializado. Chame setupTestApp() primeiro.");
  return app;
}

export function getTestApiKey() {
  if (!testApiKey) throw new Error("API Key de teste não criada");
  return testApiKey;
}

export function getTestAdminKey() {
  if (!testAdminKey) throw new Error("Admin API Key de teste não criada");
  return testAdminKey;
}

// Helpers para testes de integração
export async function seedTestData() {
  // Limpar primeiro para garantir idempotência
  await cleanupTestData();

  // Venue
  const [venue] = await db.insert(venues).values({
    name: "Estádio de Teste",
    city: "São Paulo",
    country: "Brasil",
    capacity: 50000,
    surface: "Grass",
  }).returning();

  // Teams
  const [homeTeam] = await db.insert(teams).values({
    name: "Time Casa FC",
    shortName: "TCFC",
    acronym: "TCF",
    country: "Brasil",
    venueId: venue.id,
    foundedYear: 1900,
  }).returning();

  const [awayTeam] = await db.insert(teams).values({
    name: "Time Fora FC",
    shortName: "TFFC",
    acronym: "TFF",
    country: "Brasil",
    foundedYear: 1910,
  }).returning();

  // Competition
  const [competition] = await db.insert(competitions).values({
    name: "Brasileirão Série A",
    code: "BRA1",
    country: "Brasil",
    type: "LEAGUE",
  }).returning();

  // Season
  const [season] = await db.insert(seasons).values({
    competitionId: competition.id,
    name: "2024",
    startDate: "2024-04-01",
    endDate: "2024-12-01",
    isCurrent: true,
  }).returning();

  // Players
  const [player1] = await db.insert(players).values({
    firstName: "João",
    lastName: "Silva",
    knownName: "João",
    birthDate: "1995-05-15",
    nationality: "Brasil",
    primaryPosition: "FORWARD",
    heightCm: 180,
    weightKg: 75,
  }).returning();

  const [player2] = await db.insert(players).values({
    firstName: "Pedro",
    lastName: "Santos",
    knownName: "Pedro",
    birthDate: "1998-08-20",
    nationality: "Brasil",
    primaryPosition: "MIDFIELDER",
    heightCm: 175,
    weightKg: 70,
  }).returning();

  // Match
  const [match] = await db.insert(matches).values({
    seasonId: season.id,
    venueId: venue.id,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    round: "1",
    kickoffTime: new Date(Date.now() + 86400000), // Amanhã
    status: "SCHEDULED",
    homeScore: 0,
    awayScore: 0,
  }).returning();

  // Match Statistics
  await db.insert(matchStatistics).values([
    {
      matchId: match.id,
      teamId: homeTeam.id,
      possessionPct: 55,
      shotsTotal: 12,
      shotsOnTarget: 5,
    },
    {
      matchId: match.id,
      teamId: awayTeam.id,
      possessionPct: 45,
      shotsTotal: 9,
      shotsOnTarget: 3,
    },
  ]);

  currentTestData = {
    venueId: venue.id,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    competitionId: competition.id,
    seasonId: season.id,
    player1Id: player1.id,
    player2Id: player2.id,
    matchId: match.id,
  };

  return { venue, homeTeam, awayTeam, competition, season, player1, player2, match };
}

// Mock de fetch para testes que chamam APIs externas
export function mockFetch(responses: Map<string, any>) {
  const originalFetch = global.fetch;
  global.fetch = vi.fn(async (url: string | URL, options?: RequestInit) => {
    const urlStr = url.toString();
    for (const [pattern, response] of responses.entries()) {
      if (urlStr.includes(pattern)) {
        return {
          ok: true,
          status: 200,
          json: async () => response,
          text: async () => JSON.stringify(response),
        } as Response;
      }
    }
    return originalFetch(url, options);
  });

  return () => {
    global.fetch = originalFetch;
  };
}

// Setup global
beforeAll(async () => {
  await setupTestApp();
  testApiKey = await createTestApiKey("ENTERPRISE");
  testAdminKey = await createTestApiKey("ENTERPRISE");
}, 60000);

afterAll(async () => {
  await teardownTestApp();
}, 30000);

beforeEach(async () => {
  await cleanupTestData();
});