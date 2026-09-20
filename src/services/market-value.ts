/**
 * BrasaFut API - Market Value & Contracts Engine (Transfermarkt Style)
 * Motor de avaliação financeira de atletas, valor de mercado, contratos e cláusulas rescisórias
 */

export interface HistoricalValuePoint {
  date: string;
  marketValueEur: number; // Em milhões de euros
  marketValueBrl: number; // Em milhões de reais
  clubName: string;
}

export interface PlayerMarketValueProfile {
  playerId: number;
  playerName: string;
  age: number;
  position: string;
  currentClub: string;
  marketValueEur: number; // Ex: 45.0 (45 milhões de euros)
  marketValueBrl: number; // Ex: 270.0 (270 milhões de reais)
  peakMarketValueEur: number;
  peakDate: string;
  contractUntil: string;
  releaseClauseDomesticBrl: number; // Multa para clubes do Brasil em R$ milhões
  releaseClauseInternationalEur: number; // Multa rescisória internacional em € milhões
  trend: "RISING" | "STABLE" | "DECLINING";
  trendPercentage12Months: number;
  historicalValuation: HistoricalValuePoint[];
}

export class MarketValueService {
  private static EUR_TO_BRL = 6.0;

  /**
   * Obtém a avaliação financeira completa de um atleta
   */
  public static getPlayerValuation(player: {
    id: number;
    name: string;
    position: string;
    age?: number;
    clubName?: string;
  }): PlayerMarketValueProfile {
    const pId = player.id;
    const age = player.age || 23;
    const club = player.clubName || "Flamengo";

    // Algoritmo determinístico baseado no ID do atleta para consistência nos testes e na API
    const baseValueEur = 5 + (pId * 7.3) % 45;
    const roundedEur = Number(baseValueEur.toFixed(1));
    const roundedBrl = Number((roundedEur * this.EUR_TO_BRL).toFixed(1));
    const peakEur = Number((roundedEur * 1.25).toFixed(1));

    const trend = roundedEur > 25 ? "RISING" : roundedEur > 12 ? "STABLE" : "DECLINING";
    const trendPct = trend === "RISING" ? 35.5 : trend === "STABLE" ? 4.2 : -12.0;

    return {
      playerId: pId,
      playerName: player.name,
      age,
      position: player.position,
      currentClub: club,
      marketValueEur: roundedEur,
      marketValueBrl: roundedBrl,
      peakMarketValueEur: peakEur,
      peakDate: "2025-12-15",
      contractUntil: "2028-12-31",
      releaseClauseDomesticBrl: Number((roundedBrl * 2.5).toFixed(1)),
      releaseClauseInternationalEur: Number((roundedEur * 2.0).toFixed(1)),
      trend,
      trendPercentage12Months: trendPct,
      historicalValuation: [
        { date: "2023-01-01", marketValueEur: Number((roundedEur * 0.4).toFixed(1)), marketValueBrl: Number((roundedEur * 0.4 * this.EUR_TO_BRL).toFixed(1)), clubName: club },
        { date: "2024-01-01", marketValueEur: Number((roundedEur * 0.65).toFixed(1)), marketValueBrl: Number((roundedEur * 0.65 * this.EUR_TO_BRL).toFixed(1)), clubName: club },
        { date: "2025-01-01", marketValueEur: Number((roundedEur * 0.85).toFixed(1)), marketValueBrl: Number((roundedEur * 0.85 * this.EUR_TO_BRL).toFixed(1)), clubName: club },
        { date: "2026-01-01", marketValueEur: roundedEur, marketValueBrl: roundedBrl, clubName: club },
      ],
    };
  }

  /**
   * Ranking dos atletas mais valiosos do campeonato
   */
  public static getValuationRanking(limit: number = 20) {
    const samplePlayers = [
      { id: 1, name: "Estêvão", position: "FORWARD", age: 18, clubName: "Palmeiras", eur: 60.0 },
      { id: 2, name: "Pedro", position: "FORWARD", age: 27, clubName: "Flamengo", eur: 35.0 },
      { id: 3, name: "Gerson", position: "MIDFIELDER", age: 27, clubName: "Flamengo", eur: 28.0 },
      { id: 4, name: "Raphael Veiga", position: "MIDFIELDER", age: 29, clubName: "Palmeiras", eur: 22.0 },
      { id: 5, name: "Nicolás De La Cruz", position: "MIDFIELDER", age: 27, clubName: "Flamengo", eur: 20.0 },
      { id: 6, name: "Luiz Henrique", position: "FORWARD", age: 24, clubName: "Botafogo", eur: 25.0 },
      { id: 7, name: "Thiago Almada", position: "MIDFIELDER", age: 23, clubName: "Botafogo", eur: 30.0 },
      { id: 8, name: "Léo Ortiz", position: "DEFENDER", age: 28, clubName: "Flamengo", eur: 15.0 },
      { id: 9, name: "Gustavo Gómez", position: "DEFENDER", age: 31, clubName: "Palmeiras", eur: 12.0 },
      { id: 10, name: "Agustín Rossi", position: "GOALKEEPER", age: 29, clubName: "Flamengo", eur: 10.0 },
    ];

    const ranking = samplePlayers.map((p, idx) => ({
      rank: idx + 1,
      playerId: p.id,
      playerName: p.name,
      position: p.position,
      age: p.age,
      clubName: p.clubName,
      marketValueEurMillions: p.eur,
      marketValueBrlMillions: Number((p.eur * this.EUR_TO_BRL).toFixed(1)),
      trend: idx < 3 ? ("RISING" as const) : ("STABLE" as const),
    }));

    return ranking.slice(0, limit);
  }
}
