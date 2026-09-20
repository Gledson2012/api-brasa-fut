/**
 * BrasaFut API - Highlights & Video Clips Engine
 * Módulo de Melhores Momentos, Vídeos Incorporáveis (Embed), Lances Capitais e Controle de Restrições Geográficas (Geo-blocking)
 */

export interface GeoRestriction {
  state: "NO_RESTRICTIONS" | "ALLOWED_COUNTRIES" | "BLOCKED_COUNTRIES";
  embeddable: boolean;
  allowedCountries: string[];
  blockedCountries: string[];
}

export interface KeyMoment {
  minute: number;
  type: "GOAL" | "VAR_REVIEW" | "PENALTY_SAVED" | "RED_CARD" | "CHANCE";
  description: string;
  player: string;
  videoTimestampSeconds: number;
}

export interface HighlightItem {
  id: number;
  matchId: number;
  competitionId?: number;
  competitionName?: string;
  matchTitle: string;
  title: string;
  description: string;
  durationSeconds: number;
  thumbnailUrl: string;
  videoUrl: string;
  embedUrl: string;
  channel: string;
  source: string;
  category: "FULL_HIGHLIGHTS" | "GOAL" | "KEY_PLAYS" | "TACTICAL_SUMMARY";
  publishedAt: string;
  geoRestrictions: GeoRestriction;
  keyMoments: KeyMoment[];
}

export class HighlightsService {
  /**
   * Base demonstrativa e geradora de highlights enriquecidos por partida
   */
  public static getHighlightsForMatch(
    matchId: number,
    homeTeamName: string = "Mandante",
    awayTeamName: string = "Visitante",
    competitionName: string = "Brasileirão Betano"
  ): HighlightItem[] {
    const slug = `${homeTeamName.toLowerCase()}-vs-${awayTeamName.toLowerCase()}`.replace(/\s+/g, "-");

    return [
      {
        id: matchId * 10 + 1,
        matchId,
        competitionName,
        matchTitle: `${homeTeamName} vs ${awayTeamName}`,
        title: `${homeTeamName} x ${awayTeamName} | Melhores Momentos & Todos os Gols`,
        description: `Confira os melhores momentos, defesas espetaculares, lances do VAR e todos os gols do confronto entre ${homeTeamName} e ${awayTeamName} pelo ${competitionName}.`,
        durationSeconds: 420,
        thumbnailUrl: `https://images.brasafut.com/highlights/${matchId}/thumb_full.jpg`,
        videoUrl: `https://videos.brasafut.com/highlights/${slug}-${matchId}.mp4`,
        embedUrl: `https://player.brasafut.com/embed/${matchId}?autoplay=0`,
        channel: "BrasaFut Play Oficial",
        source: "GE / Premiere / CazéTV",
        category: "FULL_HIGHLIGHTS",
        publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        geoRestrictions: {
          state: "ALLOWED_COUNTRIES",
          embeddable: true,
          allowedCountries: ["BR", "PT", "US", "AR", "UY", "ES", "GB"],
          blockedCountries: [],
        },
        keyMoments: [
          {
            minute: 14,
            type: "CHANCE",
            player: "Atacante Titular",
            description: "Finalização cruzada que explode na trave direita!",
            videoTimestampSeconds: 45,
          },
          {
            minute: 34,
            type: "GOAL",
            player: "Artilheiro",
            description: `Golaço de chapa no ângulo superior direito abrindo o placar para o ${homeTeamName}!`,
            videoTimestampSeconds: 112,
          },
          {
            minute: 58,
            type: "VAR_REVIEW",
            player: "Árbitro de Vídeo",
            description: "Checagem minuciosa de possível toque de braço na área: Pênalti confirmado após revisão na cabine.",
            videoTimestampSeconds: 215,
          },
          {
            minute: 60,
            type: "GOAL",
            player: "Camisa 10",
            description: `Cobrança de pênalti firme no canto esquerdo, deslocando o goleiro para o ${awayTeamName}!`,
            videoTimestampSeconds: 245,
          },
          {
            minute: 88,
            type: "GOAL",
            player: "Ponta Veloz",
            description: `Contra-ataque fulminante e toque de cavadinha na saída do arqueiro garantindo a vitória!`,
            videoTimestampSeconds: 380,
          },
        ],
      },
      {
        id: matchId * 10 + 2,
        matchId,
        competitionName,
        matchTitle: `${homeTeamName} vs ${awayTeamName}`,
        title: `Pintura de Gol aos 34' do 1º Tempo | ${homeTeamName}`,
        description: `Câmera exclusiva por trás do gol mostrando a curva indefensável da finalização de fora da área.`,
        durationSeconds: 45,
        thumbnailUrl: `https://images.brasafut.com/highlights/${matchId}/thumb_goal_1.jpg`,
        videoUrl: `https://videos.brasafut.com/clips/${matchId}_goal_34.mp4`,
        embedUrl: `https://player.brasafut.com/embed/clip/${matchId}_1?autoplay=1`,
        channel: "BrasaFut Lances Rápidos",
        source: "Feed Exclusivo",
        category: "GOAL",
        publishedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        geoRestrictions: {
          state: "NO_RESTRICTIONS",
          embeddable: true,
          allowedCountries: [],
          blockedCountries: [],
        },
        keyMoments: [
          {
            minute: 34,
            type: "GOAL",
            player: "Artilheiro",
            description: "Finalização curva perfeita da intermediária.",
            videoTimestampSeconds: 10,
          },
        ],
      },
    ];
  }

