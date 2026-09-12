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
  players,
  teamRosters,
  matchEvents,
  matchLineups,
  playerSeasonStatistics,
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

  public static async fetchJson<T>(url: string): Promise<T | null> {
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
      ], { maxBuffer: 20 * 1024 * 1024 });

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

          // 5. Persistir dados reais de jogos e classificação
          const res = await this.processData(
            leagueEvents,
            rows,
            currentRoundNum,
            league.code
          );
          totalMatchesSynced += res.matchesSynced;
          totalStandingsSynced += res.standingsSynced;

          // 6. Sincronizar Artilharia, Líderes de Assistência e Estatísticas Oficiais
          await this.syncLeagueTopPlayers(league);

          // 7. Sincronizar elencos completos de todos os times com fotos oficiais (apenas Série A para manter sync rápido)
          if (league.code === "BRA-1") {
            const teamList = rows.map((r) => r.team);
            await this.syncLeagueSquads(teamList, league.code, league.tournamentId, league.seasonId);
          }
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

        let savedMatchId: number;

        if (existing.length > 0) {
          savedMatchId = existing[0].id;
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
            .where(eq(matches.id, savedMatchId));

          if (status === "FIRST_HALF" || status === "SECOND_HALF") {
            realtimeBroker.publishMatchUpdate({
              type: "SCORE_UPDATE",
              matchId: savedMatchId,
              timestamp: new Date().toISOString(),
              data: { homeScore, awayScore, status },
            });

            // Disparo automático de Push FCM se detectar novo gol
            const prevHome = existing[0].homeScore ?? 0;
            const prevAway = existing[0].awayScore ?? 0;
            const curHome = homeScore ?? prevHome;
            const curAway = awayScore ?? prevAway;

            if (curHome > prevHome || curAway > prevAway) {
              const scoringTeamId = curHome > prevHome ? homeTeamId : awayTeamId;
              const scoringTeamName = curHome > prevHome ? (event.homeTeam?.name || "Mandante") : (event.awayTeam?.name || "Visitante");
              const opponentName = curHome > prevHome ? (event.awayTeam?.name || "Visitante") : (event.homeTeam?.name || "Mandante");

              import("./fcm.js").then(({ FCMService }) => {
                FCMService.sendGoalNotification({
                  matchId: savedMatchId,
                  teamId: scoringTeamId,
                  teamName: scoringTeamName,
                  opponentName,
                  minute: 90,
                  homeScore: curHome,
                  awayScore: curAway,
                }).catch(() => {});
              }).catch(() => {});
            }
          }
        } else {
          const [inserted] = await db.insert(matches).values({
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
          }).returning();
          savedMatchId = inserted.id;
        }
        matchesSyncedCount++;

        // Sincronizar eventos reais (gols, cartões, escalações) para partidas finalizadas ou em andamento
        if (status === "FINISHED" || status === "FIRST_HALF" || status === "SECOND_HALF") {
          this.syncMatchIncidentsAndLineups(event.id, savedMatchId, homeTeamId, awayTeamId, season.id).catch(() => {});
        }
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

    return {
      success: true,
      message: "Dados do Sofascore sincronizados com sucesso no banco!",
      matchesSynced: matchesSyncedCount,
      standingsSynced: standingsSyncedCount,
      currentRound: currentRoundNum,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Sincroniza artilharia, assistências e scouts individuais da liga
   */
  public static async syncLeagueTopPlayers(league: {
    code: string;
    name: string;
    tournamentId: number;
    seasonId: number;
  }) {
    try {
      const url = `https://api.sofascore.com/api/v1/unique-tournament/${league.tournamentId}/season/${league.seasonId}/top-players/overall`;
      const data = await this.fetchJson<{ topPlayers?: Record<string, any[]> }>(url);
      if (!data?.topPlayers) return;

      const [comp] = await db.select().from(competitions).where(eq(competitions.code, league.code));
      if (!comp) return;

      const [season] = await db
        .select()
        .from(seasons)
        .where(and(eq(seasons.competitionId, comp.id), eq(seasons.name, "2026")));
      if (!season) return;

      // Agrupar por jogador
      const playerStatMap = new Map<number, {
        sofaPlayer: any;
        sofaTeam: any;
        stats: Record<string, any>;
      }>();

      const categories = ["goals", "assists", "rating", "expectedGoals", "expectedAssists", "totalShots", "keyPasses"];
      for (const cat of categories) {
        const list = data.topPlayers[cat] || [];
        for (const item of list) {
          if (!item.player?.id) continue;
          const pid = item.player.id;
          let entry = playerStatMap.get(pid);
          if (!entry) {
            entry = { sofaPlayer: item.player, sofaTeam: item.team, stats: {} };
            playerStatMap.set(pid, entry);
          }
          entry.stats = { ...entry.stats, ...item.statistics };
          if (item.team) entry.sofaTeam = item.team;
        }
      }

      for (const [, item] of playerStatMap.entries()) {
        try {
          const playerId = await this.findOrCreatePlayer(item.sofaPlayer);
          const teamId = item.sofaTeam ? await this.findOrCreateTeam(item.sofaTeam, league.code) : null;
          if (!teamId) continue;

          // Registrar no elenco da temporada
          await db.insert(teamRosters).values({
            teamId,
            playerId,
            seasonId: season.id,
            position: this.mapPosition(item.sofaPlayer.position),
          }).onConflictDoNothing();

          const goals = Number(item.stats.goals || 0);
          const assists = Number(item.stats.assists || 0);
          const appearances = Number(item.stats.appearances || 0);
          const ratingVal = item.stats.rating ? String(Number(item.stats.rating).toFixed(2)) : "0.0";
          const xG = item.stats.expectedGoals ? String(Number(item.stats.expectedGoals).toFixed(2)) : "0.0";
          const xA = item.stats.expectedAssists ? String(Number(item.stats.expectedAssists).toFixed(2)) : "0.0";
          const shotsTotal = Number(item.stats.totalShots || 0);
          const shotsOnTarget = Number(item.stats.shotsOnTarget || 0);
          const keyPasses = Number(item.stats.keyPasses || 0);
          const yellowCards = Number(item.stats.yellowCards || 0);
          const redCards = Number(item.stats.redCards || 0);

          const existingStat = await db
            .select()
            .from(playerSeasonStatistics)
            .where(
              and(
                eq(playerSeasonStatistics.playerId, playerId),
                eq(playerSeasonStatistics.seasonId, season.id)
              )
            );

          if (existingStat.length > 0) {
            await db
              .update(playerSeasonStatistics)
              .set({
                teamId,
                appearances: appearances || existingStat[0].appearances,
                goals: goals || existingStat[0].goals,
                assists: assists || existingStat[0].assists,
                rating: ratingVal !== "0.0" ? ratingVal : existingStat[0].rating,
                expectedGoals: xG !== "0.0" ? xG : existingStat[0].expectedGoals,
                expectedAssists: xA !== "0.0" ? xA : existingStat[0].expectedAssists,
                shotsTotal: shotsTotal || existingStat[0].shotsTotal,
                shotsOnTarget: shotsOnTarget || existingStat[0].shotsOnTarget,
                keyPasses: keyPasses || existingStat[0].keyPasses,
                yellowCards: yellowCards || existingStat[0].yellowCards,
                redCards: redCards || existingStat[0].redCards,
                updatedAt: new Date(),
              })
              .where(eq(playerSeasonStatistics.id, existingStat[0].id));
          } else {
            await db.insert(playerSeasonStatistics).values({
              playerId,
              seasonId: season.id,
              teamId,
              appearances,
              goals,
              assists,
              rating: ratingVal,
              expectedGoals: xG,
              expectedAssists: xA,
              shotsTotal,
              shotsOnTarget,
              keyPasses,
              yellowCards,
              redCards,
            });
          }
        } catch (itemErr) {
          // Ignora falha pontual de um jogador
        }
      }
    } catch (err: any) {
      console.warn(`[SofascoreSync] Erro ao sincronizar scouts de ${league.name}:`, err.message);
    }
  }

  /**
   * Sincroniza elencos completos e oficiais de todos os times da liga com fotos e dados biométricos
   */
  public static async syncLeagueSquads(
    teamsList: Array<{ id: number; name: string; shortName?: string; nameCode?: string }>,
    leagueCode: string = "BRA-1",
    tournamentId: number = 325,
    seasonSofascoreId: number = 87678
  ) {
    try {
      const [comp] = await db.select().from(competitions).where(eq(competitions.code, leagueCode));
      if (!comp) return;

      const [season] = await db
        .select()
        .from(seasons)
        .where(and(eq(seasons.competitionId, comp.id), eq(seasons.name, "2026")));
      if (!season) return;

      console.log(`👥 [SofascoreSync] Sincronizando elencos completos com fotos para ${teamsList.length} clubes de ${leagueCode}...`);

      for (const t of teamsList) {
        if (!t?.id) continue;
        try {
          const dbTeamId = await this.findOrCreateTeam(t, leagueCode);
          const squadData = await this.fetchJson<{ players?: Array<{ player: any }> }>(
            `https://api.sofascore.com/api/v1/team/${t.id}/players`
          );
          if (!squadData?.players || !Array.isArray(squadData.players)) continue;

          for (const item of squadData.players) {
            const p = item.player;
            if (!p?.name) continue;

            const playerId = await this.findOrCreatePlayer(p);
            const jerseyNumber = p.jerseyNumber ? parseInt(p.jerseyNumber, 10) : (p.shirtNumber || null);

            // Registrar no elenco oficial do time
            await db.insert(teamRosters).values({
              teamId: dbTeamId,
              playerId,
              seasonId: season.id,
              jerseyNumber,
              position: this.mapPosition(p.position),
            }).onConflictDoNothing();

            // Para jogadores de destaque (como Memphis Depay), sincronizar scouts específicos
            const isMemphis = p.name.toLowerCase().includes("depay") || p.name.toLowerCase().includes("memphis");
            if (isMemphis) {
              try {
                const statsUrl = `https://api.sofascore.com/api/v1/player/${p.id}/unique-tournament/${tournamentId}/season/${seasonSofascoreId}/statistics/overall`;
                const statsData = await this.fetchJson<{ statistics?: Record<string, any> }>(statsUrl);
                const st = statsData?.statistics;
                if (st) {
                  const goals = Number(st.goals || 0);
                  const assists = Number(st.assists || 0);
                  const appearances = Number(st.appearances || 0);
                  const matchesStarted = Number(st.matchesStarted || 0);
                  const minutesPlayed = Number(st.minutesPlayed || 0);
                  const rating = st.rating ? String(Number(st.rating).toFixed(2)) : "0.0";
                  const xG = st.expectedGoals ? String(Number(st.expectedGoals).toFixed(2)) : "0.0";
                  const xA = st.expectedAssists ? String(Number(st.expectedAssists).toFixed(2)) : "0.0";
                  const shotsTotal = Number(st.totalShots || 0);
                  const shotsOnTarget = Number(st.shotsOnTarget || 0);
                  const keyPasses = Number(st.keyPasses || 0);
                  const yellowCards = Number(st.yellowCards || 0);
                  const redCards = Number(st.redCards || 0);

                  const existingStat = await db
                    .select()
                    .from(playerSeasonStatistics)
                    .where(
                      and(
                        eq(playerSeasonStatistics.playerId, playerId),
                        eq(playerSeasonStatistics.seasonId, season.id)
                      )
                    );

                  if (existingStat.length > 0) {
                    await db
                      .update(playerSeasonStatistics)
                      .set({
                        appearances,
                        matchesStarted,
                        minutesPlayed,
                        goals,
                        assists,
                        rating,
                        expectedGoals: xG,
                        expectedAssists: xA,
                        shotsTotal,
                        shotsOnTarget,
                        keyPasses,
                        yellowCards,
                        redCards,
                        updatedAt: new Date(),
                      })
                      .where(eq(playerSeasonStatistics.id, existingStat[0].id));
                  } else {
                    await db.insert(playerSeasonStatistics).values({
                      playerId,
                      seasonId: season.id,
                      teamId: dbTeamId,
                      appearances,
                      matchesStarted,
                      minutesPlayed,
                      goals,
                      assists,
                      rating,
                      expectedGoals: xG,
                      expectedAssists: xA,
                      shotsTotal,
                      shotsOnTarget,
                      keyPasses,
                      yellowCards,
                      redCards,
                    });
                  }
                }
              } catch {
                // Ignora falha pontual
              }
            }
          }
        } catch (teamErr: any) {
          console.warn(`[SofascoreSync] Erro ao sincronizar elenco de ${t.name}:`, teamErr.message);
        }
      }
    } catch (err: any) {
      console.warn(`[SofascoreSync] Erro geral ao sincronizar elencos de ${leagueCode}:`, err.message);
    }
  }

  /**
   * Sincroniza eventos (gols, cartões) e escalações de uma partida
   */
  private static async syncMatchIncidentsAndLineups(
    sofaEventId: number,
    matchId: number,
    homeTeamId: number,
    awayTeamId: number,
    seasonId: number
  ) {
    try {
      // 1. Incidents
      const incidentsUrl = `https://api.sofascore.com/api/v1/event/${sofaEventId}/incidents`;
      const incidentsData = await this.fetchJson<{ incidents?: any[] }>(incidentsUrl);
      if (incidentsData?.incidents) {
        for (const inc of incidentsData.incidents) {
          if (!inc.player?.id) continue;
          const playerId = await this.findOrCreatePlayer(inc.player);
          const teamId = inc.isHome ? homeTeamId : awayTeamId;

          let eventType: "GOAL" | "OWN_GOAL" | "PENALTY_SCORED" | "YELLOW_CARD" | "RED_CARD" | "SECOND_YELLOW" | "SUBSTITUTION" | null = null;
          if (inc.incidentType === "goal") {
            if (inc.incidentClass === "ownGoal") eventType = "OWN_GOAL";
            else if (inc.incidentClass === "penalty") eventType = "PENALTY_SCORED";
            else eventType = "GOAL";
          } else if (inc.incidentType === "card") {
            if (inc.incidentClass === "yellow") eventType = "YELLOW_CARD";
            else if (inc.incidentClass === "red") eventType = "RED_CARD";
            else if (inc.incidentClass === "yellowRed") eventType = "SECOND_YELLOW";
          } else if (inc.incidentType === "substitution") {
            eventType = "SUBSTITUTION";
          }

          if (eventType) {
            let relatedPlayerId: number | null = null;
            if (inc.playerIn?.id) {
              relatedPlayerId = await this.findOrCreatePlayer(inc.playerIn);
            }

            await db.insert(matchEvents).values({
              matchId,
              teamId,
              playerId,
              relatedPlayerId,
              type: eventType,
              minute: inc.time || 0,
              extraMinute: inc.addedTime || 0,
              description: inc.reason || inc.text || null,
            });
          }
        }
      }

      // 2. Lineups
      const lineupsUrl = `https://api.sofascore.com/api/v1/event/${sofaEventId}/lineups`;
      const lineupsData = await this.fetchJson<{
        home?: { players?: any[] };
        away?: { players?: any[] };
      }>(lineupsUrl);

      if (lineupsData?.home?.players || lineupsData?.away?.players) {
        const processSide = async (sidePlayers: any[], teamId: number) => {
          for (const item of sidePlayers) {
            if (!item.player?.id) continue;
            const pId = await this.findOrCreatePlayer(item.player);
            const jersey = item.shirtNumber || (item.jerseyNumber ? parseInt(item.jerseyNumber, 10) : null);
            await db.insert(matchLineups).values({
              matchId,
              teamId,
              playerId: pId,
              isStarter: !item.substitute,
              jerseyNumber: jersey,
              formationPosition: item.position || null,
            }).onConflictDoNothing();
          }
        };

        if (lineupsData.home?.players) await processSide(lineupsData.home.players, homeTeamId);
        if (lineupsData.away?.players) await processSide(lineupsData.away.players, awayTeamId);
      }
    } catch {
      // Ignora erro para não abortar fluxo principal
    }
  }

  public static async findOrCreatePlayer(sofaPlayer: {
    id: number;
    name: string;
    slug?: string;
    shortName?: string;
    position?: string;
    country?: { name: string };
    birthDate?: string;
    height?: number;
    weight?: number;
  }): Promise<number> {
    const fullName = sofaPlayer.name.trim();
    const knownName = sofaPlayer.shortName?.trim() || fullName;

    // Buscar se já existe pelo nome conhecido ou completo
    const found = await db
      .select()
      .from(players)
      .where(
        or(
          eq(players.knownName, knownName),
          eq(players.knownName, fullName),
          and(
            eq(players.firstName, fullName.split(" ")[0] || fullName),
            eq(players.lastName, fullName.split(" ").slice(1).join(" ") || fullName)
          )
        )
      );

    if (found.length > 0) {
      if (!found[0].photoUrl && sofaPlayer.id) {
        const photoUrl = `https://api.sofascore.app/api/v1/player/${sofaPlayer.id}/image`;
        await db
          .update(players)
          .set({
            photoUrl,
            heightCm: sofaPlayer.height || found[0].heightCm,
            weightKg: sofaPlayer.weight || found[0].weightKg,
            updatedAt: new Date(),
          })
          .where(eq(players.id, found[0].id));
      }
      return found[0].id;
    }

    const parts = fullName.split(" ");
    const firstName = parts[0] || fullName;
    const lastName = parts.slice(1).join(" ") || firstName;
    const nationality = sofaPlayer.country?.name || "Brasil";
    const primaryPosition = this.mapPosition(sofaPlayer.position);
    const photoUrl = `https://api.sofascore.app/api/v1/player/${sofaPlayer.id}/image`;

    const [inserted] = await db
      .insert(players)
      .values({
        firstName,
        lastName,
        knownName,
        nationality,
        primaryPosition,
        heightCm: sofaPlayer.height || null,
        weightKg: sofaPlayer.weight || null,
        photoUrl,
      })
      .returning();

    return inserted.id;
  }

  private static mapPosition(sofaPos?: string): "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD" {
    if (!sofaPos) return "FORWARD";
    const p = sofaPos.toUpperCase();
    if (p === "G" || p.includes("GOAL")) return "GOALKEEPER";
    if (p === "D" || p.includes("DEF")) return "DEFENDER";
    if (p === "M" || p.includes("MID")) return "MIDFIELDER";
    return "FORWARD";
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
      if (sofaTeam.id) {
        const logoUrl = `https://api.sofascore.app/api/v1/team/${sofaTeam.id}/image`;
        if (exactMatch[0].logoUrl !== logoUrl) {
          await db
            .update(teams)
            .set({ logoUrl, updatedAt: new Date() })
            .where(eq(teams.id, exactMatch[0].id));
        }
      }
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
        if (sofaTeam.id) {
          const logoUrl = `https://api.sofascore.app/api/v1/team/${sofaTeam.id}/image`;
          if (fuzzyMatch[0].logoUrl !== logoUrl) {
            await db
              .update(teams)
              .set({ logoUrl, updatedAt: new Date() })
              .where(eq(teams.id, fuzzyMatch[0].id));
          }
        }
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
