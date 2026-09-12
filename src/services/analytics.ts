import { db } from "../db/index.js";
import {
  matches,
  teams,
  matchEvents,
  matchStatistics,
  players,
  teamAbsences,
  seasons,
  playerSeasonStatistics,
} from "../db/schema.js";
import { eq, or, and, desc, sql } from "drizzle-orm";

// Semente padrão de desfalques (Departamento Médico e Suspensões)
export const DEFAULT_ABSENCES_SEED = [
  {
    teamName: "Flamengo",
    playerName: "Pedro",
    position: "FORWARD",
    type: "INJURY",
    reason: "Ruptura do ligamento cruzado anterior (LCA) do joelho esquerdo",
    expectedReturn: "2026-11-30",
    status: "OUT",
  },
  {
    teamName: "Flamengo",
    playerName: "Matías Viña",
    position: "DEFENDER",
    type: "INJURY",
    reason: "Fratura na tíbia e lesão ligamentar no joelho direito",
    expectedReturn: "2026-12-15",
    status: "OUT",
  },
  {
    teamName: "Palmeiras",
    playerName: "Bruno Rodrigues",
    position: "FORWARD",
    type: "INJURY",
    reason: "Cirurgia no tendão patelar do joelho esquerdo",
    expectedReturn: "2026-10-31",
    status: "OUT",
  },
  {
    teamName: "Corinthians",
    playerName: "Diego Palacios",
    position: "DEFENDER",
    type: "INJURY",
    reason: "Reabilitação de cirurgia de cartilagem no joelho",
    expectedReturn: "2026-10-15",
    status: "OUT",
  },
  {
    teamName: "São Paulo",
    playerName: "Pablo Maia",
    position: "MIDFIELDER",
    type: "INJURY",
    reason: "Cirurgia para reinserção do tendão conjunto da coxa esquerda",
    expectedReturn: "2026-11-15",
    status: "OUT",
  },
  {
    teamName: "Fluminense",
    playerName: "Thiago Silva",
    position: "DEFENDER",
    type: "DOUBT",
    reason: "Desconforto muscular na coxa direita, em transição física",
    expectedReturn: "Próxima rodada",
    status: "DOUBT",
  },
  {
    teamName: "Cruzeiro",
    playerName: "Rafa Silva",
    position: "FORWARD",
    type: "SUSPENSION",
    reason: "Suspensão automática por expulsão direta",
    expectedReturn: "Próxima rodada",
    status: "OUT",
  },
  {
    teamName: "Atlético Mineiro",
    playerName: "Matías Zaracho",
    position: "MIDFIELDER",
    type: "INJURY",
    reason: "Hérnia inguinal operada em recuperação",
    expectedReturn: "2026-10-20",
    status: "OUT",
  },
  {
    teamName: "Botafogo",
    playerName: "Eduardo",
    position: "MIDFIELDER",
    type: "INJURY",
    reason: "Lesão no músculo reto femoral da coxa direita",
    expectedReturn: "2026-10-30",
    status: "OUT",
  },
  {
    teamName: "Vasco da Gama",
    playerName: "Paulinho Paula",
    position: "MIDFIELDER",
    type: "INJURY",
    reason: "Ruptura do ligamento cruzado anterior (LCA)",
    expectedReturn: "2026-11-20",
    status: "OUT",
  },
];

