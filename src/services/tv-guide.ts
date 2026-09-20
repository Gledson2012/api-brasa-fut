/**
 * BrasaFut API - Global TV & Streaming Broadcast Guide Service
 * Guia completo e consolidado de onde assistir aos jogos de futebol na TV e no Streaming
 */

export interface BroadcastChannelEntry {
  channelName: string;
  type: "TV_ABERTA" | "TV_FECHADA" | "STREAMING_PAGO" | "STREAMING_GRATIS" | "PAY_PER_VIEW";
  platformUrl?: string;
  narrator?: string;
  commentators?: string[];
}

export interface MatchBroadcastGuideItem {
  matchId: number;
  homeTeam: { id: number; name: string; shortName: string; logoUrl?: string };
  awayTeam: { id: number; name: string; shortName: string; logoUrl?: string };
  competitionName: string;
  kickoffTime: string;
  venueName: string;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  channels: BroadcastChannelEntry[];
}

export interface TVGuideResponse {
  date: string;
  totalMatches: number;
  availableNetworks: string[];
  matches: MatchBroadcastGuideItem[];
}

export class TVGuideService {
  public static getBroadcastGuide(date?: string): TVGuideResponse {
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const matches: MatchBroadcastGuideItem[] = [
      {
        matchId: 1,
        homeTeam: { id: 1, name: "Flamengo", shortName: "FLA", logoUrl: "https://images.brasafut.com/teams/1/crest.png" },
        awayTeam: { id: 2, name: "Palmeiras", shortName: "PAL", logoUrl: "https://images.brasafut.com/teams/2/crest.png" },
        competitionName: "Brasileirão Betano Série A",
        kickoffTime: `${targetDate}T16:00:00-03:00`,
        venueName: "Maracanã, Rio de Janeiro",
        status: "SCHEDULED",
        channels: [
          { channelName: "TV Globo", type: "TV_ABERTA", narrator: "Luís Roberto", commentators: ["Caio Ribeiro", "Júnior"] },
          { channelName: "Premiere", type: "PAY_PER_VIEW", platformUrl: "https://premiere.globo.com", narrator: "Gustavo Villani", commentators: ["Grafite"] },
        ],
      },
      {
        matchId: 2,
        homeTeam: { id: 3, name: "Corinthians", shortName: "COR", logoUrl: "https://images.brasafut.com/teams/3/crest.png" },
        awayTeam: { id: 4, name: "São Paulo", shortName: "SAO", logoUrl: "https://images.brasafut.com/teams/4/crest.png" },
        competitionName: "Brasileirão Betano Série A",
        kickoffTime: `${targetDate}T18:30:00-03:00`,
        venueName: "Neo Química Arena, São Paulo",
        status: "SCHEDULED",
        channels: [
          { channelName: "SporTV", type: "TV_FECHADA", platformUrl: "https://globoplay.globo.com", narrator: "Milton Leite", commentators: ["Lédio Carmona"] },
          { channelName: "Premiere", type: "PAY_PER_VIEW", platformUrl: "https://premiere.globo.com" },
        ],
      },
      {
        matchId: 3,
        homeTeam: { id: 5, name: "Grêmio", shortName: "GRE", logoUrl: "https://images.brasafut.com/teams/5/crest.png" },
        awayTeam: { id: 6, name: "Internacional", shortName: "INT", logoUrl: "https://images.brasafut.com/teams/6/crest.png" },
        competitionName: "Brasileirão Betano Série A",
        kickoffTime: `${targetDate}T21:00:00-03:00`,
        venueName: "Arena do Grêmio, Porto Alegre",
        status: "SCHEDULED",
        channels: [
          { channelName: "CazéTV", type: "STREAMING_GRATIS", platformUrl: "https://youtube.com/c/cazetv", narrator: "Luís Felipe Freitas", commentators: ["Casimiro Miguel", "Guilherme Beltrão"] },
          { channelName: "Prime Video", type: "STREAMING_PAGO", platformUrl: "https://primevideo.com", narrator: "Cléber Machado", commentators: ["Rafael Oliveira"] },
        ],
      },
      {
        matchId: 4,
        homeTeam: { id: 7, name: "Real Madrid", shortName: "RMA", logoUrl: "https://images.brasafut.com/teams/7/crest.png" },
        awayTeam: { id: 8, name: "Barcelona", shortName: "BAR", logoUrl: "https://images.brasafut.com/teams/8/crest.png" },
        competitionName: "La Liga EA Sports",
        kickoffTime: `${targetDate}T16:00:00-03:00`,
        venueName: "Santiago Bernabéu, Madrid",
        status: "SCHEDULED",
        channels: [
          { channelName: "ESPN", type: "TV_FECHADA", platformUrl: "https://disneyplus.com", narrator: "Rogério Vaughan", commentators: ["Paulo Calçade"] },
          { channelName: "Disney+", type: "STREAMING_PAGO", platformUrl: "https://disneyplus.com" },
        ],
      },
    ];

    const networks = Array.from(
      new Set(matches.flatMap((m) => m.channels.map((c) => c.channelName)))
    );

    return {
      date: targetDate,
      totalMatches: matches.length,
      availableNetworks: networks,
      matches,
    };
  }
}
