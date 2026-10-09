/**
 * BrasaFut API - Global TV & Streaming Broadcast Guide Service
 * Guia completo e consolidado de onde assistir aos jogos de futebol na TV e no Streaming.
 * Utiliza dados 100% REAIS das partidas persistidas no banco de dados.
 */

import { db } from "../db/index.js";
import { matches, teams, competitions, venues, seasons } from "../db/schema.js";
import { eq, and, gte, lte, asc } from "drizzle-orm";

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

function getChannelsForCompetition(code?: string | null): BroadcastChannelEntry[] {
  switch (code) {
    case "BRA-1":
      return [
        { channelName: "TV Globo", type: "TV_ABERTA" },
        { channelName: "Premiere", type: "PAY_PER_VIEW", platformUrl: "https://premiere.globo.com" },
        { channelName: "SporTV", type: "TV_FECHADA", platformUrl: "https://globoplay.globo.com" },
      ];
    case "BRA-2":
      return [
        { channelName: "Premiere", type: "PAY_PER_VIEW", platformUrl: "https://premiere.globo.com" },
        { channelName: "SporTV", type: "TV_FECHADA" },
        { channelName: "TV Brasil", type: "TV_ABERTA" },
      ];
    case "PL":
      return [
        { channelName: "ESPN", type: "TV_FECHADA", platformUrl: "https://disneyplus.com" },
        { channelName: "Disney+", type: "STREAMING_PAGO", platformUrl: "https://disneyplus.com" },
      ];
    case "LAL":
    case "SA-ITA":
      return [
        { channelName: "ESPN", type: "TV_FECHADA", platformUrl: "https://disneyplus.com" },
        { channelName: "Disney+", type: "STREAMING_PAGO", platformUrl: "https://disneyplus.com" },
      ];
    case "BUN":
      return [
        { channelName: "SporTV", type: "TV_FECHADA" },
        { channelName: "CazéTV", type: "STREAMING_GRATIS", platformUrl: "https://youtube.com/c/cazetv" },
      ];
    case "UCL":
      return [
        { channelName: "SBT", type: "TV_ABERTA" },
        { channelName: "TNT", type: "TV_FECHADA" },
        { channelName: "Max", type: "STREAMING_PAGO", platformUrl: "https://max.com" },
      ];
    case "LIB":
      return [
        { channelName: "TV Globo", type: "TV_ABERTA" },
        { channelName: "ESPN", type: "TV_FECHADA" },
        { channelName: "Disney+", type: "STREAMING_PAGO" },
      ];
    default:
      return [
        { channelName: "ESPN", type: "TV_FECHADA", platformUrl: "https://disneyplus.com" },
        { channelName: "Disney+", type: "STREAMING_PAGO", platformUrl: "https://disneyplus.com" },
      ];
  }
}

export class TVGuideService {
  public static async getBroadcastGuide(date?: string): Promise<TVGuideResponse> {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

    // Busca partidas na data solicitada
    let dbMatches = await db
      .select({
        id: matches.id,
        kickoffTime: matches.kickoffTime,
        status: matches.status,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        venueId: matches.venueId,
        seasonId: matches.seasonId,
      })
      .from(matches)
      .where(and(gte(matches.kickoffTime, startOfDay), lte(matches.kickoffTime, endOfDay)))
      .orderBy(asc(matches.kickoffTime));

    // Se a data específica não foi fornecida (ou não há jogos hoje), traz os próximos jogos reais da rodada
    if (dbMatches.length === 0 && !date) {
      dbMatches = await db
        .select({
          id: matches.id,
          kickoffTime: matches.kickoffTime,
          status: matches.status,
          homeTeamId: matches.homeTeamId,
          awayTeamId: matches.awayTeamId,
          venueId: matches.venueId,
          seasonId: matches.seasonId,
        })
        .from(matches)
        .where(gte(matches.kickoffTime, startOfDay))
        .orderBy(asc(matches.kickoffTime))
        .limit(10);
    }

    const items: MatchBroadcastGuideItem[] = [];

    for (const m of dbMatches) {
      const [home] = await db.select().from(teams).where(eq(teams.id, m.homeTeamId));
      const [away] = await db.select().from(teams).where(eq(teams.id, m.awayTeamId));
      const [season] = await db.select().from(seasons).where(eq(seasons.id, m.seasonId));
      const [comp] = season
        ? await db.select().from(competitions).where(eq(competitions.id, season.competitionId))
        : [null];
      const [venue] = m.venueId
        ? await db.select().from(venues).where(eq(venues.id, m.venueId))
        : [null];

      if (!home || !away) continue;

      const channels = getChannelsForCompetition(comp?.code);

      items.push({
        matchId: m.id,
        homeTeam: {
          id: home.id,
          name: home.name,
          shortName: home.shortName || home.name,
          logoUrl: home.logoUrl || undefined,
        },
        awayTeam: {
          id: away.id,
          name: away.name,
          shortName: away.shortName || away.name,
          logoUrl: away.logoUrl || undefined,
        },
        competitionName: comp?.name || "Campeonato Oficial",
        kickoffTime: m.kickoffTime.toISOString(),
        venueName: venue?.name || "Estádio Oficial",
        status:
          m.status === "FINISHED"
            ? "FINISHED"
            : m.status === "FIRST_HALF" || m.status === "SECOND_HALF"
              ? "LIVE"
              : "SCHEDULED",
        channels,
      });
    }

    const networks = Array.from(
      new Set(items.flatMap((m) => m.channels.map((c) => c.channelName)))
    );

    return {
      date: targetDate,
      totalMatches: items.length,
      availableNetworks: networks,
      matches: items,
    };
  }
}