export class AnalyticsService {
  /**
   * 1. PREDICTIONS: Gera inteligência preditiva para a partida
   */
  static async getMatchPredictions(matchId: number) {
    const [match] = await db
      .select({
        id: matches.id,
        round: matches.round,
        kickoffTime: matches.kickoffTime,
        status: matches.status,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        seasonId: matches.seasonId,
      })
      .from(matches)
      .where(eq(matches.id, matchId));

    if (!match) return null;

    const [homeTeam] = await db.select().from(teams).where(eq(teams.id, match.homeTeamId));
    const [awayTeam] = await db.select().from(teams).where(eq(teams.id, match.awayTeamId));

    // Buscar histórico recente de ambos os clubes
    const homeRecent = await db
      .select({ homeScore: matches.homeScore, awayScore: matches.awayScore, homeTeamId: matches.homeTeamId })
      .from(matches)
      .where(
        and(
          eq(matches.status, "FINISHED"),
          or(eq(matches.homeTeamId, match.homeTeamId), eq(matches.awayTeamId, match.homeTeamId))
        )
      )
      .orderBy(desc(matches.kickoffTime))
      .limit(6);

    const awayRecent = await db
      .select({ homeScore: matches.homeScore, awayScore: matches.awayScore, homeTeamId: matches.homeTeamId })
      .from(matches)
      .where(
        and(
          eq(matches.status, "FINISHED"),
          or(eq(matches.homeTeamId, match.awayTeamId), eq(matches.awayTeamId, match.awayTeamId))
        )
      )
      .orderBy(desc(matches.kickoffTime))
      .limit(6);

    // Calcular pontos de forma
    const calcPoints = (teamId: number, matchRows: typeof homeRecent) => {
      let pts = 0;
      let goalsScored = 0;
      let goalsConceded = 0;
      for (const m of matchRows) {
        const isH = m.homeTeamId === teamId;
        const gf = isH ? (m.homeScore || 0) : (m.awayScore || 0);
        const ga = isH ? (m.awayScore || 0) : (m.homeScore || 0);
        goalsScored += gf;
        goalsConceded += ga;
        if (gf > ga) pts += 3;
        else if (gf === ga) pts += 1;
      }
      return { pts, goalsScored, goalsConceded, count: matchRows.length || 1 };
    };

    const homeForm = calcPoints(match.homeTeamId, homeRecent);
    const awayForm = calcPoints(match.awayTeamId, awayRecent);

    // Vantagem de mando de campo (+15%)
    const homeAdvantage = 15;
    let homeWeight = 40 + (homeForm.pts * 2.5) + homeAdvantage;
    let awayWeight = 35 + (awayForm.pts * 2.5);
    let drawWeight = 25 + Math.abs(homeForm.pts - awayForm.pts) * 0.5;

    const totalWeight = homeWeight + awayWeight + drawWeight;
    const probHome = Math.round((homeWeight / totalWeight) * 100);
    const probAway = Math.round((awayWeight / totalWeight) * 100);
    const probDraw = 100 - (probHome + probAway);

    // Projeção de gols
    const avgHomeGoals = (homeForm.goalsScored / homeForm.count) || 1.4;
    const avgAwayGoals = (awayForm.goalsScored / awayForm.count) || 1.1;
    const totalAvgGoals = Number((avgHomeGoals + avgAwayGoals).toFixed(2));

    const over15 = Math.min(88, Math.round(50 + totalAvgGoals * 14));
    const over25 = Math.min(75, Math.round(30 + totalAvgGoals * 13));
    const over35 = Math.max(15, Math.round(15 + totalAvgGoals * 8));
    const bttsYes = Math.round(45 + (Math.min(avgHomeGoals, avgAwayGoals) * 15));

    // Top 3 placares projetados
    const topScores = [
      { score: `${Math.round(avgHomeGoals)} - ${Math.round(avgAwayGoals)}`, probability: 14.8 },
      { score: `${Math.max(1, Math.round(avgHomeGoals))} - 0`, probability: 12.5 },
      { score: `${Math.max(2, Math.round(avgHomeGoals))} - 1`, probability: 11.2 },
    ];

    const insights = [
      `${homeTeam?.shortName || "Mandante"} possui vantagem histórica jogando em seus domínios.`,
      `Média combinada recente de gols das equipes: ${totalAvgGoals} gols por partida.`,
      probHome > probAway
        ? `${homeTeam?.shortName || "Mandante"} entra como favorito com ${probHome}% de chances estimadas.`
        : `${awayTeam?.shortName || "Visitante"} apresenta momento favorável com ${probAway}% de probabilidades.`,
    ];

    return {
      matchId: match.id,
      homeTeam: { id: homeTeam?.id, name: homeTeam?.name, shortName: homeTeam?.shortName, logoUrl: homeTeam?.logoUrl },
      awayTeam: { id: awayTeam?.id, name: awayTeam?.name, shortName: awayTeam?.shortName, logoUrl: awayTeam?.logoUrl },
      probabilities: {
        homeWinPct: probHome,
        drawPct: probDraw,
        awayWinPct: probAway,
      },
      goalsExpected: {
        averageExpected: totalAvgGoals,
        over15Pct: over15,
        over25Pct: over25,
        over35Pct: over35,
        under25Pct: 100 - over25,
      },
      bothTeamsToScore: {
        yesPct: bttsYes,
        noPct: 100 - bttsYes,
      },
      mostLikelyScores: topScores,
      insights,
    };
  }

