import { beforeAll, afterAll, beforeEach, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { client, db } from "../src/db/index.js";
import { apiKeys, teams, players, venues, competitions, seasons, matches } from "../src/db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassword } from "../src/utils/password.js";
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
  const key = `bf_live_${plan.toLowerCase()}_${randomPart}`;
  const testEmail = email || `test_${plan.toLowerCase()}_${randomPart}@example.com`;
  const passwordHash = hashPassword("testpassword123");

  const rateLimits = { FREE: 10, PRO: 120, ENTERPRISE: 1000 };

  await db.insert(apiKeys).values({
    userName: `Test User ${plan}`,
    email: testEmail,
    passwordHash,
    key,
    plan,
    rateLimitPerMinute: rateLimits[plan],
    isActive: true,
  });

  return key;
}

export async function cleanupTestData() {
  // Limpar dados de teste na ordem correta (respeitando FKs)
  await db.delete(matches).where(eq(matches.id, -1)); // placeholder
  await db.delete(apiKeys).where(eq(apiKeys.email, "test@example.com"));
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
    kickoffTime: new Date(Date.now() + 86400000).toISOString(), // Amanhã
    status: "SCHEDULED",
    homeScore: 0,
    awayScore: 0,
  }).returning();

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
  testApiKey = await createTestApiKey("FREE");
  testAdminKey = await createTestApiKey("ENTERPRISE");
}, 60000);

afterAll(async () => {
  await teardownTestApp();
}, 30000);

beforeEach(async () => {
  await cleanupTestData();
});