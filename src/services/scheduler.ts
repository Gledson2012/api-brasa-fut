import { db } from "../db/index.js";
import { matches, seasons, competitions } from "../db/schema.js";
import { inArray, eq } from "drizzle-orm";
import { EspnSyncService, ESPN_TOURNAMENTS } from "./espnSync.js";

const LIVE_STATUSES = [
  "FIRST_HALF",
  "HALF_TIME",
  "SECOND_HALF",
  "EXTRA_TIME",
  "PENALTIES",
] as const;

export class BackgroundSyncScheduler {
  private static liveInterval: NodeJS.Timeout | null = null;
  private static todayInterval: NodeJS.Timeout | null = null;
  private static isRunning = false;

  public static start() {
    if (this.isRunning || process.env.NODE_ENV === "test") {
      return;
    }

    this.isRunning = true;
    console.log("⏱️  [Scheduler] Agendador de sincronização em segundo plano iniciado.");

    // Polling de partidas ao vivo a cada 45 segundos
    this.liveInterval = setInterval(async () => {
      try {
        await this.syncActiveMatches();
      } catch (err: any) {
        console.warn("[Scheduler] Erro no polling de jogos ao vivo:", err.message);
      }
    }, 45 * 1000);

    // Sincronização geral de jogos do dia a cada 15 minutos
    this.todayInterval = setInterval(async () => {
      try {
        console.log("[Scheduler] Executando sincronização periódica de jogos do dia...");
        await EspnSyncService.syncAll();
      } catch (err: any) {
        console.warn("[Scheduler] Erro na sincronização periódica:", err.message);
      }
    }, 15 * 60 * 1000);
  }

  public static stop() {
    if (this.liveInterval) {
      clearInterval(this.liveInterval);
      this.liveInterval = null;
    }
    if (this.todayInterval) {
      clearInterval(this.todayInterval);
      this.todayInterval = null;
    }
    this.isRunning = false;
    console.log("🛑 [Scheduler] Agendador em segundo plano finalizado.");
  }

  /**
   * Sincroniza apenas as ligas que possuem jogos ao vivo no momento
   */
  public static async syncActiveMatches(): Promise<number> {
    // 1. Verificar se existem partidas ao vivo registradas no banco
    const liveMatches = await db
      .select({
        id: matches.id,
        competitionCode: competitions.code,
      })
      .from(matches)
      .innerJoin(seasons, eq(matches.seasonId, seasons.id))
      .innerJoin(competitions, eq(seasons.competitionId, competitions.id))
      .where(inArray(matches.status, [...LIVE_STATUSES]));

    const targetTournamentCodes = new Set<string>();
    for (const m of liveMatches) {
      if (m.competitionCode) {
        targetTournamentCodes.add(m.competitionCode);
      }
    }

    // Se houver ligas com partidas ao vivo no banco, atualiza apenas elas
    let synced = 0;
    if (targetTournamentCodes.size > 0) {
      for (const code of targetTournamentCodes) {
        const tournament = ESPN_TOURNAMENTS.find((t) => t.code === code);
        if (tournament) {
          const count = await EspnSyncService.syncLeague(tournament);
          synced += count;
        }
      }
    }

    return synced;
  }
}
