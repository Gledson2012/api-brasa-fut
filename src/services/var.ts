/**
 * BrasaFut API - Central do VAR e Auditoria de Arbitragem
 * Serviço de rastreamento de revisões de vídeo, tempos de paralisação e Tabela do VAR Líquido
 */

export interface VarIncident {
  id: number;
  minute: number;
  extraMinute?: number;
  incidentType: "PENALTY" | "GOAL_OVERTURNED" | "GOAL_AWARDED" | "RED_CARD" | "OFFSIDE";
  benefitedTeamId?: number;
  benefitedTeamName?: string;
  penalizedTeamId?: number;
  penalizedTeamName?: string;
  onFieldDecision: string;
  varRecommendation: string;
  finalDecision: string;
  decisionOverturned: boolean;
  checkDurationSeconds: number;
  varRefereeName: string;
  audioTranscript: string;
}

export interface MatchVarReport {
  matchId: number;
  totalVarReviews: number;
  totalInterventionSeconds: number;
  decisionsOverturnedCount: number;
  incidents: VarIncident[];
}

export interface TeamVarStandingRow {
  position: number;
  teamId: number;
  teamName: string;
  acronym: string;
  logoUrl?: string;
  totalInterventions: number;
  favorableDecisions: number;
  unfavorableDecisions: number;
  netDecisionsBalance: number;
  goalsAwardedByVar: number;
  goalsCancelledByVar: number;
  penaltiesAwardedByVar: number;
  penaltiesCancelledByVar: number;
  redCardsGivenByVar: number;
  estimatedPointsImpact: number;
}

export class VarService {
  /**
   * Gera o relatório oficial de intervenções do VAR de uma partida
   */
  public static getMatchVarReport(matchId: number, homeTeamName: string, awayTeamName: string): MatchVarReport {
    // Seed determinístico baseado no ID da partida
    const seed = matchId;
    const hasVar = seed % 3 !== 0; // 66% das partidas têm pelo menos 1 lance de VAR

    if (!hasVar) {
      return {
        matchId,
        totalVarReviews: 0,
        totalInterventionSeconds: 0,
        decisionsOverturnedCount: 0,
        incidents: [],
      };
    }

    const incidents: VarIncident[] = [];
    const min1 = 28 + (seed % 15);
    const min2 = 74 + (seed % 12);

    incidents.push({
      id: 1,
      minute: min1,
      incidentType: seed % 2 === 0 ? "PENALTY" : "OFFSIDE",
      benefitedTeamName: homeTeamName,
      penalizedTeamName: awayTeamName,
      onFieldDecision: seed % 2 === 0 ? "Segue o jogo (não falta)" : "Gol assinalado em campo",
      varRecommendation: seed % 2 === 0
        ? "Recomendação de revisão na tela por toque faltoso na perna de apoio dentro da área"
        : "Linha traçada indicando atacante 12cm à frente no momento do passe",
      finalDecision: seed % 2 === 0 ? "Pênalti confirmado após revisão" : "Gol anulado por impedimento milimétrico",
      decisionOverturned: true,
      checkDurationSeconds: 110 + (seed % 40),
      varRefereeName: "Rodrigo D'Alonso Ferreira (FIFA/VAR)",
      audioTranscript:
        "VAR: 'Temos o contato claro da perna direita sem tocar na bola.' Árbitro de campo: 'Vi o contato aqui no monitor. Vou mudar a decisão para pênalti.'",
    });

    if (seed % 4 === 0) {
      incidents.push({
        id: 2,
        minute: min2,
        incidentType: "RED_CARD",
        benefitedTeamName: awayTeamName,
        penalizedTeamName: homeTeamName,
        onFieldDecision: "Cartão amarelo aplicado",
        varRecommendation: "Revisão por força excessiva com solado na altura da canela",
        finalDecision: "Cartão vermelho direto aplicado após revisão no monitor",
        decisionOverturned: true,
        checkDurationSeconds: 95,
        varRefereeName: "Daiane Muniz (FIFA/VAR)",
        audioTranscript:
          "VAR: 'Ponto de contato na canela com perna esticada e força excessiva.' Árbitro: 'Concordo, intensidade alta, retiro o amarelo e aplico o vermelho.'",
      });
    }

    const totalSeconds = incidents.reduce((acc, inc) => acc + inc.checkDurationSeconds, 0);
    const overturned = incidents.filter((i) => i.decisionOverturned).length;

    return {
      matchId,
      totalVarReviews: incidents.length,
      totalInterventionSeconds: totalSeconds,
      decisionsOverturnedCount: overturned,
      incidents,
    };
  }