  /**
   * Lista global de destaques com filtros opcionais
   */
  public static listHighlights(options?: {
    countryCode?: string;
    category?: string;
    limit?: number;
  }): HighlightItem[] {
    const list: HighlightItem[] = [
      ...HighlightsService.getHighlightsForMatch(1, "Flamengo", "Palmeiras", "Brasileirão Betano"),
      ...HighlightsService.getHighlightsForMatch(2, "Corinthians", "São Paulo", "Paulistão Sicredi"),
      ...HighlightsService.getHighlightsForMatch(3, "Grêmio", "Internacional", "Gauchão Ipiranga"),
      ...HighlightsService.getHighlightsForMatch(4, "Real Madrid", "Barcelona", "La Liga EA Sports"),
    ];

    let filtered = list;

    if (options?.category) {
      filtered = filtered.filter((h) => h.category === options.category);
    }

    if (options?.countryCode) {
      const code = options.countryCode.toUpperCase();
      filtered = filtered.filter((h) => {
        if (h.geoRestrictions.state === "NO_RESTRICTIONS") return true;
        if (h.geoRestrictions.state === "ALLOWED_COUNTRIES") {
          return h.geoRestrictions.allowedCountries.includes(code);
        }
        if (h.geoRestrictions.state === "BLOCKED_COUNTRIES") {
          return !h.geoRestrictions.blockedCountries.includes(code);
        }
        return true;
      });
    }

    const limit = options?.limit || 20;
    return filtered.slice(0, limit);
  }

  /**
   * Obtém detalhes de restrição geográfica de um highlight específico
   */
  public static getGeoRestrictions(highlightId: number) {
    const all = HighlightsService.listHighlights({ limit: 50 });
    const item = all.find((h) => h.id === highlightId) || all[0];

    return {
      highlightId: item.id,
      title: item.title,
      embeddable: item.geoRestrictions.embeddable,
      state: item.geoRestrictions.state,
      stateDescription:
        item.geoRestrictions.state === "NO_RESTRICTIONS"
          ? "Highlight disponível globalmente sem nenhuma trava de direitos territoriais."
          : item.geoRestrictions.state === "ALLOWED_COUNTRIES"
          ? "Disponível exclusivamente para usuários localizados na lista de países autorizados."
          : "Bloqueado para usuários pertencentes à lista de países com restrição de transmissão.",
      allowedCountries: item.geoRestrictions.allowedCountries,
      blockedCountries: item.geoRestrictions.blockedCountries,
      playbackUrl: item.videoUrl,
      embedUrl: item.embedUrl,
    };
  }
}
