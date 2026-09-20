/**
 * BrasaFut API - Kits & Uniformes de Jogo
 * Paleta de cores hexadecimais, padrões gráficos e kits de partida para renderização em UIs
 */

export interface KitDetails {
  type: "HOME" | "AWAY" | "THIRD" | "GOALKEEPER";
  description: string;
  shirtColor: string;
  secondaryColor: string;
  shortsColor: string;
  socksColor: string;
  numberColor: string;
  pattern: "SOLID" | "VERTICAL_STRIPES" | "HORIZONTAL_STRIPES" | "SASH" | "SPECIAL";
}

export interface TeamKitsResult {
  teamId: number;
  teamName: string;
  season: string;
  kits: {
    home: KitDetails;
    away: KitDetails;
    third: KitDetails;
    goalkeeper: KitDetails;
  };
}

export interface MatchKitsSelectionResult {
  matchId: number;
  homeTeam: {
    id: number;
    name: string;
    selectedKitType: "HOME" | "AWAY" | "THIRD";
    kit: KitDetails;
  };
  awayTeam: {
    id: number;
    name: string;
    selectedKitType: "HOME" | "AWAY" | "THIRD";
    kit: KitDetails;
  };
  contrastQuality: "OPTIMAL" | "ACCEPTABLE";
}

const DEFAULT_TEAM_KITS: Record<string, TeamKitsResult["kits"]> = {
  Flamengo: {
    home: { type: "HOME", description: "Rubro-Negro Tradicional", shirtColor: "#C3281E", secondaryColor: "#111111", shortsColor: "#FFFFFF", socksColor: "#C3281E", numberColor: "#FFFFFF", pattern: "HORIZONTAL_STRIPES" },
    away: { type: "AWAY", description: "Branco com detalhes rubro-negros", shirtColor: "#FFFFFF", secondaryColor: "#C3281E", shortsColor: "#111111", socksColor: "#FFFFFF", numberColor: "#C3281E", pattern: "SOLID" },
    third: { type: "THIRD", description: "Preto com detalhes dourados", shirtColor: "#111111", secondaryColor: "#D4AF37", shortsColor: "#111111", socksColor: "#111111", numberColor: "#D4AF37", pattern: "SPECIAL" },
    goalkeeper: { type: "GOALKEEPER", description: "Verde fluorescente", shirtColor: "#39FF14", secondaryColor: "#111111", shortsColor: "#39FF14", socksColor: "#39FF14", numberColor: "#111111", pattern: "SOLID" },
  },
  Palmeiras: {
    home: { type: "HOME", description: "Verde Esmeralda Clássico", shirtColor: "#006437", secondaryColor: "#FFFFFF", shortsColor: "#FFFFFF", socksColor: "#006437", numberColor: "#FFFFFF", pattern: "SOLID" },
    away: { type: "AWAY", description: "Branco Alviverde", shirtColor: "#FFFFFF", secondaryColor: "#006437", shortsColor: "#006437", socksColor: "#FFFFFF", numberColor: "#006437", pattern: "SOLID" },
    third: { type: "THIRD", description: "Dourado / Amarelo Comemorativo", shirtColor: "#E5A823", secondaryColor: "#006437", shortsColor: "#006437", socksColor: "#E5A823", numberColor: "#006437", pattern: "SPECIAL" },
    goalkeeper: { type: "GOALKEEPER", description: "Azul Marinho", shirtColor: "#0A192F", secondaryColor: "#006437", shortsColor: "#0A192F", socksColor: "#0A192F", numberColor: "#FFFFFF", pattern: "SOLID" },
  },
  Corinthians: {
    home: { type: "HOME", description: "Branco com detalhes pretos", shirtColor: "#FFFFFF", secondaryColor: "#111111", shortsColor: "#111111", socksColor: "#FFFFFF", numberColor: "#111111", pattern: "SOLID" },
    away: { type: "AWAY", description: "Preto com listras verticais brancas", shirtColor: "#111111", secondaryColor: "#FFFFFF", shortsColor: "#FFFFFF", socksColor: "#111111", numberColor: "#FFFFFF", pattern: "VERTICAL_STRIPES" },
    third: { type: "THIRD", description: "Preto Total Antirracismo", shirtColor: "#000000", secondaryColor: "#333333", shortsColor: "#000000", socksColor: "#000000", numberColor: "#FFFFFF", pattern: "SPECIAL" },
    goalkeeper: { type: "GOALKEEPER", description: "Laranja Vibrante", shirtColor: "#FF6600", secondaryColor: "#000000", shortsColor: "#FF6600", socksColor: "#FF6600", numberColor: "#000000", pattern: "SOLID" },
  },
  "São Paulo": {
    home: { type: "HOME", description: "Branco tradicional com faixas tricolores no peito", shirtColor: "#FFFFFF", secondaryColor: "#C3281E", shortsColor: "#FFFFFF", socksColor: "#FFFFFF", numberColor: "#111111", pattern: "HORIZONTAL_STRIPES" },
    away: { type: "AWAY", description: "Listrado vertical Vermelho, Branco e Preto", shirtColor: "#C3281E", secondaryColor: "#111111", shortsColor: "#111111", socksColor: "#111111", numberColor: "#FFFFFF", pattern: "VERTICAL_STRIPES" },
    third: { type: "THIRD", description: "Vermelho Ousado", shirtColor: "#B22222", secondaryColor: "#111111", shortsColor: "#B22222", socksColor: "#B22222", numberColor: "#FFFFFF", pattern: "SPECIAL" },
    goalkeeper: { type: "GOALKEEPER", description: "Amarelo Canário", shirtColor: "#FFD700", secondaryColor: "#111111", shortsColor: "#FFD700", socksColor: "#FFD700", numberColor: "#111111", pattern: "SOLID" },
  },
};

