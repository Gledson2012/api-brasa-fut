/**
 * BrasaFut API - Scouting & Wonderkids Service
 * Central de inteligência de mercado, relatórios de olheiros e radar de jovens promessas (Estilo FM / StatsBomb)
 */

export interface PlayerScoutingReport {
  playerId: number;
  playerName: string;
  age: number;
  position: string;
  team: {
    id: number;
    name: string;
  };
  overallRating: number;   // 0 a 100
  potentialRating: number; // 0 a 100 (potencial máximo)
  estimatedTransferValueEur: number;
  similarPlaystyle: string;
  attributes: {
    pace: number;         // Velocidade / Aceleração
    shooting: number;     // Finalização / Chute
    passing: number;      // Passe / Visão de Jogo
    dribbling: number;    // Drible / Condução
    defending: number;    // Desarme / Marcação
    physical: number;     // Força / Resistência
    tacticalIQ: number;   // Tomada de Decisão / Posicionamento
  };
  scoutVerdict: {
    strengths: string[];
    weaknesses: string[];
    recommendation: "CONTRATAÇÃO_IMEDIATA" | "MONITORAR_DESENVOLVIMENTO" | "EMPRESTAR_PARA_RODAGEM";
    summary: string;
  };
}

export class ScoutingService {
  /**
   * Gera o relatório de olheiro detalhado para um atleta
   */
  public static getPlayerReport(player: {
    id: number;
    name: string;
    position?: string | null;
    birthDate?: string | null;
    teamId?: number | null;
    teamName?: string;
  }): PlayerScoutingReport {
    const seed = player.id;
    const pos = (player.position || "FORWARD").toUpperCase();

    // Calcular idade aproximada (ou simular 18-22 para wonderkids)
    let age = 20;
    if (player.birthDate) {
      const birthYear = new Date(player.birthDate).getFullYear();
      if (!isNaN(birthYear)) {
        age = Math.max(17, Math.min(36, 2026 - birthYear));
      }
    } else {
      age = 18 + (seed % 6);
    }

    let pace = 75;
    let shooting = 70;
    let passing = 72;
    let dribbling = 76;
    let defending = 55;
    let physical = 72;
    let tacticalIQ = 74;
    let similar = "Rodrygo Goes";

    if (pos.includes("FORWARD") || pos.includes("ATA")) {
      pace = 88;
      shooting = 84;
      passing = 74;
      dribbling = 87;
      defending = 38;
      physical = 76;
      tacticalIQ = 80;
      similar = seed % 2 === 0 ? "Vinícius Júnior" : "Endrick";
    } else if (pos.includes("MIDFIELDER") || pos.includes("MEI")) {
      pace = 76;
      shooting = 75;
      passing = 89;
      dribbling = 82;
      defending = 68;
      physical = 74;
      tacticalIQ = 86;
      similar = "Lucas Paquetá";
    } else if (pos.includes("DEFENDER") || pos.includes("ZAG") || pos.includes("LATERAL")) {
      pace = 82;
      shooting = 50;
      passing = 75;
      dribbling = 72;
      defending = 86;
      physical = 85;
      tacticalIQ = 82;
      similar = "Éder Militão";
    } else {
      // Goleiro
      pace = 55;
      shooting = 25;
      passing = 78;
      dribbling = 45;
      defending = 88;
      physical = 84;
      tacticalIQ = 85;
      similar = "Alisson Becker";
    }

    const overall = Math.round((pace + shooting + passing + dribbling + defending + physical + tacticalIQ) / 7);
    const potential = Math.min(96, overall + (age <= 21 ? 12 : 5));
    const marketValue = age <= 21 ? (potential * 450000) : (overall * 200000);

    return {
      playerId: player.id,
      playerName: player.name,
      age,
      position: pos,
      team: {
        id: player.teamId || 1,
        name: player.teamName || "Clube Brasileiro",
      },
      overallRating: overall,
      potentialRating: potential,
      estimatedTransferValueEur: marketValue,
      similarPlaystyle: similar,
      attributes: {
        pace,
        shooting,
        passing,
        dribbling,
        defending,
        physical,
        tacticalIQ,
      },
      scoutVerdict: {
        strengths: [
          "Excelente tomada de decisão sob pressão",
          "Aceleração explosiva no primeiro terço de arrancada",
          "Versatilidade para atuar em múltiplas funções táticas",
        ],
        weaknesses: [
          "Pode aprimorar o uso da perna não-dominante",
          "Falta de maturação física para disputa aérea contínua",
        ],
        recommendation: potential >= 88 ? "CONTRATAÇÃO_IMEDIATA" : "MONITORAR_DESENVOLVIMENTO",
        summary: `Atleta com curva de desenvolvimento acima da média no futebol sul-americano. Perfil compatível com o futebol moderno europeu de transição rápida.`,
      },
    };
  }
}
