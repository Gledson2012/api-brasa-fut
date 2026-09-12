/**
 * BrasaFut API - Odds & Value Bets Engine
 * Motor estatístico de cotações, mercados de apostas e identificador de valor esperado positivo (EV+)
 */

export interface MarketOdds {
  home: number;
  draw: number;
  away: number;
}

export interface OverUnderOdds {
  over15: number;
  under15: number;
  over25: number;
  under25: number;
}

export interface BothTeamsScoreOdds {
  yes: number;
  no: number;
}

export interface DoubleChanceOdds {
  homeOrDraw: number;
  homeOrAway: number;
  drawOrAway: number;
}

export interface BookmakerOdds {
  bookmaker: string;
  payoutPct: number;
  market1X2: MarketOdds;
  overUnder: OverUnderOdds;
  bothTeamsScore: BothTeamsScoreOdds;
  doubleChance: DoubleChanceOdds;
}

export interface MatchOddsResult {
  matchId: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  fairOdds: {
    market1X2: MarketOdds;
    overUnder25: { over: number; under: number };
    bothTeamsScore: BothTeamsScoreOdds;
  };
  consensusOdds: {
    market1X2: MarketOdds;
    overUnder25: { over: number; under: number };
    bothTeamsScore: BothTeamsScoreOdds;
  };
  bookmakers: BookmakerOdds[];
}

export interface ValueBet {
  matchId: number;
  match: string;
  market: string;
  selection: string;
  bookmaker: string;
  offeredOdd: number;
  fairOdd: number;
  modelProbabilityPct: number;
  impliedProbabilityPct: number;
  expectedValuePct: number;
  edgePct: number;
  recommendation: string;
}

export class OddsService {
  /**
   * Calcula as probabilidades reais baseadas em seed ou histórico
   */
  public static getMatchProbabilities(homeTeamId: number, awayTeamId: number, matchId: number = 1) {
    const seed = (homeTeamId * 73 + awayTeamId * 31 + matchId * 17) % 100;
    
    // Probabilidade base: vantagem em casa
    let pHome = 0.44 + (seed % 15) / 100;
    let pDraw = 0.27 + ((seed * 3) % 8) / 100;
    let pAway = 1 - pHome - pDraw;

    if (pAway < 0.15) {
      pAway = 0.18;
      pHome = 1 - pDraw - pAway;
    }

    const pOver25 = 0.48 + ((seed * 7) % 12) / 100;
    const pUnder25 = 1 - pOver25;

    const pBtts = 0.51 + ((seed * 5) % 10) / 100;
    const pBttsNo = 1 - pBtts;

    return {
      pHome: Number(pHome.toFixed(3)),
      pDraw: Number(pDraw.toFixed(3)),
      pAway: Number(pAway.toFixed(3)),
      pOver25: Number(pOver25.toFixed(3)),
      pUnder25: Number(pUnder25.toFixed(3)),
      pBtts: Number(pBtts.toFixed(3)),
      pBttsNo: Number(pBttsNo.toFixed(3)),
    };
  }

  /**
   * Converte probabilidades em Fair Odds (Odds justas sem margem)
   */
  public static calculateFairOdds(probs: ReturnType<typeof OddsService.getMatchProbabilities>) {
    return {
      market1X2: {
        home: Number((1 / probs.pHome).toFixed(2)),
        draw: Number((1 / probs.pDraw).toFixed(2)),
        away: Number((1 / probs.pAway).toFixed(2)),
      },
      overUnder25: {
        over: Number((1 / probs.pOver25).toFixed(2)),
        under: Number((1 / probs.pUnder25).toFixed(2)),
      },
      bothTeamsScore: {
        yes: Number((1 / probs.pBtts).toFixed(2)),
        no: Number((1 / probs.pBttsNo).toFixed(2)),
      },
    };
  }

  /**
   * Aplica a margem da casa de apostas (vig de 4% a 8%)
   */
  private static applyMargin(odd: number, marginPct: number): number {
    return Number((odd / (1 + marginPct / 100)).toFixed(2));
  }

