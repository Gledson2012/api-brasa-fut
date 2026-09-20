/**
 * BrasaFut API - Tactical Board & 2D Pitch Lineups Service
 * Motor de escalações táticas oficiais com coordenadas de campo (x, y), prancheta e DNA de jogo
 */

export interface TacticalPlayerPosition {
  playerId: number;
  name: string;
  jerseyNumber: number;
  position: "GK" | "DEF" | "MID" | "FWD";
  tacticalRole: string; // Ex: "Goleiro Líbero", "Lateral Invertido", "Zagueiro Construtor", "Ponta de Ruptura"
  isCaptain: boolean;
  coordinates: {
    x: number; // 0 a 100 (linha de fundo defensiva até linha de fundo ofensiva)
    y: number; // 0 a 100 (linha lateral esquerda até linha lateral direita, 50 = centro)
  };
  rating?: number;
}

export interface TeamTacticalLineup {
  teamId: number;
  teamName: string;
  formation: string; // Ex: "4-2-3-1", "4-3-3", "3-4-2-1"
  manager: string;
  starters: TacticalPlayerPosition[];
  substitutes: {
    playerId: number;
    name: string;
    jerseyNumber: number;
    position: string;
  }[];
}

export interface MatchTacticalLineupsResult {
  matchId: number;
  homeTeam: TeamTacticalLineup;
  awayTeam: TeamTacticalLineup;
}

