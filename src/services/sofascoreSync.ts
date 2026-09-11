import { execFile } from "child_process";
import { promisify } from "util";
import { db } from "../db/index.js";
import {
  matches,
  teams,
  venues,
  seasons,
  competitions,
  standings,
} from "../db/schema.js";
import { eq, and, or, ilike } from "drizzle-orm";
import { realtimeBroker } from "./pubsub.js";

const execFileAsync = promisify(execFile);

interface SofascoreEvent {
  id: number;
  slug: string;
  roundInfo?: { round: number };
  startTimestamp: number;
  status: {
    code: number;
    description: string;
    type: string; // "finished", "inprogress", "notstarted", "postponed", "canceled"
  };
  homeTeam: {
    id: number;
    name: string;
    slug: string;
    shortName: string;
    nameCode?: string;
  };
  awayTeam: {
    id: number;
    name: string;
    slug: string;
    shortName: string;
    nameCode?: string;
  };
  homeScore?: {
    current?: number;
    display?: number;
    period1?: number;
    period2?: number;
  };
  awayScore?: {
    current?: number;
    display?: number;
    period1?: number;
    period2?: number;
  };
  venue?: {
    name: string;
    city?: { name: string };
    capacity?: number;
    stadium?: { name: string; capacity?: number };
  };
}

interface SofascoreStandingsRow {
  position: number;
  team: {
    id: number;
    name: string;
    shortName?: string;
    nameCode?: string;
  };
  points: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  scoresFor: number;
  scoresAgainst: number;
}

export class SofascoreSyncService {
  private static lastSyncTimestamp: number = 0;
  private static isSyncing: boolean = false;