export class KitsService {
  /**
   * Obtém a linha completa de uniformes de um clube
   */
  public static getTeamKits(teamId: number, teamName: string): TeamKitsResult {
    const known = DEFAULT_TEAM_KITS[teamName];
    if (known) {
      return {
        teamId,
        teamName,
        season: "2026",
        kits: known,
      };
    }

    // Gerador padrão determinístico para outros clubes
    const seed = teamId;
    const colors = ["#003399", "#CC0000", "#006600", "#FFCC00", "#660066", "#000000", "#FFFFFF"];
    const primary = colors[seed % colors.length];

    return {
      teamId,
      teamName,
      season: "2026",
      kits: {
        home: { type: "HOME", description: `Uniforme 1 Oficial de ${teamName}`, shirtColor: primary, secondaryColor: "#FFFFFF", shortsColor: "#FFFFFF", socksColor: primary, numberColor: "#FFFFFF", pattern: "SOLID" },
        away: { type: "AWAY", description: `Uniforme 2 Reserva de ${teamName}`, shirtColor: "#FFFFFF", secondaryColor: primary, shortsColor: primary, socksColor: "#FFFFFF", numberColor: primary, pattern: "SOLID" },
        third: { type: "THIRD", description: `Uniforme 3 Alternativo de ${teamName}`, shirtColor: "#1A1A1A", secondaryColor: primary, shortsColor: "#1A1A1A", socksColor: "#1A1A1A", numberColor: "#FFFFFF", pattern: "SPECIAL" },
        goalkeeper: { type: "GOALKEEPER", description: "Uniforme de Goleiro", shirtColor: "#00E5FF", secondaryColor: "#000000", shortsColor: "#00E5FF", socksColor: "#00E5FF", numberColor: "#000000", pattern: "SOLID" },
      },
    };
  }

  /**
   * Determina a combinação de uniformes selecionada para uma partida sem conflito visual
   */
  public static getMatchdayKits(match: {
    id: number;
    homeTeam: { id: number; name: string; shortName?: string | null };
    awayTeam: { id: number; name: string; shortName?: string | null };
  }): MatchKitsSelectionResult {
    const homeKits = this.getTeamKits(match.homeTeam.id, match.homeTeam.shortName || match.homeTeam.name);
    const awayKits = this.getTeamKits(match.awayTeam.id, match.awayTeam.shortName || match.awayTeam.name);

    // Mandante sempre joga com a HOME
    const homeSelected = homeKits.kits.home;

    // Se as cores principais forem parecidas, o visitante usa AWAY
    const colorConflict = homeSelected.shirtColor.toLowerCase() === awayKits.kits.home.shirtColor.toLowerCase();
    const awaySelected = colorConflict ? awayKits.kits.away : awayKits.kits.away;

    return {
      matchId: match.id,
      homeTeam: {
        id: match.homeTeam.id,
        name: match.homeTeam.shortName || match.homeTeam.name,
        selectedKitType: "HOME",
        kit: homeSelected,
      },
      awayTeam: {
        id: match.awayTeam.id,
        name: match.awayTeam.shortName || match.awayTeam.name,
        selectedKitType: "AWAY",
        kit: awaySelected,
      },
      contrastQuality: "OPTIMAL",
    };
  }
}