  /**
   * Tabela do VAR Líquido para o Campeonato
   */
  public static getCompetitionVarTable(competitionId: number): {
    competitionId: number;
    seasonName: string;
    totalReviewsInCompetition: number;
    averageCheckTimeSeconds: number;
    mostFavoredTeam: string;
    mostPenalizedTeam: string;
    table: TeamVarStandingRow[];
  } {
    const clubs = [
      { id: 1, name: "Flamengo", acronym: "FLA", logo: "https://api.sofascore.app/api/v1/team/5981/image", fav: 7, unfav: 4, goalsPlus: 3, goalsMinus: 1, penPlus: 4, penMinus: 2, red: 1, pts: 4 },
      { id: 2, name: "Palmeiras", acronym: "PAL", logo: "https://api.sofascore.app/api/v1/team/1963/image", fav: 8, unfav: 3, goalsPlus: 4, goalsMinus: 1, penPlus: 3, penMinus: 1, red: 0, pts: 6 },
      { id: 3, name: "São Paulo", acronym: "SAO", logo: "https://api.sofascore.app/api/v1/team/1981/image", fav: 5, unfav: 6, goalsPlus: 2, goalsMinus: 3, penPlus: 2, penMinus: 3, red: 2, pts: -1 },
      { id: 4, name: "Corinthians", acronym: "COR", logo: "https://api.sofascore.app/api/v1/team/1957/image", fav: 6, unfav: 5, goalsPlus: 2, goalsMinus: 2, penPlus: 3, penMinus: 2, red: 1, pts: 2 },
      { id: 5, name: "Botafogo", acronym: "BOT", logo: "https://api.sofascore.app/api/v1/team/1958/image", fav: 9, unfav: 4, goalsPlus: 5, goalsMinus: 2, penPlus: 4, penMinus: 1, red: 0, pts: 7 },
      { id: 6, name: "Fluminense", acronym: "FLU", logo: "https://api.sofascore.app/api/v1/team/1961/image", fav: 4, unfav: 7, goalsPlus: 1, goalsMinus: 4, penPlus: 2, penMinus: 3, red: 2, pts: -4 },
      { id: 7, name: "Vasco da Gama", acronym: "VAS", logo: "https://api.sofascore.app/api/v1/team/1974/image", fav: 3, unfav: 8, goalsPlus: 1, goalsMinus: 5, penPlus: 1, penMinus: 4, red: 3, pts: -5 },
      { id: 8, name: "Atlético-MG", acronym: "CAM", logo: "https://api.sofascore.app/api/v1/team/1977/image", fav: 6, unfav: 6, goalsPlus: 3, goalsMinus: 3, penPlus: 2, penMinus: 2, red: 1, pts: 0 },
      { id: 9, name: "Cruzeiro", acronym: "CRU", logo: "https://api.sofascore.app/api/v1/team/1954/image", fav: 5, unfav: 5, goalsPlus: 2, goalsMinus: 2, penPlus: 2, penMinus: 2, red: 1, pts: 1 },
      { id: 10, name: "Internacional", acronym: "INT", logo: "https://api.sofascore.app/api/v1/team/1966/image", fav: 7, unfav: 5, goalsPlus: 3, goalsMinus: 2, penPlus: 3, penMinus: 2, red: 1, pts: 3 },
    ];

    const sorted = clubs.sort((a, b) => (b.fav - b.unfav) - (a.fav - a.unfav));

    const rows: TeamVarStandingRow[] = sorted.map((c, idx) => ({
      position: idx + 1,
      teamId: c.id,
      teamName: c.name,
      acronym: c.acronym,
      logoUrl: c.logo,
      totalInterventions: c.fav + c.unfav,
      favorableDecisions: c.fav,
      unfavorableDecisions: c.unfav,
      netDecisionsBalance: c.fav - c.unfav,
      goalsAwardedByVar: c.goalsPlus,
      goalsCancelledByVar: c.goalsMinus,
      penaltiesAwardedByVar: c.penPlus,
      penaltiesCancelledByVar: c.penMinus,
      redCardsGivenByVar: c.red,
      estimatedPointsImpact: c.pts,
    }));

    return {
      competitionId,
      seasonName: "2026",
      totalReviewsInCompetition: rows.reduce((a, r) => a + r.totalInterventions, 0) / 2,
      averageCheckTimeSeconds: 112,
      mostFavoredTeam: rows[0].teamName,
      mostPenalizedTeam: rows[rows.length - 1].teamName,
      table: rows,
    };
  }
}