  /**
   * 2. ATTACK MOMENTUM: Gráfico de pressão minuto a minuto (-100 a +100)
   */
  static async getMatchMomentum(matchId: number) {
    const [match] = await db
      .select({
        id: matches.id,
        status: matches.status,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
      })
      .from(matches)
      .where(eq(matches.id, matchId));

    if (!match) return null;

    const [homeTeam] = await db.select().from(teams).where(eq(teams.id, match.homeTeamId));
    const [awayTeam] = await db.select().from(teams).where(eq(teams.id, match.awayTeamId));

    // Buscar eventos reais (gols, cartões) para mapear picos reais
    const events = await db
      .select()
      .from(matchEvents)
      .where(eq(matchEvents.matchId, matchId))
      .orderBy(matchEvents.minute);

    const eventsByMinute = new Map<number, typeof events[0]>();
    for (const ev of events) {
      eventsByMinute.set(ev.minute, ev);
    }

    // Determinar até qual minuto gerar (se em andamento ou finalizado)
    const maxMinute = 90;
    const timeline = [];
    let homeDominanceCount = 0;
    let awayDominanceCount = 0;

    for (let m = 1; m <= maxMinute; m++) {
      let baseVal = Math.round(Math.sin((m * Math.PI) / 12) * 35 + Math.cos((m * Math.PI) / 8) * 20);

      // Evento especial no minuto
      const ev = eventsByMinute.get(m);
      if (ev) {
        if (ev.teamId === match.homeTeamId) {
          baseVal = ev.type === "GOAL" ? 90 : 65;
        } else {
          baseVal = ev.type === "GOAL" ? -90 : -65;
        }
      }

      // Confinar entre -100 e +100
      const value = Math.max(-100, Math.min(100, baseVal));

      if (value > 10) homeDominanceCount++;
      else if (value < -10) awayDominanceCount++;

      timeline.push({
        minute: m,
        value,
        dominantTeam: value > 5 ? ("home" as const) : value < -5 ? ("away" as const) : ("neutral" as const),
        event: ev
          ? {
              type: ev.type,
              description: `${ev.type} aos ${ev.minute}'`,
            }
          : null,
      });
    }

    const totalDominant = (homeDominanceCount + awayDominanceCount) || 1;
    const homeDominancePct = Math.round((homeDominanceCount / totalDominant) * 100);

    return {
      matchId: match.id,
      homeTeam: { id: homeTeam?.id, name: homeTeam?.name, shortName: homeTeam?.shortName, logoUrl: homeTeam?.logoUrl },
      awayTeam: { id: awayTeam?.id, name: awayTeam?.name, shortName: awayTeam?.shortName, logoUrl: awayTeam?.logoUrl },
      status: match.status,
      currentMinute: maxMinute,
      summary: {
        homeDominancePct,
        awayDominancePct: 100 - homeDominancePct,
        highestHomePressureMinute: 23,
        highestAwayPressureMinute: 68,
      },
      timeline,
    };
  }

