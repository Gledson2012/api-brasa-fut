/**
 * Client tipado da BrasaFut API — módulo Atletas.
 *
 * Agnóstico de framework: funciona em qualquer aplicativo (web, React Native,
 * Flutter via bridge REST, Node). Única dependência: `fetch` global.
 *
 * Uso:
 * ```ts
 * import { createPlayersClient } from "./players.js";
 * const players = createPlayersClient({ baseUrl: "https://sua-api.com", apiKey: "bf_live_..." });
 * const { data } = await players.list({ search: "Memphis" });
 * ```
 */

export type PlayerPosition = "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD";

export interface PlayersClientConfig {
  baseUrl: string;
  apiKey: string;
  /** Timeout por requisição em ms (padrão 15000). */
  timeoutMs?: number;
}

export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  knownName: string | null;
  birthDate: string | null;
  nationality: string;
  primaryPosition: PlayerPosition;
  heightCm: number | null;
  weightKg: number | null;
  photoUrl: string | null;
}

export interface ListPlayersParams {
  search?: string;
  nationality?: string;
  position?: PlayerPosition;
  limit?: number;
  page?: number;
}

export interface PaginatedPlayers {
  page: number;
  limit: number;
  data: Player[];
}

async function request<T>(
  config: Required<Pick<PlayersClientConfig, "baseUrl" | "apiKey">> & { timeoutMs: number },
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const url = new URL(`${config.baseUrl.replace(/\/$/, "")}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      headers: { "x-api-key": config.apiKey },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`BrasaFut ${res.status} em ${path}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function createPlayersClient(config: PlayersClientConfig) {
  const cfg = {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    timeoutMs: config.timeoutMs ?? 15000,
  };

  return {
    /** GET /api/v1/players — lista paginada com filtros. */
    list: (params?: ListPlayersParams) =>
      request<PaginatedPlayers>(cfg, "/api/v1/players", params as Record<string, string | number | undefined>),

    /** GET /api/v1/players/compare?p1=X&p2=Y — comparador Raio-X. */
    compare: <T = unknown>(p1: number, p2: number, seasonId?: number) =>
      request<T>(cfg, "/api/v1/players/compare", { p1, p2, seasonId }),

    /** GET /api/v1/players/:id — perfil + clubes. */
    getById: <T = unknown>(id: number) =>
      request<T>(cfg, `/api/v1/players/${id}`),

    /** GET /api/v1/players/:id/statistics — scouts detalhados. */
    getStatistics: <T = unknown>(id: number, seasonId?: number) =>
      request<T>(cfg, `/api/v1/players/${id}/statistics`, { seasonId }),

    /** GET /api/v1/players/:id/career — currículo temporada a temporada. */
    getCareer: <T = unknown>(id: number) =>
      request<T>(cfg, `/api/v1/players/${id}/career`),

    /** GET /api/v1/players/:id/fantasy — pontuação estilo Cartola. */
    getFantasy: <T = unknown>(id: number) =>
      request<T>(cfg, `/api/v1/players/${id}/fantasy`),

    /** GET /api/v1/players/:id/heatmap — mapa de calor e zonas de atuação. */
    getHeatmap: <T = unknown>(id: number, matchId?: number) =>
      request<T>(cfg, `/api/v1/players/${id}/heatmap`, { matchId }),
  };
}

export type PlayersClient = ReturnType<typeof createPlayersClient>;
