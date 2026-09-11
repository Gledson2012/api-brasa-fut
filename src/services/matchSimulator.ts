import { db } from "../db/index.js";
import { matches, matchEvents, matchStatistics, teams, players, teamRosters } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { realtimeBroker } from "./pubsub.js";

interface ActiveSimulation {
  matchId: number;
  timer: NodeJS.Timeout;
  currentMinute: number;
}

export class MatchSimulator {
  private static activeSimulations = new Map<number, ActiveSimulation>();

  public static async start(matchId: number, speedMs: number = 3000): Promise<{ message: string }> {
    if (this.activeSimulations.has(matchId)) {
      return { message: "Simulação já está em andamento para esta partida." };
    }

    const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
    if (!match) {
      throw new Error("Partida não encontrada");
    }

    // Obter jogadores do time da casa e visitante
    const homeRoster = await db
      .select({ id: players.id, name: players.knownName, pos: players.primaryPosition })
      .from(teamRosters)
      .innerJoin(players, eq(teamRosters.playerId, players.id))
      .where(and(eq(teamRosters.teamId, match.homeTeamId), eq(teamRosters.seasonId, match.seasonId)));

    const awayRoster = await db
      .select({ id: players.id, name: players.knownName, pos: players.primaryPosition })
      .from(teamRosters)
      .innerJoin(players, eq(teamRosters.playerId, players.id))
      .where(and(eq(teamRosters.teamId, match.awayTeamId), eq(teamRosters.seasonId, match.seasonId)));

    let currentMinute = 65; // Começa na segunda etapa para partidas ativas

    const timer = setInterval(async () => {
      currentMinute += 2;

      if (currentMinute > 90) {
        // Finalizar jogo
        await db
          .update(matches)
          .set({ status: "FINISHED" })
          .where(eq(matches.id, matchId));

        realtimeBroker.publishMatchUpdate({
          type: "STATUS_CHANGE",
          matchId,
          timestamp: new Date().toISOString(),
          data: { status: "FINISHED", minute: 90, message: "Fim de jogo!" },
        });

        this.stop(matchId);
        return;
      }

      // Possibilidade aleatória de evento (Gol ou Cartão)
      const roll = Math.random();

      if (roll < 0.35) {
        // Evento de Gol!
        const isHome = Math.random() > 0.45;
        const scoringTeamId = isHome ? match.homeTeamId : match.awayTeamId;
        const roster = isHome ? homeRoster : awayRoster;
        const scorer = roster.length > 0 ? roster[Math.floor(Math.random() * roster.length)] : null;

        if (scorer) {
          const [m] = await db.select().from(matches).where(eq(matches.id, matchId));
          let homeScore = m?.homeScore ?? 0;
          let awayScore = m?.awayScore ?? 0;

          if (isHome) homeScore++;
          else awayScore++;

          await db
            .update(matches)
            .set({ homeScore, awayScore })
            .where(eq(matches.id, matchId));

          const [event] = await db
            .insert(matchEvents)
            .values({
              matchId,
              teamId: scoringTeamId,
              playerId: scorer.id,
              type: "GOAL",
              minute: currentMinute,
              description: `GOL! Finalização certeira de ${scorer.name}!`,
            })
            .returning();

          realtimeBroker.publishMatchUpdate({
            type: "MATCH_EVENT",
            matchId,
            timestamp: new Date().toISOString(),
            data: { event, homeScore, awayScore },
          });

          realtimeBroker.publishMatchUpdate({
            type: "SCORE_UPDATE",
            matchId,
            timestamp: new Date().toISOString(),
            data: { homeScore, awayScore, minute: currentMinute },
          });
        }
      } else if (roll < 0.6) {
        // Evento de Cartão Amarelo
        const isHome = Math.random() > 0.5;
        const cardTeamId = isHome ? match.homeTeamId : match.awayTeamId;
        const roster = isHome ? homeRoster : awayRoster;
        const player = roster.length > 0 ? roster[Math.floor(Math.random() * roster.length)] : null;

        if (player) {
          const [event] = await db
            .insert(matchEvents)
            .values({
              matchId,
              teamId: cardTeamId,
              playerId: player.id,
              type: "YELLOW_CARD",
              minute: currentMinute,
              description: `Cartão amarelo para ${player.name} por entrada dura.`,
            })
            .returning();

          realtimeBroker.publishMatchUpdate({
            type: "MATCH_EVENT",
            matchId,
            timestamp: new Date().toISOString(),
            data: event,
          });
        }
      }
    }, speedMs);

    this.activeSimulations.set(matchId, { matchId, timer, currentMinute });
    return { message: `Simulação iniciada para a partida ${matchId} (velocidade: 1 tick a cada ${speedMs}ms)` };
  }

  public static stop(matchId: number): { message: string } {
    const sim = this.activeSimulations.get(matchId);
    if (!sim) {
      return { message: "Nenhuma simulação ativa para esta partida." };
    }

    clearInterval(sim.timer);
    this.activeSimulations.delete(matchId);
    return { message: `Simulação encerrada para a partida ${matchId}.` };
  }

  public static isRunning(matchId: number): boolean {
    return this.activeSimulations.has(matchId);
  }

  public static listRunning(): number[] {
    return Array.from(this.activeSimulations.keys());
  }
}
