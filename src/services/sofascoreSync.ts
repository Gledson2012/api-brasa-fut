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

export interface SofascoreEvent {
  id: number;
  slug: string;
  roundInfo?: { round: number };
  startTimestamp: number;
  tournament?: {
    uniqueTournament?: {
      id?: number;
    };
  };
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

export interface SofascoreStandingsRow {
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
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        return JSON.parse(trimmed) as T;
      }
    } catch {
      // Fallback para fetch nativo caso curl não esteja disponível
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            Accept: "application/json, text/plain, */*",
          },
          signal: AbortSignal.timeout(12000),
        });
        if (response.ok) {
          return (await response.json()) as T;
        }
      } catch (err: any) {
        console.warn(`[SofascoreSync] Erro ao buscar ${url}:`, err.message);
      }
    }
    return null;
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

      const LEAGUES = [
        { code: "BRA-1", name: "Brasileirão Série A", tournamentId: 325, seasonId: 87678 },
        { code: "BRA-2", name: "Brasileirão Série B", tournamentId: 390, seasonId: 89840 },
        { code: "LIB", name: "CONMEBOL Libertadores", tournamentId: 384, seasonId: 87760 },
      ];

      // 1. Buscar partidas ao vivo globais uma única vez
      const liveData = await this.fetchJson<{ events: SofascoreEvent[] }>(
        "https://api.sofascore.com/api/v1/sport/football/events/live"
      );
      const globalLiveEvents = liveData?.events || [];

      let totalMatchesSynced = 0;
      let totalStandingsSynced = 0;
      let mainRoundNum = 27;

      for (const league of LEAGUES) {
        try {
          // 2. Buscar rodada atual da liga
          const roundsData = await this.fetchJson<{
            currentRound?: { round: number };
          }>(
            `https://api.sofascore.com/api/v1/unique-tournament/${league.tournamentId}/season/${league.seasonId}/rounds`
          );

          const currentRoundNum = roundsData?.currentRound?.round || 27;
          if (league.code === "BRA-1") {
            mainRoundNum = currentRoundNum;
          }

          const roundsToSync = Array.from(
            new Set([
              Math.max(1, currentRoundNum - 1),
              currentRoundNum,
              Math.min(38, currentRoundNum + 1),
            ])
          );

          const leagueEvents: SofascoreEvent[] = [];

          for (const r of roundsToSync) {
            const roundData = await this.fetchJson<{ events: SofascoreEvent[] }>(
              `https://api.sofascore.com/api/v1/unique-tournament/${league.tournamentId}/season/${league.seasonId}/events/round/${r}`
            );
            if (roundData?.events) {
              leagueEvents.push(...roundData.events);
            }
          }

          // 3. Adicionar partidas ao vivo exclusivas deste torneio
          for (const liveEv of globalLiveEvents) {
            const matchesTournament =
              liveEv.tournament?.uniqueTournament?.id === league.tournamentId;
            const isAlreadyAdded = leagueEvents.some((e) => e.id === liveEv.id);
            if (matchesTournament && !isAlreadyAdded) {
              leagueEvents.push(liveEv);
            }
          }

          // 4. Buscar tabela de classificação da liga
          const standingsData = await this.fetchJson<{
            standings?: Array<{ rows?: SofascoreStandingsRow[] }>;
          }>(
            `https://api.sofascore.com/api/v1/unique-tournament/${league.tournamentId}/season/${league.seasonId}/standings/total`
          );
          const rows = standingsData?.standings?.[0]?.rows || [];

          // 5. Persistir dados reais
          const res = await this.processData(
            leagueEvents,
            rows,
            currentRoundNum,
            league.code
          );
          totalMatchesSynced += res.matchesSynced;
          totalStandingsSynced += res.standingsSynced;
        } catch (leagueErr: any) {
          console.warn(`[SofascoreSync] Erro ao sincronizar ${league.name}:`, leagueErr.message);
        }
      }

      return {
        success: true,
        message: `Sincronização oficial concluída! ${totalMatchesSynced} partidas e ${totalStandingsSynced} classificações atualizadas.`,
        matchesSynced: totalMatchesSynced,
        standingsSynced: totalStandingsSynced,
        currentRound: mainRoundNum,
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

  public static async processData(
    allEvents: SofascoreEvent[],
    standingsRows?: SofascoreStandingsRow[],
    currentRoundNum: number = 27,
    competitionCode: string = "BRA-1"
  ): Promise<{
    success: boolean;
    message: string;
    matchesSynced: number;
    standingsSynced: number;
    currentRound?: number;
    timestamp: string;
  }> {
    // 1. Obter ou criar competição e Temporada 2026
    let [comp] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.code, competitionCode));

    if (!comp) {
      const compMeta = competitionCode === "BRA-2"
        ? { name: "Brasileirão Série B", type: "LEAGUE", logo: "https://upload.wikimedia.org/wikipedia/pt/f/f4/Campeonato_Brasileiro_S%C3%A9rie_B_logo.png" }
        : competitionCode === "LIB"
        ? { name: "CONMEBOL Libertadores", type: "INTERNATIONAL", logo: "https://upload.wikimedia.org/wikipedia/pt/c/c2/Copa_Libertadores_da_Am%C3%A9rica_logo.png" }
        : { name: "Brasileirão Série A", type: "LEAGUE", logo: "https://upload.wikimedia.org/wikipedia/pt/b/b4/Campeonato_Brasileiro_S%C3%A9rie_A_logo.png" };

      [comp] = await db
        .insert(competitions)
        .values({
          name: compMeta.name,
          code: competitionCode,
          country: competitionCode === "LIB" ? "América do Sul" : "Brasil",
          type: compMeta.type as "LEAGUE" | "INTERNATIONAL",
          logoUrl: compMeta.logo,
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

    let matchesSyncedCount = 0;

    for (const event of allEvents) {
      try {
        const homeTeamId = await this.findOrCreateTeam(event.homeTeam, competitionCode);
        const awayTeamId = await this.findOrCreateTeam(event.awayTeam, competitionCode);
        const venueId = await this.findOrCreateVenue(event.venue, competitionCode);

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

    // 5. Sincronizar Tabela de Classificação
    let standingsSyncedCount = 0;
    const rows = standingsRows || [];
    for (const row of rows) {
      try {
        const teamId = await this.findOrCreateTeam(row.team, competitionCode);
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
      `✅ [SofascoreSync] Processamento concluído! ${matchesSyncedCount} partidas e ${standingsSyncedCount} classificações atualizadas.`
    );

    return {
      success: true,
      message: "Dados do Sofascore sincronizados com sucesso no banco!",
      matchesSynced: matchesSyncedCount,
      standingsSynced: standingsSyncedCount,
      currentRound: currentRoundNum,
      timestamp: new Date().toISOString(),
    };
  }

  private static async findOrCreateTeam(
    sofaTeam: {
      id: number;
      name: string;
      shortName?: string;
      nameCode?: string;
    },
    competitionCode: string = "BRA-1"
  ): Promise<number> {
    const name = sofaTeam.name.trim();
    const shortName = sofaTeam.shortName?.trim() || name;
    const acronym = (sofaTeam.nameCode?.trim() || shortName.substring(0, 3)).toUpperCase();

    // 1. Busca exata por acrônimo ou nome completo
    const exactMatch = await db
      .select()
      .from(teams)
      .where(
        or(
          eq(teams.acronym, acronym),
          eq(teams.name, name),
          eq(teams.shortName, shortName)
        )
      );

    if (exactMatch.length > 0) {
      return exactMatch[0].id;
    }

    // 2. Busca aproximada apenas para termos de busca com tamanho mínimo
    if (shortName.length >= 4) {
      const fuzzyMatch = await db
        .select()
        .from(teams)
        .where(
          or(
            ilike(teams.name, `%${shortName}%`),
            ilike(teams.shortName, `%${shortName}%`)
          )
        );

      if (fuzzyMatch.length > 0) {
        return fuzzyMatch[0].id;
      }
    }

    const defaultCountry = competitionCode === "LIB" ? "América do Sul" : "Brasil";
    const logoUrl = `https://api.sofascore.app/api/v1/team/${sofaTeam.id}/image`;
    const [inserted] = await db
      .insert(teams)
      .values({
        name,
        shortName,
        acronym,
        country: defaultCountry,
        logoUrl,
      })
      .returning();

    return inserted.id;
  }

  private static async findOrCreateVenue(
    sofaVenue?: {
      name?: string;
      city?: { name: string };
      stadium?: { name: string; capacity?: number };
      capacity?: number;
    },
    competitionCode: string = "BRA-1"
  ): Promise<number | null> {
    if (!sofaVenue?.name && !sofaVenue?.stadium?.name) return null;

    const name = (sofaVenue.stadium?.name || sofaVenue.name || "").trim();
    const defaultCountry = competitionCode === "LIB" ? "América do Sul" : "Brasil";
    const city = sofaVenue.city?.name || defaultCountry;
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
        country: defaultCountry,
        capacity,
        surface: "Grass",
      })
      .returning();

    return inserted.id;
  }
}