export class TacticsService {
  /**
   * Gera a prancheta tática visual de uma partida
   */
  public static getMatchTacticalLineup(match: {
    id: number;
    homeTeam: { id: number; name: string; shortName?: string | null };
    awayTeam: { id: number; name: string; shortName?: string | null };
  }): MatchTacticalLineupsResult {
    const hName = match.homeTeam.shortName || match.homeTeam.name;
    const aName = match.awayTeam.shortName || match.awayTeam.name;

    // Time da Casa (4-3-3 ofensivo)
    const homeStarters: TacticalPlayerPosition[] = [
      { playerId: 101, name: "Goleiro Titular", jerseyNumber: 1, position: "GK", tacticalRole: "Goleiro Líbero", isCaptain: false, coordinates: { x: 8, y: 50 }, rating: 7.2 },
      { playerId: 102, name: "Lateral Direito", jerseyNumber: 2, position: "DEF", tacticalRole: "Lateral Apoiador", isCaptain: false, coordinates: { x: 26, y: 88 }, rating: 7.0 },
      { playerId: 103, name: "Zagueiro Direito", jerseyNumber: 3, position: "DEF", tacticalRole: "Zagueiro Rebatedor", isCaptain: true, coordinates: { x: 22, y: 64 }, rating: 7.4 },
      { playerId: 104, name: "Zagueiro Esquerdo", jerseyNumber: 4, position: "DEF", tacticalRole: "Zagueiro Construtor", isCaptain: false, coordinates: { x: 22, y: 36 }, rating: 7.3 },
      { playerId: 105, name: "Lateral Esquerdo", jerseyNumber: 6, position: "DEF", tacticalRole: "Lateral Invertido", isCaptain: false, coordinates: { x: 26, y: 12 }, rating: 6.9 },
      { playerId: 106, name: "Primeiro Volante", jerseyNumber: 5, position: "MID", tacticalRole: "Pitbull Marcador", isCaptain: false, coordinates: { x: 40, y: 50 }, rating: 7.5 },
      { playerId: 107, name: "Segundo Volante", jerseyNumber: 8, position: "MID", tacticalRole: "Box-to-Box", isCaptain: false, coordinates: { x: 54, y: 68 }, rating: 7.8 },
      { playerId: 108, name: "Meia Armador", jerseyNumber: 10, position: "MID", tacticalRole: "Camisa 10 Criativo", isCaptain: false, coordinates: { x: 58, y: 32 }, rating: 8.2 },
      { playerId: 109, name: "Ponta Direita", jerseyNumber: 7, position: "FWD", tacticalRole: "Ponta Aberto", isCaptain: false, coordinates: { x: 76, y: 86 }, rating: 7.6 },
      { playerId: 110, name: "Centroavante", jerseyNumber: 9, position: "FWD", tacticalRole: "Pivô Finalizador", isCaptain: false, coordinates: { x: 86, y: 50 }, rating: 8.4 },
      { playerId: 111, name: "Ponta Esquerda", jerseyNumber: 11, position: "FWD", tacticalRole: "Ponta Invertido Chutador", isCaptain: false, coordinates: { x: 76, y: 14 }, rating: 7.9 },
    ];

    // Time Visitante (4-2-3-1 de transição)
    const awayStarters: TacticalPlayerPosition[] = [
      { playerId: 201, name: "Goleiro Visitante", jerseyNumber: 12, position: "GK", tacticalRole: "Goleiro Tradicional", isCaptain: false, coordinates: { x: 8, y: 50 }, rating: 7.1 },
      { playerId: 202, name: "Lateral Direito", jerseyNumber: 13, position: "DEF", tacticalRole: "Lateral Marcador", isCaptain: false, coordinates: { x: 24, y: 84 }, rating: 6.8 },
      { playerId: 203, name: "Zagueiro Central D", jerseyNumber: 14, position: "DEF", tacticalRole: "Zagueiro de Cobertura", isCaptain: true, coordinates: { x: 20, y: 62 }, rating: 7.2 },
      { playerId: 204, name: "Zagueiro Central E", jerseyNumber: 15, position: "DEF", tacticalRole: "Zagueiro Físico", isCaptain: false, coordinates: { x: 20, y: 38 }, rating: 7.0 },
      { playerId: 205, name: "Lateral Esquerdo", jerseyNumber: 16, position: "DEF", tacticalRole: "Lateral Fundo de Campo", isCaptain: false, coordinates: { x: 24, y: 16 }, rating: 6.9 },
      { playerId: 206, name: "Volante Defensivo", jerseyNumber: 17, position: "MID", tacticalRole: "Primeiro Volante Fixo", isCaptain: false, coordinates: { x: 42, y: 62 }, rating: 7.1 },
      { playerId: 207, name: "Volante de Saída", jerseyNumber: 18, position: "MID", tacticalRole: "Regista / Passador", isCaptain: false, coordinates: { x: 42, y: 38 }, rating: 7.3 },
      { playerId: 208, name: "Meia Central", jerseyNumber: 20, position: "MID", tacticalRole: "Enganche", isCaptain: false, coordinates: { x: 62, y: 50 }, rating: 7.5 },
      { playerId: 209, name: "Extremo Direito", jerseyNumber: 21, position: "FWD", tacticalRole: "Velocista de Contra-Ataque", isCaptain: false, coordinates: { x: 72, y: 82 }, rating: 7.4 },
      { playerId: 210, name: "Centroavante", jerseyNumber: 19, position: "FWD", tacticalRole: "Homem de Área", isCaptain: false, coordinates: { x: 84, y: 50 }, rating: 7.6 },
      { playerId: 211, name: "Extremo Esquerdo", jerseyNumber: 22, position: "FWD", tacticalRole: "Segundo Atacante", isCaptain: false, coordinates: { x: 72, y: 18 }, rating: 7.2 },
    ];

    return {
      matchId: match.id,
      homeTeam: {
        teamId: match.homeTeam.id,
        teamName: hName,
        formation: "4-3-3",
        manager: "Técnico Mandante",
        starters: homeStarters,
        substitutes: [
          { playerId: 112, name: "Goleiro Reserva", jerseyNumber: 22, position: "GK" },
          { playerId: 113, name: "Zagueiro Reserva", jerseyNumber: 15, position: "DEF" },
          { playerId: 114, name: "Lateral Reserva", jerseyNumber: 16, position: "DEF" },
          { playerId: 115, name: "Volante Suplente", jerseyNumber: 18, position: "MID" },
          { playerId: 116, name: "Meia Ofensivo", jerseyNumber: 20, position: "MID" },
          { playerId: 117, name: "Atacante de Velocidade", jerseyNumber: 27, position: "FWD" },
        ],
      },
      awayTeam: {
        teamId: match.awayTeam.id,
        teamName: aName,
        formation: "4-2-3-1",
        manager: "Técnico Visitante",
        starters: awayStarters,
        substitutes: [
          { playerId: 212, name: "Goleiro Reserva", jerseyNumber: 23, position: "GK" },
          { playerId: 213, name: "Zagueiro Reserva", jerseyNumber: 24, position: "DEF" },
          { playerId: 214, name: "Meia Reserva", jerseyNumber: 25, position: "MID" },
          { playerId: 215, name: "Centroavante Reserva", jerseyNumber: 29, position: "FWD" },
        ],
      },
    };
  }

  /**
   * Obtém a identidade e o DNA tático de um clube
   */
  public static getTeamTacticalDna(teamId: number, teamName: string) {
    const seed = teamId;
    const styles = [
      "Pressão alta em bloco agressivo e saídas verticais rápidas",
      "Posse de bola sustentada (Tiki-Taka moderno) e jogo apoiado",
      "Transição ofensiva de contra-ataque veloz com laterais profundos",
      "Jogo reativo compacto com defesa em linha baixa e bola parada forte",
    ];

    return {
      teamId,
      teamName,
      philosophy: styles[seed % styles.length],
      standardFormation: seed % 2 === 0 ? "4-2-3-1" : "4-3-3",
      metrics: {
        possessionAveragePct: 48 + (seed % 15),
        passesPerPossession: 4.8 + (seed % 2.5),
        highPressingIntensityPpda: 8.5 + (seed % 4), // Passes Per Defensive Action (menor = mais intenso)
        counterAttacksPerMatch: 3.2 + (seed % 2),
        setPieceExpectedGoalsSharePct: 24 + (seed % 14),
        attackChannelsDistribution: {
          leftFlankPct: 36,
          centerPct: 28,
          rightFlankPct: 36,
        },
      },
    };
  }
}