  private static async fetchJson<T>(url: string): Promise<T | null> {
    try {
      const { stdout } = await execFileAsync("curl", [
        "-s",
        "-m",
        "12",
        "-A",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "-H",
        "Accept: */*",
        url,
      ]);

      const trimmed = stdout.trim();
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        return null;
      }
      return JSON.parse(trimmed) as T;
    } catch (err) {
      console.warn(`[SofascoreSync] Erro ao buscar ${url}:`, err);
      return null;
    }
  }

  public static mapStatus(sofascoreStatus: { type: string; description: string }): "SCHEDULED" | "FIRST_HALF" | "HALF_TIME" | "SECOND_HALF" | "EXTRA_TIME" | "PENALTIES" | "FINISHED" | "POSTPONED" | "CANCELLED" {
    const desc = (sofascoreStatus.description || "").toLowerCase();
    const type = (sofascoreStatus.type || "").toLowerCase();

    if (type === "finished" || desc === "ended" || desc === "aet" || desc === "ap") {
      return "FINISHED";
    }
    if (type === "inprogress") {
      if (desc.includes("1st") || desc.includes("first")) return "FIRST_HALF";
      if (desc.includes("half") || desc.includes("ht")) return "HALF_TIME";
      if (desc.includes("2nd") || desc.includes("second")) return "SECOND_HALF";
      if (desc.includes("extra")) return "EXTRA_TIME";
      if (desc.includes("penalt")) return "PENALTIES";
      return "SECOND_HALF";
    }
    if (type === "postponed") return "POSTPONED";
    if (type === "canceled" || type === "cancelled") return "CANCELLED";
    return "SCHEDULED";
  }

  public static async sync(force: boolean = false): Promise<{
    success: boolean;
    message: string;
    matchesSynced: number;
    standingsSynced: number;
    currentRound?: number;
    timestamp: string;
  }> {
    const now = Date.now();
    if (!force && this.isSyncing) {
      return {
        success: true,
        message: "Sincronização já em andamento...",
        matchesSynced: 0,
        standingsSynced: 0,
        timestamp: new Date().toISOString(),
      };
    }

    if (!force && now - this.lastSyncTimestamp < 60_000) {
      return {
        success: true,
        message: "Dados já sincronizados recentemente (cache < 60s).",
        matchesSynced: 0,
        standingsSynced: 0,
        timestamp: new Date(this.lastSyncTimestamp).toISOString(),
      };
    }

    this.isSyncing = true;
    this.lastSyncTimestamp = now;

    try {
      console.log("🔄 [SofascoreSync] Iniciando sincronização automática com Sofascore...");

      // 1. Obter ou criar competição Série A e Temporada 2026
      let [comp] = await db
        .select()
        .from(competitions)
        .where(eq(competitions.code, "BRA-1"));

      if (!comp) {
        [comp] = await db
          .insert(competitions)
          .values({
            name: "Brasileirão Série A",
            code: "BRA-1",
            country: "Brasil",
            type: "LEAGUE",
            logoUrl:
              "https://upload.wikimedia.org/wikipedia/pt/b/b4/Campeonato_Brasileiro_S%C3%A9rie_A_logo.png",
          })
          .returning();
      }

      let [season] = await db
        .select()
        .from(seasons)
        .where(
          and(eq(seasons.competitionId, comp.id), eq(seasons.name, "2026"))
        );

      if (!season) {
        [season] = await db
          .insert(seasons)
          .values({
            competitionId: comp.id,
            name: "2026",
            startDate: "2026-04-10",
            endDate: "2026-12-08",
            isCurrent: true,
          })
          .returning();
      }

      // 2. Buscar rodada atual do Brasileirão 2026 (uniqueTournament: 325, season: 87678)
      const roundsData = await this.fetchJson<{
        currentRound?: { round: number };
      }>("https://api.sofascore.com/api/v1/unique-tournament/325/season/87678/rounds");

      const currentRoundNum = roundsData?.currentRound?.round || 27;
      const roundsToSync = [
        Math.max(1, currentRoundNum - 1),
        currentRoundNum,
        Math.min(38, currentRoundNum + 1),
      ];

      const allEvents: SofascoreEvent[] = [];

      for (const r of roundsToSync) {
        const roundData = await this.fetchJson<{ events: SofascoreEvent[] }>(
          `https://api.sofascore.com/api/v1/unique-tournament/325/season/87678/events/round/${r}`
        );
        if (roundData?.events) {
          allEvents.push(...roundData.events);
        }
      }

      // 3. Buscar partidas ao vivo globais para atualizar minutos e placares instantâneos
      const liveData = await this.fetchJson<{ events: SofascoreEvent[] }>(
        "https://api.sofascore.com/api/v1/sport/football/events/live"
      );

      if (liveData?.events) {
        for (const liveEv of liveData.events) {
          const isAlreadyAdded = allEvents.some((e) => e.id === liveEv.id);
          if (!isAlreadyAdded && (liveEv.homeTeam?.nameCode || liveEv.slug?.includes("brasil") || liveEv.slug?.includes("serie-a"))) {
            allEvents.push(liveEv);
          }
        }
      }

      // 4. Mapear e sincronizar times, estádios e partidas no banco
      let matchesSyncedCount = 0;

      for (const event of allEvents) {
        try {
          const homeTeamId = await this.findOrCreateTeam(event.homeTeam);
          const awayTeamId = await this.findOrCreateTeam(event.awayTeam);
          const venueId = await this.findOrCreateVenue(event.venue);

          const status = this.mapStatus(event.status);
          const kickoff = new Date(event.startTimestamp * 1000);
          const roundName = `Rodada ${event.roundInfo?.round || currentRoundNum}`;

          const homeScore =
            event.homeScore?.current ?? event.homeScore?.display ?? null;
          const awayScore =
            event.awayScore?.current ?? event.awayScore?.display ?? null;
          const homeScoreHt = event.homeScore?.period1 ?? null;
          const awayScoreHt = event.awayScore?.period1 ?? null;

          const existing = await db
            .select()
            .from(matches)
            .where(
              and(
                eq(matches.seasonId, season.id),
                eq(matches.homeTeamId, homeTeamId),
                eq(matches.awayTeamId, awayTeamId)
              )
            );

          if (existing.length > 0) {
            const matchId = existing[0].id;
            await db
              .update(matches)
              .set({
                round: roundName,
                kickoffTime: kickoff,
                status,
                homeScore: homeScore ?? existing[0].homeScore,
                awayScore: awayScore ?? existing[0].awayScore,
                homeScoreHt: homeScoreHt ?? existing[0].homeScoreHt,
                awayScoreHt: awayScoreHt ?? existing[0].awayScoreHt,
                venueId: venueId ?? existing[0].venueId,
                updatedAt: new Date(),
              })
              .where(eq(matches.id, matchId));

            if (status === "FIRST_HALF" || status === "SECOND_HALF") {
              realtimeBroker.publishMatchUpdate({
                type: "SCORE_UPDATE",
                matchId,
                timestamp: new Date().toISOString(),
                data: { homeScore, awayScore, status },
              });
            }
          } else {
            await db.insert(matches).values({
              seasonId: season.id,
              venueId,
              homeTeamId,
              awayTeamId,
              round: roundName,
              kickoffTime: kickoff,
              status,
              homeScore: homeScore ?? 0,
              awayScore: awayScore ?? 0,
              homeScoreHt: homeScoreHt ?? 0,
              awayScoreHt: awayScoreHt ?? 0,
            });
          }
          matchesSyncedCount++;
        } catch (err) {
          console.warn(`[SofascoreSync] Erro ao sincronizar evento ${event.id}:`, err);
        }
      }

      // 5. Sincronizar Tabela de Classificação Real do Sofascore
      let standingsSyncedCount = 0;
      const standingsData = await this.fetchJson<{
        standings?: Array<{ rows?: SofascoreStandingsRow[] }>;
      }>("https://api.sofascore.com/api/v1/unique-tournament/325/season/87678/standings/total");

      const rows = standingsData?.standings?.[0]?.rows || [];
      for (const row of rows) {
        try {
          const teamId = await this.findOrCreateTeam(row.team);
          const goalDiff = (row.scoresFor || 0) - (row.scoresAgainst || 0);

          const existingStanding = await db
            .select()
            .from(standings)
            .where(
              and(
                eq(standings.seasonId, season.id),
                eq(standings.teamId, teamId)
              )
            );

          if (existingStanding.length > 0) {
            await db
              .update(standings)
              .set({
                position: row.position,
                points: row.points,
                played: row.matches,
                won: row.wins,
                drawn: row.draws,
                lost: row.losses,
                goalsFor: row.scoresFor,
                goalsAgainst: row.scoresAgainst,
                goalDifference: goalDiff,
                updatedAt: new Date(),
              })
              .where(eq(standings.id, existingStanding[0].id));
          } else {
            await db.insert(standings).values({
              seasonId: season.id,
              teamId,
              position: row.position,
              points: row.points,
              played: row.matches,
              won: row.wins,
              drawn: row.draws,
              lost: row.losses,
              goalsFor: row.scoresFor,
              goalsAgainst: row.scoresAgainst,
              goalDifference: goalDiff,
            });
          }
          standingsSyncedCount++;
        } catch (err) {
          console.warn(`[SofascoreSync] Erro ao sincronizar classificação do time ${row.team?.name}:`, err);
        }
      }

      console.log(
        `✅ [SofascoreSync] Sincronização concluída! ${matchesSyncedCount} partidas e ${standingsSyncedCount} linhas de tabela atualizadas.`
      );

      return {
        success: true,
        message: "Sincronização com Sofascore concluída com sucesso!",
        matchesSynced: matchesSyncedCount,
        standingsSynced: standingsSyncedCount,
        currentRound: currentRoundNum,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error("❌ [SofascoreSync] Falha na sincronização:", err);
      return {
        success: false,
        message: err.message || "Erro durante sincronização",
        matchesSynced: 0,
        standingsSynced: 0,
        timestamp: new Date().toISOString(),
      };
    } finally {
      this.isSyncing = false;
    }
  }

  private static async findOrCreateTeam(sofaTeam: {
    id: number;
    name: string;
    shortName?: string;
    nameCode?: string;
  }): Promise<number> {
    const name = sofaTeam.name.trim();
    const shortName = sofaTeam.shortName?.trim() || name;
    const acronym = sofaTeam.nameCode || shortName.substring(0, 3).toUpperCase();

    const found = await db
      .select()
      .from(teams)
      .where(
        or(
          ilike(teams.name, `%${shortName}%`),
          ilike(teams.shortName, `%${shortName}%`),
          eq(teams.acronym, acronym)
        )
      );

    if (found.length > 0) {
      return found[0].id;
    }

    const logoUrl = `https://api.sofascore.app/api/v1/team/${sofaTeam.id}/image`;
    const [inserted] = await db
      .insert(teams)
      .values({
        name,
        shortName,
        acronym,
        country: "Brasil",
        logoUrl,
      })
      .returning();

    return inserted.id;
  }

  private static async findOrCreateVenue(sofaVenue?: {
    name?: string;
    city?: { name: string };
    stadium?: { name: string; capacity?: number };
    capacity?: number;
  }): Promise<number | null> {
    if (!sofaVenue?.name && !sofaVenue?.stadium?.name) return null;

    const name = (sofaVenue.stadium?.name || sofaVenue.name || "").trim();
    const city = sofaVenue.city?.name || "Brasil";
    const capacity = sofaVenue.stadium?.capacity || sofaVenue.capacity || null;

    const found = await db
      .select()
      .from(venues)
      .where(ilike(venues.name, `%${name}%`));

    if (found.length > 0) {
      return found[0].id;
    }

    const [inserted] = await db
      .insert(venues)
      .values({
        name,
        city,
        country: "Brasil",
        capacity,
        surface: "Grass",
      })
      .returning();

    return inserted.id;
  }
}