  /**
   * Retorna as cotações completas de uma partida
   */
  public static getOddsForMatch(match: {
    id: number;
    homeTeam: { id: number; name: string };
    awayTeam: { id: number; name: string };
  }): MatchOddsResult {
    const probs = this.getMatchProbabilities(match.homeTeam.id, match.awayTeam.id, match.id);
    const fairOdds = this.calculateFairOdds(probs);

    const bookmakersConfigs = [
      { name: "Bet365", margin: 6.5, factorHome: 1.01, factorDraw: 0.99, factorAway: 1.0 },
      { name: "Betano", margin: 5.5, factorHome: 0.99, factorDraw: 1.02, factorAway: 1.01 },
      { name: "Betfair", margin: 4.8, factorHome: 1.02, factorDraw: 0.98, factorAway: 1.02 },
    ];

    const bookmakers: BookmakerOdds[] = bookmakersConfigs.map((b) => {
      const homeOdd = Number((this.applyMargin(fairOdds.market1X2.home, b.margin) * b.factorHome).toFixed(2));
      const drawOdd = Number((this.applyMargin(fairOdds.market1X2.draw, b.margin) * b.factorDraw).toFixed(2));
      const awayOdd = Number((this.applyMargin(fairOdds.market1X2.away, b.margin) * b.factorAway).toFixed(2));

      const over25 = Number((this.applyMargin(fairOdds.overUnder25.over, b.margin)).toFixed(2));
      const under25 = Number((this.applyMargin(fairOdds.overUnder25.under, b.margin)).toFixed(2));

      const bttsYes = Number((this.applyMargin(fairOdds.bothTeamsScore.yes, b.margin)).toFixed(2));
      const bttsNo = Number((this.applyMargin(fairOdds.bothTeamsScore.no, b.margin)).toFixed(2));

      const dc1X = Number((1 / (probs.pHome + probs.pDraw) * 0.94).toFixed(2));
      const dc12 = Number((1 / (probs.pHome + probs.pAway) * 0.94).toFixed(2));
      const dcX2 = Number((1 / (probs.pDraw + probs.pAway) * 0.94).toFixed(2));

      return {
        bookmaker: b.name,
        payoutPct: Number((100 - b.margin).toFixed(1)),
        market1X2: { home: homeOdd, draw: drawOdd, away: awayOdd },
        overUnder: {
          over15: Number((over25 * 0.75).toFixed(2)),
          under15: Number((under25 * 1.35).toFixed(2)),
          over25,
          under25,
        },
        bothTeamsScore: { yes: bttsYes, no: bttsNo },
        doubleChance: { homeOrDraw: dc1X, homeOrAway: dc12, drawOrAway: dcX2 },
      };
    });

    const consensusOdds = {
      market1X2: {
        home: Number(((bookmakers[0].market1X2.home + bookmakers[1].market1X2.home + bookmakers[2].market1X2.home) / 3).toFixed(2)),
        draw: Number(((bookmakers[0].market1X2.draw + bookmakers[1].market1X2.draw + bookmakers[2].market1X2.draw) / 3).toFixed(2)),
        away: Number(((bookmakers[0].market1X2.away + bookmakers[1].market1X2.away + bookmakers[2].market1X2.away) / 3).toFixed(2)),
      },
      overUnder25: {
        over: Number(((bookmakers[0].overUnder.over25 + bookmakers[1].overUnder.over25 + bookmakers[2].overUnder.over25) / 3).toFixed(2)),
        under: Number(((bookmakers[0].overUnder.under25 + bookmakers[1].overUnder.under25 + bookmakers[2].overUnder.under25) / 3).toFixed(2)),
      },
      bothTeamsScore: {
        yes: Number(((bookmakers[0].bothTeamsScore.yes + bookmakers[1].bothTeamsScore.yes + bookmakers[2].bothTeamsScore.yes) / 3).toFixed(2)),
        no: Number(((bookmakers[0].bothTeamsScore.no + bookmakers[1].bothTeamsScore.no + bookmakers[2].bothTeamsScore.no) / 3).toFixed(2)),
      },
    };

    return {
      matchId: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      fairOdds,
      consensusOdds,
      bookmakers,
    };
  }

  /**
   * Varre partidas e encontra apostas de valor esperado positivo (Value Bets)
   */
  public static findValueBets(matchesList: Array<{
    id: number;
    homeTeam: { id: number; name: string };
    awayTeam: { id: number; name: string };
  }>): ValueBet[] {
    const valueBets: ValueBet[] = [];

    for (const m of matchesList) {
      const oddsData = this.getOddsForMatch(m);
      const probs = this.getMatchProbabilities(m.homeTeam.id, m.awayTeam.id, m.id);

      for (const bm of oddsData.bookmakers) {
        // Checar Home Win
        const evHome = ((bm.market1X2.home * probs.pHome) - 1) * 100;
        if (evHome > 3.0) {
          valueBets.push({
            matchId: m.id,
            match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
            market: "1X2 (Resultado Final)",
            selection: `Vitória ${m.homeTeam.name}`,
            bookmaker: bm.bookmaker,
            offeredOdd: bm.market1X2.home,
            fairOdd: oddsData.fairOdds.market1X2.home,
            modelProbabilityPct: Number((probs.pHome * 100).toFixed(1)),
            impliedProbabilityPct: Number(((1 / bm.market1X2.home) * 100).toFixed(1)),
            expectedValuePct: Number(evHome.toFixed(2)),
            edgePct: Number((probs.pHome * 100 - (1 / bm.market1X2.home) * 100).toFixed(1)),
            recommendation: `Odd desregulada na ${bm.bookmaker} com ${evHome.toFixed(1)}% de valor esperado positivo (EV+)`,
          });
        }

        // Checar Over 2.5
        const evOver = ((bm.overUnder.over25 * probs.pOver25) - 1) * 100;
        if (evOver > 3.5) {
          valueBets.push({
            matchId: m.id,
            match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
            market: "Total de Gols",
            selection: "Mais de 2.5 Gols (Over 2.5)",
            bookmaker: bm.bookmaker,
            offeredOdd: bm.overUnder.over25,
            fairOdd: oddsData.fairOdds.overUnder25.over,
            modelProbabilityPct: Number((probs.pOver25 * 100).toFixed(1)),
            impliedProbabilityPct: Number(((1 / bm.overUnder.over25) * 100).toFixed(1)),
            expectedValuePct: Number(evOver.toFixed(2)),
            edgePct: Number((probs.pOver25 * 100 - (1 / bm.overUnder.over25) * 100).toFixed(1)),
            recommendation: `Excelente probabilidade de gols com ${evOver.toFixed(1)}% de EV+ na ${bm.bookmaker}`,
          });
        }
      }
    }

    return valueBets.sort((a, b) => b.expectedValuePct - a.expectedValuePct);
  }
}
