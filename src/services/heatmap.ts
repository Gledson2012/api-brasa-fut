/**
 * BrasaFut API - Heatmap & Action Zones Engine
 * Gera mapas de calor 2D (coordenadas 0-100 x,y) e densidades por zonas do campo
 */

export interface HeatmapPoint {
  x: number; // 0 (defesa) a 100 (ataque)
  y: number; // 0 (lateral esquerda) a 100 (lateral direita)
  intensity: number; // 0.1 a 1.0 (densidade do toque)
}

export interface ActionZones {
  thirds: {
    defensiveThird: number; // % de atuação no terço defensivo
    middleThird: number;    // % de atuação no meio-campo
    attackingThird: number; // % de atuação no terço ofensivo
  };
  flanks: {
    leftWing: number;       // % pelo corredor esquerdo
    center: number;         // % pelo meio
    rightWing: number;      // % pelo corredor direito
  };
  boxTouches: number;       // Toques dentro da grande área adversária
}

export interface PlayerHeatmapData {
  playerId: number;
  playerName: string;
  position: string;
  minutesPlayed: number;
  totalTouches: number;
  actionZones: ActionZones;
  points: HeatmapPoint[];
}

export interface TeamHeatmapData {
  teamId: number;
  teamName: string;
  totalActions: number;
  actionZones: ActionZones;
  points: HeatmapPoint[];
}

export class HeatmapService {
  /**
   * Gera pontos aleatórios ponderados com base na posição do jogador
   */
  private static generatePositionPoints(position: string, seed: number): { points: HeatmapPoint[]; zones: ActionZones; totalTouches: number } {
    const pos = position.toUpperCase();
    const points: HeatmapPoint[] = [];

    // Gerador determinístico pseudo-aleatório baseado no seed
    let s = seed;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    let centerX = 50;
    let centerY = 50;
    let spreadX = 25;
    let spreadY = 25;
    let defensiveThird = 33;
    let middleThird = 34;
    let attackingThird = 33;
    let leftWing = 33;
    let center = 34;
    let rightWing = 33;
    let boxTouches = 3;
    const totalTouches = Math.floor(45 + rnd() * 45);

    if (pos.includes("GOALKEEPER") || pos.includes("GOL") || pos.includes("GK")) {
      centerX = 12;
      centerY = 50;
      spreadX = 8;
      spreadY = 20;
      defensiveThird = 92;
      middleThird = 8;
      attackingThird = 0;
      leftWing = 25;
      center = 50;
      rightWing = 25;
      boxTouches = 0;
    } else if (pos.includes("DEFENDER") || pos.includes("ZAG") || pos.includes("CB")) {
      centerX = 30;
      centerY = 50;
      spreadX = 18;
      spreadY = 35;
      defensiveThird = 65;
      middleThird = 30;
      attackingThird = 5;
      leftWing = 25;
      center = 50;
      rightWing = 25;
      boxTouches = 1;
    } else if (pos.includes("LATERAL") || pos.includes("LB") || pos.includes("LE")) {
      centerX = 52;
      centerY = 18;
      spreadX = 35;
      spreadY = 15;
      defensiveThird = 35;
      middleThird = 40;
      attackingThird = 25;
      leftWing = 72;
      center = 20;
      rightWing = 8;
      boxTouches = 2;
    } else if (pos.includes("RB") || pos.includes("LD")) {
      centerX = 52;
      centerY = 82;
      spreadX = 35;
      spreadY = 15;
      defensiveThird = 35;
      middleThird = 40;
      attackingThird = 25;
      leftWing = 8;
      center = 20;
      rightWing = 72;
      boxTouches = 2;
    } else if (pos.includes("MIDFIELDER") || pos.includes("MEI") || pos.includes("VOL") || pos.includes("MC")) {
      centerX = 55;
      centerY = 50;
      spreadX = 25;
      spreadY = 35;
      defensiveThird = 25;
      middleThird = 55;
      attackingThird = 20;
      leftWing = 28;
      center = 44;
      rightWing = 28;
      boxTouches = 4;
    } else {
      // Atacante / Ponta
      centerX = 75;
      centerY = 50;
      spreadX = 20;
      spreadY = 35;
      defensiveThird = 8;
      middleThird = 32;
      attackingThird = 60;
      leftWing = 32;
      center = 36;
      rightWing = 32;
      boxTouches = 9;
    }

    const count = Math.min(totalTouches, 50);
    for (let i = 0; i < count; i++) {
      const px = Math.min(100, Math.max(0, Math.round(centerX + (rnd() - 0.5) * spreadX * 2)));
      const py = Math.min(100, Math.max(0, Math.round(centerY + (rnd() - 0.5) * spreadY * 2)));
      const intensity = Number((0.2 + rnd() * 0.8).toFixed(2));
      points.push({ x: px, y: py, intensity });
    }

    return {
      points,
      zones: {
        thirds: { defensiveThird, middleThird, attackingThird },
        flanks: { leftWing, center, rightWing },
        boxTouches,
      },
      totalTouches,
    };
  }

  /**
   * Gera o Heatmap de um jogador específico
   */
  public static getPlayerHeatmap(player: { id: number; name: string; position?: string | null }, matchId: number = 1): PlayerHeatmapData {
    const seed = player.id * 1000 + matchId * 37;
    const pos = player.position || "MIDFIELDER";
    const { points, zones, totalTouches } = this.generatePositionPoints(pos, seed);

    return {
      playerId: player.id,
      playerName: player.name,
      position: pos,
      minutesPlayed: 90,
      totalTouches,
      actionZones: zones,
      points,
    };
  }

  /**
   * Gera o Heatmap coletivo de um time na partida
   */
  public static getTeamHeatmap(team: { id: number; name: string }, isHome: boolean, matchId: number = 1): TeamHeatmapData {
    const seed = team.id * 500 + (isHome ? 123 : 987) + matchId;
    let s = seed;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    const points: HeatmapPoint[] = [];
    const totalActions = Math.floor(450 + rnd() * 200);

    // Mandante tende a atacar mais
    const defensiveThird = isHome ? 24 : 36;
    const middleThird = 44;
    const attackingThird = isHome ? 32 : 20;

    const leftWing = Math.floor(28 + rnd() * 10);
    const rightWing = Math.floor(28 + rnd() * 10);
    const center = 100 - leftWing - rightWing;
    const boxTouches = isHome ? Math.floor(22 + rnd() * 12) : Math.floor(14 + rnd() * 8);

    // Gerar 60 pontos representativos no campo
    for (let i = 0; i < 60; i++) {
      const biasX = isHome ? 56 : 44;
      const px = Math.min(98, Math.max(2, Math.round(biasX + (rnd() - 0.5) * 60)));
      const py = Math.min(98, Math.max(2, Math.round(50 + (rnd() - 0.5) * 70)));
      const intensity = Number((0.25 + rnd() * 0.75).toFixed(2));
      points.push({ x: px, y: py, intensity });
    }

    return {
      teamId: team.id,
      teamName: team.name,
      totalActions,
      actionZones: {
        thirds: { defensiveThird, middleThird, attackingThird },
        flanks: { leftWing, center, rightWing },
        boxTouches,
      },
      points,
    };
  }
}
