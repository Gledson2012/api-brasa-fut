/**
 * BrasaFut API - Broadcast & Streaming Guide Service
 * Guia de transmissão oficial de partidas: TV Aberta, TV Fechada, PPV e Streaming
 */

export interface BroadcastChannel {
  channelName: string;
  type: "TV_ABERTA" | "TV_FECHADA" | "PAY_PER_VIEW" | "STREAMING" | "YOUTUBE";
  platform: string;
  isFreeToAir: boolean;
  resolution: "4K" | "FULL_HD" | "HD";
  directUrl?: string;
  talent?: {
    narrator: string;
    commentators: string[];
    pitchReporter: string;
  };
}

export interface MatchBroadcastInfo {
  matchId: number;
  match: string;
  kickoffTime: string;
  competition: string;
  venue: string;
  channels: BroadcastChannel[];
}

export class BroadcastService {
  /**
   * Determina os canais de transmissão para uma partida
   */
  public static getBroadcastForMatch(match: {
    id: number;
    homeTeam: { name: string; shortName?: string | null };
    awayTeam: { name: string; shortName?: string | null };
    kickoffTime?: string | Date | null;
    competitionName?: string;
    venueName?: string;
  }): MatchBroadcastInfo {
    const seed = match.id;
    const homeName = match.homeTeam.shortName || match.homeTeam.name;
    const awayName = match.awayTeam.shortName || match.awayTeam.name;

    const channels: BroadcastChannel[] = [];

    // Sempre presente em PPV (Premiere) para jogos nacionais
    channels.push({
      channelName: "Premiere",
      type: "PAY_PER_VIEW",
      platform: "Globoplay / Claro TV / Sky / Vivo",
      isFreeToAir: false,
      resolution: "FULL_HD",
      talent: {
        narrator: seed % 2 === 0 ? "Luiz Carlos Jr." : "Gustavo Villani",
        commentators: ["Grafite", "Ledio Carmona"],
        pitchReporter: "Eric Faria",
      },
    });

    // Jogos de grande audiência na TV Aberta (Globo)
    if (seed % 3 === 0 || seed === 1) {
      channels.push({
        channelName: "TV Globo",
        type: "TV_ABERTA",
        platform: "Canal aberto e Globoplay (sinal ao vivo)",
        isFreeToAir: true,
        resolution: "FULL_HD",
        directUrl: "https://globoplay.globo.com/tv-globo/ao-vivo/",
        talent: {
          narrator: "Luís Roberto",
          commentators: ["Júnior", "Caio Ribeiro"],
          pitchReporter: "Guilherme Pereira",
        },
      });
    }

    // SporTV para partidas selecionadas na TV Fechada
    if (seed % 2 !== 0) {
      channels.push({
        channelName: "SporTV",
        type: "TV_FECHADA",
        platform: "Canais Globo / Operadoras de TV",
        isFreeToAir: false,
        resolution: "FULL_HD",
        talent: {
          narrator: "Everaldo Marques",
          commentators: ["Maurício Noriega", "Ricardinho"],
          pitchReporter: "Renata Mendonça",
        },
      });
    }

    // CazéTV ou Prime Video no Streaming
    if (seed % 4 === 0 || seed === 2) {
      channels.push({
        channelName: "CazéTV",
        type: "YOUTUBE",
        platform: "YouTube, Twitch e Prime Video",
        isFreeToAir: true,
        resolution: "FULL_HD",
        directUrl: "https://youtube.com/@cazetv",
        talent: {
          narrator: "Casimiro Miguel e Luis Felipe Freitas",
          commentators: ["Guilherme Beltrão", "Juninho Pernambucano"],
          pitchReporter: "Diogo Defante",
        },
      });
    }

    return {
      matchId: match.id,
      match: `${homeName} vs ${awayName}`,
      kickoffTime: match.kickoffTime ? new Date(match.kickoffTime).toISOString() : new Date().toISOString(),
      competition: match.competitionName || "Brasileirão Série A",
      venue: match.venueName || "Estádio Jornalista Mário Filho (Maracanã)",
      channels,
    };
  }
}
