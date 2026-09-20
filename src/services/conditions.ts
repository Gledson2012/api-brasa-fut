/**
 * BrasaFut API - Match Weather, Pitch Intel & Altitude Conditions
 * Condições climáticas no estádio, aerodinâmica da bola e análise física de altitude
 */

export interface MatchConditionsResult {
  matchId: number;
  matchTitle: string;
  kickoffTime: string;
  venue: {
    name: string;
    city: string;
    state: string;
    country: string;
    altitudeMeters: number;
    altitudeCategory: "NIVEL_DO_MAR" | "BAIXA_ALTITUDE" | "MEDIA_ALTITUDE" | "ALTA_ALTITUDE";
  };
  pitch: {
    surfaceType: "NATURAL_BERMUDA" | "SINTETICO_FIFA_PRO" | "HIBRIDO_REFORCADO";
    surfaceName: string;
    dimensions: string;
    drainageQuality: "EXCELENTE" | "BOA" | "REGULAR";
    ballRollSpeed: "RAPIDO" | "PADRAO" | "LENTO";
  };
  weather: {
    temperatureCelsius: number;
    feelsLikeCelsius: number;
    condition: "ENSOLARADO" | "PARCIALMENTE_NUBLADO" | "NUBLADO" | "CHUVA_FRACA" | "TEMPESTADE";
    conditionDescription: string;
    humidityPercentage: number;
    precipitationProbabilityPct: number;
    windSpeedKmh: number;
    windDirection: string;
    airPressureHpa: number;
  };
  intelAnalysis: {
    fatigueRisk: "BAIXO" | "MODERADO" | "ALTO" | "CRITICO";
    ballTrajectoryBehavior: string;
    tacticalImplications: string;
  };
}

export class ConditionsService {
  public static getMatchConditions(
    matchId: number,
    homeTeamName: string = "Flamengo",
    awayTeamName: string = "Palmeiras",
    venueName: string = "Maracanã",
    city: string = "Rio de Janeiro"
  ): MatchConditionsResult {
    // Altitude check
    const isCuritiba = city.toLowerCase().includes("curitiba");
    const isSaoPaulo = city.toLowerCase().includes("são paulo") || city.toLowerCase().includes("sao paulo");
    const isBeloHorizonte = city.toLowerCase().includes("belo horizonte");
    const isQuito = city.toLowerCase().includes("quito");
    const isLaPaz = city.toLowerCase().includes("la paz");

    let altitude = 15;
    let altitudeCategory: MatchConditionsResult["venue"]["altitudeCategory"] = "NIVEL_DO_MAR";

    if (isLaPaz) {
      altitude = 3640;
      altitudeCategory = "ALTA_ALTITUDE";
    } else if (isQuito) {
      altitude = 2850;
      altitudeCategory = "ALTA_ALTITUDE";
    } else if (isBeloHorizonte) {
      altitude = 850;
      altitudeCategory = "BAIXA_ALTITUDE";
    } else if (isSaoPaulo || isCuritiba) {
      altitude = 760;
      altitudeCategory = "BAIXA_ALTITUDE";
    }

    const isSynthetic = venueName.toLowerCase().includes("allianz") || venueName.toLowerCase().includes("ligga") || venueName.toLowerCase().includes("engenhao") || venueName.toLowerCase().includes("nilton santos");

    // Weather deterministic based on matchId
    const temp = 22 + (matchId * 3) % 11;
    const humidity = 55 + (matchId * 7) % 35;
    const wind = 8 + (matchId * 4) % 18;

    return {
      matchId,
      matchTitle: `${homeTeamName} vs ${awayTeamName}`,
      kickoffTime: "2026-09-20T16:00:00-03:00",
      venue: {
        name: venueName,
        city,
        state: "RJ",
        country: "Brasil",
        altitudeMeters: altitude,
        altitudeCategory,
      },
      pitch: {
        surfaceType: isSynthetic ? "SINTETICO_FIFA_PRO" : "NATURAL_BERMUDA",
        surfaceName: isSynthetic ? "Grama Sintética FIFA Quality Pro (Sistema ShockPad)" : "Grama Natural Bermuda Celebration",
        dimensions: "105m x 68m (Padrão Oficial FIFA)",
        drainageQuality: "EXCELENTE",
        ballRollSpeed: isSynthetic ? "RAPIDO" : "PADRAO",
      },
      weather: {
        temperatureCelsius: temp,
        feelsLikeCelsius: temp + (humidity > 70 ? 2 : 0),
        condition: humidity > 80 ? "CHUVA_FRACA" : temp > 28 ? "ENSOLARADO" : "PARCIALMENTE_NUBLADO",
        conditionDescription: humidity > 80 ? "Chuva fina intermitente com gramado molhado" : "Tempo aberto com boa visibilidade",
        humidityPercentage: humidity,
        precipitationProbabilityPct: humidity > 80 ? 75 : 15,
        windSpeedKmh: wind,
        windDirection: "Sudeste (SE)",
        airPressureHpa: 1014,
      },
      intelAnalysis: {
        fatigueRisk: altitude > 2500 ? "CRITICO" : temp > 30 ? "ALTO" : "MODERADO",
        ballTrajectoryBehavior:
          altitude > 2500
            ? "O ar rarefeito reduz o atrito e o efeito Magnus; finalizações e cruzamentos ganham até 18% a mais de velocidade com menor curva."
            : isSynthetic
            ? "O quique no gramado sintético é mais vivo e veloz; passes rasteiros mantêm aceleração contínua."
            : "Comportamento aerodinâmico padrão e aderência ideal da bola.",
        tacticalImplications:
          altitude > 2500
            ? "Recomenda-se bloco de marcação mais baixo para poupar fôlego nos 30 minutos finais e incentivo a chutes de média e longa distância."
            : isSynthetic
            ? "Favorece equipes de posse rápida e toque de primeira; exige calçados com travas específicas para grama artificial."
            : "Condições ideais para ritmo dinâmico de transições e duelos físicos intensos.",
      },
    };
  }
}