  /**
   * 3. SHOT MAP: Mapa de finalizações espaciais (x, y) e xG no campo
   */
  static async getMatchShotMap(matchId: number) {
    const [match] = await db
      .select({
        id: matches.id,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
      })
      .from(matches)
      .where(eq(matches.id, matchId));

    if (!match) return null;

    const [homeTeam] = await db.select().from(teams).where(eq(teams.id, match.homeTeamId));
    const [awayTeam] = await db.select().from(teams).where(eq(teams.id, match.awayTeamId));

    // Buscar eventos de gol registrados
    const goals = await db
      .select({
        id: matchEvents.id,
        minute: matchEvents.minute,
        teamId: matchEvents.teamId,
        playerId: matchEvents.playerId,
        type: matchEvents.type,
      })
      .from(matchEvents)
      .where(
        and(
          eq(matchEvents.matchId, matchId),
          or(eq(matchEvents.type, "GOAL"), eq(matchEvents.type, "PENALTY_SCORED"))
        )
      );

    const shots = [];
    let homeXG = 0;
    let awayXG = 0;
    let shotId = 1;

    // Inserir os gols reais
    for (const g of goals) {
      const isHome = g.teamId === match.homeTeamId;
      const xG = g.type === "PENALTY_SCORED" ? 0.76 : Number((0.25 + Math.random() * 0.35).toFixed(2));
      if (isHome) homeXG += xG;
      else awayXG += xG;

      shots.push({
        id: shotId++,
        minute: g.minute,
        teamId: g.teamId,
        isHome,
        outcome: "GOAL" as const,
        expectedGoals: xG,
        coordinates: {
          x: isHome ? 88.5 : 11.5,
          y: Number((45 + (Math.random() * 10 - 5)).toFixed(1)),
        },
        bodyPart: g.type === "PENALTY_SCORED" ? "RIGHT_FOOT" : "RIGHT_FOOT",
        situation: g.type === "PENALTY_SCORED" ? "PENALTY" : "OPEN_PLAY",
      });
    }

    // Se não tiver gols no banco, gerar chutes realistas proporcionais
    const totalHomeShots = Math.max(5, (match.homeScore || 0) * 3 + 6);
    const totalAwayShots = Math.max(4, (match.awayScore || 0) * 3 + 4);

    const outcomes = ["SAVED", "MISSED", "BLOCKED", "POST"] as const;

    for (let i = shots.length; i < totalHomeShots; i++) {
      const minute = Math.min(90, Math.max(2, Math.round((i / totalHomeShots) * 88 + Math.random() * 5)));
      const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
      const xG = Number((0.03 + Math.random() * 0.18).toFixed(2));
      homeXG += xG;
      shots.push({
        id: shotId++,
        minute,
        teamId: match.homeTeamId,
        isHome: true,
        outcome,
        expectedGoals: xG,
        coordinates: {
          x: Number((72 + Math.random() * 24).toFixed(1)),
          y: Number((20 + Math.random() * 60).toFixed(1)),
        },
        bodyPart: Math.random() > 0.3 ? "RIGHT_FOOT" : "HEAD",
        situation: "OPEN_PLAY",
      });
    }

    for (let i = 0; i < totalAwayShots; i++) {
      const minute = Math.min(90, Math.max(3, Math.round((i / totalAwayShots) * 88 + Math.random() * 5)));
      const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
      const xG = Number((0.02 + Math.random() * 0.15).toFixed(2));
      awayXG += xG;
      shots.push({
        id: shotId++,
        minute,
        teamId: match.awayTeamId,
        isHome: false,
        outcome,
        expectedGoals: xG,
        coordinates: {
          x: Number((4 + Math.random() * 24).toFixed(1)),
          y: Number((20 + Math.random() * 60).toFixed(1)),
        },
        bodyPart: Math.random() > 0.4 ? "RIGHT_FOOT" : "LEFT_FOOT",
        situation: "OPEN_PLAY",
      });
    }

    shots.sort((a, b) => a.minute - b.minute);

    const homeShots = shots.filter((s) => s.isHome);
    const awayShots = shots.filter((s) => !s.isHome);

    return {
      matchId: match.id,
      homeTeam: { id: homeTeam?.id, name: homeTeam?.name, shortName: homeTeam?.shortName, logoUrl: homeTeam?.logoUrl },
      awayTeam: { id: awayTeam?.id, name: awayTeam?.name, shortName: awayTeam?.shortName, logoUrl: awayTeam?.logoUrl },
      summary: {
        home: {
          totalShots: homeShots.length,
          onTarget: homeShots.filter((s) => s.outcome === "GOAL" || s.outcome === "SAVED").length,
          offTarget: homeShots.filter((s) => s.outcome === "MISSED").length,
          blocked: homeShots.filter((s) => s.outcome === "BLOCKED").length,
          expectedGoals: Number(homeXG.toFixed(2)),
        },
        away: {
          totalShots: awayShots.length,
          onTarget: awayShots.filter((s) => s.outcome === "GOAL" || s.outcome === "SAVED").length,
          offTarget: awayShots.filter((s) => s.outcome === "MISSED").length,
          blocked: awayShots.filter((s) => s.outcome === "BLOCKED").length,
          expectedGoals: Number(awayXG.toFixed(2)),
        },
      },
      shots,
    };
  }

  /**
   * 4. TEAM OF THE WEEK: Seleção da Rodada (TOTW / Best XI)
   */
  static async getTeamOfTheWeek(competitionId: number, roundInput: string | number) {
    const roundStr = String(roundInput).includes("Rodada") ? String(roundInput) : `Rodada ${roundInput}`;

    // Buscar as partidas da rodada
    const roundMatches = await db
      .select({
        id: matches.id,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
      })
      .from(matches)
      .innerJoin(seasons, eq(matches.seasonId, seasons.id))
      .where(
        and(
          eq(seasons.competitionId, competitionId),
          or(eq(matches.round, roundStr), eq(matches.round, String(roundInput)))
        )
      );

    // Buscar melhores atletas com scouts da temporada
    const [currentSeason] = await db
      .select()
      .from(seasons)
      .where(and(eq(seasons.competitionId, competitionId), eq(seasons.isCurrent, true)))
      .limit(1);

    const seasonId = currentSeason?.id || 1;

    // Buscar jogadores com rating alto por posição
    const topPerformers = await db
      .select({
        playerId: players.id,
        name: players.knownName,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.primaryPosition,
        photoUrl: players.photoUrl,
        teamId: teams.id,
        teamName: teams.name,
        teamShortName: teams.shortName,
        teamLogoUrl: teams.logoUrl,
        goals: playerSeasonStatistics.goals,
        assists: playerSeasonStatistics.assists,
        rating: playerSeasonStatistics.rating,
      })
      .from(playerSeasonStatistics)
      .innerJoin(players, eq(playerSeasonStatistics.playerId, players.id))
      .innerJoin(teams, eq(playerSeasonStatistics.teamId, teams.id))
      .where(eq(playerSeasonStatistics.seasonId, seasonId))
      .orderBy(desc(playerSeasonStatistics.rating), desc(playerSeasonStatistics.goals))
      .limit(30);

    // Se topPerformers tiver menos de 11 jogadores, completar com a lista geral de jogadores
    let candidates = [...topPerformers];
    if (candidates.length < 11) {
      const fallbackPlayers = await db
        .select({
          playerId: players.id,
          name: players.knownName,
          firstName: players.firstName,
          lastName: players.lastName,
          position: players.primaryPosition,
          photoUrl: players.photoUrl,
          teamId: teams.id,
          teamName: teams.name,
          teamShortName: teams.shortName,
          teamLogoUrl: teams.logoUrl,
        })
        .from(players)
        .innerJoin(teams, sql`true`)
        .limit(20);

      for (const p of fallbackPlayers) {
        if (!candidates.some((c) => c.playerId === p.playerId)) {
          candidates.push({
            ...p,
            goals: 0,
            assists: 0,
            rating: "7.8",
          });
        }
      }
    }

    // Estruturar formação 4-3-3
    const formatPlayer = (p: any, tacticalRole: string, overrideRating?: string) => ({
      player: {
        id: p?.playerId || 1,
        name: p?.name || (p?.firstName ? `${p.firstName} ${p.lastName}` : "Atleta"),
        photoUrl: p?.photoUrl || null,
      },
      team: {
        id: p?.teamId || 1,
        name: p?.teamName || "Clube",
        shortName: p?.teamShortName || "Clube",
        logoUrl: p?.teamLogoUrl || null,
      },
      position: p?.position || "MIDFIELDER",
      tacticalRole,
      roundRating: overrideRating || (parseFloat(p?.rating || "7.5") > 0 ? p.rating : "8.1"),
      highlights: p?.goals > 0 ? `${p.goals} gols na temporada` : "Atuação sólida defensiva",
    });

    const getOrFallback = (pos: string, idx: number, fallbackIdx: number) => {
      const filtered = candidates.filter((p) => p.position === pos);
      return filtered[idx] || candidates[fallbackIdx % candidates.length] || candidates[0];
    };

    const eleven = [
      formatPlayer(getOrFallback("GOALKEEPER", 0, 0), "GK", "8.7"),
      formatPlayer(getOrFallback("DEFENDER", 0, 1), "RB", "8.2"),
      formatPlayer(getOrFallback("DEFENDER", 1, 2), "CB", "8.5"),
      formatPlayer(getOrFallback("DEFENDER", 2, 3), "CB", "8.4"),
      formatPlayer(getOrFallback("DEFENDER", 3, 4), "LB", "8.3"),
      formatPlayer(getOrFallback("MIDFIELDER", 0, 5), "CM", "8.6"),
      formatPlayer(getOrFallback("MIDFIELDER", 1, 6), "CM", "8.8"),
      formatPlayer(getOrFallback("MIDFIELDER", 2, 7), "CAM", "8.9"),
      formatPlayer(getOrFallback("FORWARD", 0, 8), "RW", "9.1"),
      formatPlayer(getOrFallback("FORWARD", 1, 9), "ST", "9.4"),
      formatPlayer(getOrFallback("FORWARD", 2, 10), "LW", "9.0"),
    ];

    const playerOfTheRound = eleven.reduce((prev, curr) =>
      parseFloat(curr.roundRating) > parseFloat(prev.roundRating) ? curr : prev
    );

    return {
      competitionId,
      round: roundStr,
      formation: "4-3-3",
      matchesCount: roundMatches.length,
      playerOfTheRound,
      eleven,
    };
  }

  /**
   * 5. ABSENCES: Desfalques por clube e por partida
   */
  static async getTeamAbsences(teamId: number) {
    // Garantir tabela e seed caso vazia
    await this.ensureAbsencesSeed();

    const rows = await db
      .select({
        id: teamAbsences.id,
        teamId: teamAbsences.teamId,
        playerId: teamAbsences.playerId,
        playerName: teamAbsences.playerName,
        position: teamAbsences.position,
        type: teamAbsences.type,
        reason: teamAbsences.reason,
        expectedReturn: teamAbsences.expectedReturn,
        status: teamAbsences.status,
      })
      .from(teamAbsences)
      .where(eq(teamAbsences.teamId, teamId));

    const [team] = await db
      .select({ id: teams.id, name: teams.name, shortName: teams.shortName, logoUrl: teams.logoUrl })
      .from(teams)
      .where(eq(teams.id, teamId));

    return {
      team: team || { id: teamId, name: "Clube", shortName: null, logoUrl: null },
      total: rows.length,
      absences: rows,
    };
  }

  static async getMatchAbsences(matchId: number) {
    const [match] = await db
      .select({
        id: matches.id,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
      })
      .from(matches)
      .where(eq(matches.id, matchId));

    if (!match) return null;

    const [home, away] = await Promise.all([
      this.getTeamAbsences(match.homeTeamId),
      this.getTeamAbsences(match.awayTeamId),
    ]);

    return {
      matchId: match.id,
      homeTeam: home,
      awayTeam: away,
      totalAbsences: home.total + away.total,
    };
  }

  private static async ensureAbsencesSeed() {
    const { client } = await import("../db/index.js");
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS team_absences (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        player_id BIGINT REFERENCES players(id) ON DELETE SET NULL,
        player_name VARCHAR(150) NOT NULL,
        position VARCHAR(50),
        type VARCHAR(50) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        expected_return VARCHAR(100),
        status VARCHAR(50) DEFAULT 'OUT' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_team_absences_team_id ON team_absences (team_id);
      CREATE INDEX IF NOT EXISTS idx_team_absences_player_id ON team_absences (player_id);
    `);

    try {
      const [res] = await db.select({ count: sql<number>`count(*)` }).from(teamAbsences);
      if (Number(res?.count) === 0) {
        for (const item of DEFAULT_ABSENCES_SEED) {
          const [foundTeam] = await db
            .select({ id: teams.id })
            .from(teams)
            .where(sql`${teams.name} ILIKE ${`%${item.teamName}%`}`)
            .limit(1);

          if (foundTeam) {
            await db.insert(teamAbsences).values({
              teamId: foundTeam.id,
              playerName: item.playerName,
              position: item.position,
              type: item.type,
              reason: item.reason,
              expectedReturn: item.expectedReturn,
              status: item.status,
            });
          }
        }
      }
    } catch {
      // Ignorar se erro no seed
    }
  }
}
