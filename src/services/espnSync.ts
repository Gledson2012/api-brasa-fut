import { db } from "../db/index.js";
import { competitions, matches, seasons, teams, venues, players, teamRosters } from "../db/schema.js";
import { eq, and, or, ilike, gte, lte } from "drizzle-orm";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface EspnTournamentConfig {
  espnLeague: string;
  code: string;
  name: string;
  country: string;
  type: "LEAGUE" | "CUP" | "INTERNATIONAL";
  seasonName: string;
}

export const ESPN_TOURNAMENTS: EspnTournamentConfig[] = [
  // 🇧🇷 Brasil
  { espnLeague: "bra.1", code: "BRA-1", name: "Brasileirão Série A", country: "Brasil", type: "LEAGUE", seasonName: "2026" },
  { espnLeague: "bra.2", code: "BRA-2", name: "Brasileirão Série B", country: "Brasil", type: "LEAGUE", seasonName: "2026" },
  { espnLeague: "bra.copa_do_brasil", code: "CDB", name: "Copa do Brasil", country: "Brasil", type: "CUP", seasonName: "2026" },

  // 🌎 América do Sul
  { espnLeague: "conmebol.libertadores", code: "LIB", name: "CONMEBOL Libertadores", country: "América do Sul", type: "INTERNATIONAL", seasonName: "2026" },
  { espnLeague: "conmebol.sudamericana", code: "SUL", name: "CONMEBOL Sul-Americana", country: "América do Sul", type: "INTERNATIONAL", seasonName: "2026" },
  { espnLeague: "conmebol.recopa", code: "REC", name: "Recopa Sul-Americana", country: "América do Sul", type: "INTERNATIONAL", seasonName: "2026" },
  { espnLeague: "conmebol.america", code: "CA", name: "Copa América", country: "América do Sul", type: "INTERNATIONAL", seasonName: "2026" },
  { espnLeague: "arg.1", code: "ARG-1", name: "Liga Profesional Argentina", country: "Argentina", type: "LEAGUE", seasonName: "2026" },
  { espnLeague: "col.1", code: "COL-1", name: "Primera A Colômbia", country: "Colômbia", type: "LEAGUE", seasonName: "2026" },
  { espnLeague: "chi.1", code: "CHI-1", name: "Primera División Chile", country: "Chile", type: "LEAGUE", seasonName: "2026" },
  { espnLeague: "uru.1", code: "URU-1", name: "Liga AUF Uruguai", country: "Uruguai", type: "LEAGUE", seasonName: "2026" },
  { espnLeague: "par.1", code: "PAR-1", name: "Primera División Paraguai", country: "Paraguai", type: "LEAGUE", seasonName: "2026" },
  { espnLeague: "per.1", code: "PER-1", name: "Liga 1 Peru", country: "Peru", type: "LEAGUE", seasonName: "2026" },
  { espnLeague: "ecu.1", code: "ECU-1", name: "LigaPro Equador", country: "Equador", type: "LEAGUE", seasonName: "2026" },

  // 🇺🇸 América do Norte & Concacaf
  { espnLeague: "usa.1", code: "MLS", name: "Major League Soccer (MLS)", country: "Estados Unidos", type: "LEAGUE", seasonName: "2026" },
  { espnLeague: "mex.1", code: "LMX", name: "Liga MX", country: "México", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "concacaf.champions", code: "CCC", name: "Concacaf Champions Cup", country: "América do Norte", type: "INTERNATIONAL", seasonName: "2026" },

  // 🇬🇧 Inglaterra
  { espnLeague: "eng.1", code: "PL", name: "Premier League", country: "Inglaterra", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "eng.2", code: "ENG-2", name: "EFL Championship", country: "Inglaterra", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "eng.fa", code: "FACUP", name: "FA Cup", country: "Inglaterra", type: "CUP", seasonName: "2025/2026" },
  { espnLeague: "eng.league_cup", code: "CARABAO", name: "Carabao Cup", country: "Inglaterra", type: "CUP", seasonName: "2025/2026" },

  // 🇪🇸 Espanha
  { espnLeague: "esp.1", code: "LAL", name: "La Liga", country: "Espanha", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "esp.2", code: "LAL-2", name: "La Liga 2 (Segunda)", country: "Espanha", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "esp.copa_del_rey", code: "CDR", name: "Copa del Rey", country: "Espanha", type: "CUP", seasonName: "2025/2026" },

  // 🇮🇹 Itália
  { espnLeague: "ita.1", code: "SA-ITA", name: "Serie A Italiana", country: "Itália", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "ita.2", code: "ITA-2", name: "Serie B Italiana", country: "Itália", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "ita.coppa_italia", code: "COPPA", name: "Coppa Italia", country: "Itália", type: "CUP", seasonName: "2025/2026" },

  // 🇩🇪 Alemanha
  { espnLeague: "ger.1", code: "BUN", name: "Bundesliga", country: "Alemanha", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "ger.2", code: "BUN-2", name: "2. Bundesliga", country: "Alemanha", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "ger.dfb_pokal", code: "DFB", name: "DFB-Pokal (Copa da Alemanha)", country: "Alemanha", type: "CUP", seasonName: "2025/2026" },

  // 🇫🇷 França
  { espnLeague: "fra.1", code: "LIG-1", name: "Ligue 1", country: "França", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "fra.2", code: "LIG-2", name: "Ligue 2", country: "França", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "fra.coupe_de_france", code: "CDF", name: "Coupe de France", country: "França", type: "CUP", seasonName: "2025/2026" },

  // 🇪🇺 Outras Ligas da Europa
  { espnLeague: "por.1", code: "POR-1", name: "Primeira Liga Portugal", country: "Portugal", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "ned.1", code: "ERE", name: "Eredivisie Holanda", country: "Holanda", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "bel.1", code: "BEL-1", name: "Jupiler Pro League Bélgica", country: "Bélgica", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "tur.1", code: "TUR-1", name: "Süper Lig Turquia", country: "Turquia", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "sco.1", code: "SCO-1", name: "Scottish Premiership", country: "Escócia", type: "LEAGUE", seasonName: "2025/2026" },

  // 🏆 UEFA
  { espnLeague: "uefa.champions", code: "UCL", name: "UEFA Champions League", country: "Europa", type: "INTERNATIONAL", seasonName: "2025/2026" },
  { espnLeague: "uefa.europa", code: "UEL", name: "UEFA Europa League", country: "Europa", type: "INTERNATIONAL", seasonName: "2025/2026" },
  { espnLeague: "uefa.europa.conf", code: "UECL", name: "UEFA Conference League", country: "Europa", type: "INTERNATIONAL", seasonName: "2025/2026" },
  { espnLeague: "uefa.nations", code: "UNL", name: "UEFA Nations League", country: "Europa", type: "INTERNATIONAL", seasonName: "2025/2026" },
  { espnLeague: "uefa.super_cup", code: "USC", name: "UEFA Super Cup", country: "Europa", type: "INTERNATIONAL", seasonName: "2025/2026" },
  { espnLeague: "uefa.euro", code: "EURO", name: "UEFA Eurocopa", country: "Europa", type: "INTERNATIONAL", seasonName: "2026" },

  // 🇸🇦 🇯🇵 🇦🇺 Ásia, Oriente Médio & Oceania
  { espnLeague: "ksa.1", code: "SPL", name: "Saudi Pro League (Liga Saudita)", country: "Arábia Saudita", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "jpn.1", code: "J1", name: "J1 League Japão", country: "Japão", type: "LEAGUE", seasonName: "2026" },
  { espnLeague: "afc.champions", code: "ACL", name: "AFC Champions League Elite", country: "Ásia", type: "INTERNATIONAL", seasonName: "2025/2026" },
  { espnLeague: "aus.1", code: "A-LEAGUE", name: "A-League Men Austrália", country: "Austrália", type: "LEAGUE", seasonName: "2025/2026" },

  // 👩 Futebol Feminino
  { espnLeague: "eng.w.1", code: "WSL", name: "Women's Super League Inglaterra", country: "Inglaterra", type: "LEAGUE", seasonName: "2025/2026" },
  { espnLeague: "usa.nwsl", code: "NWSL", name: "National Women's Soccer League (NWSL)", country: "Estados Unidos", type: "LEAGUE", seasonName: "2026" },

  // 🌐 FIFA
  { espnLeague: "fifa.world", code: "WC-2026", name: "Copa do Mundo FIFA", country: "Mundial", type: "INTERNATIONAL", seasonName: "2026" },
  { espnLeague: "fifa.cwc", code: "FCWC", name: "Copa do Mundo de Clubes da FIFA", country: "Mundial", type: "INTERNATIONAL", seasonName: "2026" },
];

export class EspnSyncService {
  private static async fetchScoreboard(league: string, date?: string): Promise<any | null> {
    const url = date
      ? `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${date.replace(/-/g, "")}`
      : `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard`;

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Fallback para curl caso o fetch nativo sofra timeout
      try {
        const { stdout } = await execFileAsync("curl", [
          "-s",
          "--compressed",
          "-m",
          "10",
          "-H",
          "Accept: application/json",
          url,
        ]);
        const trimmed = stdout.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          return JSON.parse(trimmed);
        }
      } catch (err: any) {
        console.warn(`[EspnSync] Falha ao buscar ${url}:`, err.message);
      }
    }
    return null;
  }

  private static async findOrCreateCompetition(config: EspnTournamentConfig): Promise<number> {
    const [existing] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.code, config.code))
      .limit(1);

    if (existing) return existing.id;

    const [inserted] = await db
      .insert(competitions)
      .values({
        name: config.name,
        code: config.code,
        country: config.country,
        type: config.type,
        logoUrl: `https://a.espncdn.com/i/leaguelogos/soccer/500/${config.espnLeague}.png`,
      })
      .returning();

    return inserted.id;
  }

  private static async findOrCreateTeam(teamData: any, country: string): Promise<number> {
    const rawName = teamData.displayName || teamData.name || "Time Desconhecido";
    const shortName = teamData.shortDisplayName || teamData.name || rawName;
    const acronym = (teamData.abbreviation || shortName.slice(0, 3)).slice(0, 10).toUpperCase();
    const logoUrl = teamData.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${teamData.id}.png`;

    const [existing] = await db
      .select()
      .from(teams)
      .where(
        or(
          ilike(teams.name, `%${shortName}%`),
          ilike(teams.shortName, `%${shortName}%`),
          ilike(teams.name, `%${rawName}%`)
        )
      )
      .limit(1);

    if (existing) {
      if (!existing.logoUrl && logoUrl) {
        await db.update(teams).set({ logoUrl }).where(eq(teams.id, existing.id));
      }
      return existing.id;
    }

    const [inserted] = await db
      .insert(teams)
      .values({
        name: rawName,
        shortName,
        acronym,
        country,
        logoUrl,
      })
      .returning();

    return inserted.id;
  }

  private static async findOrCreateVenue(venueName?: string, country: string = "Brasil"): Promise<number | null> {
    if (!venueName || venueName.trim() === "") return null;
    const cleanVenue = venueName.trim();

    const [existing] = await db
      .select()
      .from(venues)
      .where(ilike(venues.name, `%${cleanVenue}%`))
      .limit(1);

    if (existing) return existing.id;

    const [inserted] = await db
      .insert(venues)
      .values({
        name: cleanVenue,
        city: country,
        country,
        capacity: 45000,
        surface: "Grass",
      })
      .returning();

    return inserted.id;
  }

  private static mapStatus(statusObj: any): "SCHEDULED" | "FIRST_HALF" | "HALF_TIME" | "SECOND_HALF" | "EXTRA_TIME" | "PENALTIES" | "FINISHED" | "POSTPONED" | "CANCELLED" {
    const statusType = statusObj?.type || statusObj;
    if (statusType?.completed) return "FINISHED";
    const state = statusType?.state;
    if (state === "in") {
      const typeName = statusType?.name || "";
      const desc = (statusType?.description || "").toLowerCase();
      
      if (typeName === "STATUS_HALFTIME" || desc === "halftime" || desc === "intervalo" || desc === "ht") {
        return "HALF_TIME";
      }
      if (typeName.includes("SHOOTOUT") || typeName.includes("PENALTIES")) {
        return "PENALTIES";
      }
      if (typeName.includes("EXTRA") || desc.includes("extra") || desc.includes("prorroga")) {
        return "EXTRA_TIME";
      }
      if (typeName === "STATUS_FIRST_HALF" || desc.includes("first") || desc.includes("1st") || desc.includes("primeiro") || statusObj?.period === 1) {
        return "FIRST_HALF";
      }
      return "SECOND_HALF";
    }
    if (statusType?.name?.includes("POSTPONED")) return "POSTPONED";
    if (statusType?.name?.includes("CANCELLED")) return "CANCELLED";
    return "SCHEDULED";
  }

  private static async findOrCreateSeason(competitionId: number, seasonName: string): Promise<number> {
    const [season] = await db
      .select()
      .from(seasons)
      .where(and(eq(seasons.competitionId, competitionId), eq(seasons.name, seasonName)));

    if (season) return season.id;

    const [current] = await db
      .select()
      .from(seasons)
      .where(and(eq(seasons.competitionId, competitionId), eq(seasons.isCurrent, true)));

    if (current) return current.id;

    const [inserted] = await db
      .insert(seasons)
      .values({
        competitionId,
        name: seasonName,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        isCurrent: true,
      })
      .returning();

    return inserted.id;
  }

  /**
   * Sincroniza todas as partidas reais de uma liga específica da ESPN
   */
  public static async syncLeague(config: EspnTournamentConfig, date?: string): Promise<number> {
    const data = await this.fetchScoreboard(config.espnLeague, date);
    if (!data?.events || !Array.isArray(data.events) || data.events.length === 0) {
      return 0;
    }

    const compId = await this.findOrCreateCompetition(config);
    const seasonId = await this.findOrCreateSeason(compId, config.seasonName);
    let syncedCount = 0;

    for (const ev of data.events) {
      try {
        const competitionItem = ev.competitions?.[0];
        if (!competitionItem?.competitors || competitionItem.competitors.length < 2) continue;

        const homeComp = competitionItem.competitors.find((c: any) => c.homeAway === "home") || competitionItem.competitors[0];
        const awayComp = competitionItem.competitors.find((c: any) => c.homeAway === "away") || competitionItem.competitors[1];

        const homeTeamId = await this.findOrCreateTeam(homeComp.team, config.country);
        const awayTeamId = await this.findOrCreateTeam(awayComp.team, config.country);
        const venueId = await this.findOrCreateVenue(ev.venue?.displayName, config.country);

        const kickoff = new Date(ev.date);
        const status = this.mapStatus(ev.status);
        const homeScore = parseInt(homeComp.score, 10) || 0;
        const awayScore = parseInt(awayComp.score, 10) || 0;
        const roundName = competitionItem.round ? `Rodada ${competitionItem.round}` : "Fase Oficial";

        // Janela de busca de 3 dias para idempotência
        const windowStart = new Date(kickoff.getTime() - 3 * 24 * 60 * 60 * 1000);
        const windowEnd = new Date(kickoff.getTime() + 3 * 24 * 60 * 60 * 1000);

        const [existing] = await db
          .select()
          .from(matches)
          .where(
            and(
              eq(matches.seasonId, seasonId),
              eq(matches.homeTeamId, homeTeamId),
              eq(matches.awayTeamId, awayTeamId),
              gte(matches.kickoffTime, windowStart),
              lte(matches.kickoffTime, windowEnd)
            )
          )
          .limit(1);

        if (existing) {
          await db
            .update(matches)
            .set({
              kickoffTime: kickoff,
              status,
              homeScore,
              awayScore,
              venueId,
              round: roundName,
              updatedAt: new Date(),
            })
            .where(eq(matches.id, existing.id));
        } else {
          await db.insert(matches).values({
            seasonId,
            venueId,
            homeTeamId,
            awayTeamId,
            round: roundName,
            kickoffTime: kickoff,
            status,
            homeScore,
            awayScore,
          });
        }

        syncedCount++;
      } catch (err: any) {
        console.warn(`[EspnSync] Erro ao processar evento de ${config.code}:`, err.message);
      }
    }

    return syncedCount;
  }

  /**
   * Sincroniza todas as ligas reais configuradas
   */
  public static async syncAll(date?: string): Promise<{ success: boolean; matchesSynced: number }> {
    let total = 0;
    for (const conf of ESPN_TOURNAMENTS) {
      try {
        const count = await this.syncLeague(conf, date);
        total += count;
      } catch (err: any) {
        console.warn(`[EspnSync] Falha ao sincronizar ${conf.name}:`, err.message);
      }
    }
    return { success: true, matchesSynced: total };
  }

  /**
   * Sincroniza o elenco oficial de um clube da ESPN para o banco de dados
   */
  public static async syncTeamRoster(
    teamId: number,
    espnTeamId: string,
    leagueSlug = "bra.1",
    seasonId = 1
  ): Promise<number> {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/teams/${espnTeamId}/roster`;
    let data: any = null;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        data = await res.json();
      }
    } catch {
      try {
        const { stdout } = await execFileAsync("curl", ["-s", "--compressed", "-m", "10", url]);
        data = JSON.parse(stdout);
      } catch (err: any) {
        console.warn(`[EspnSync] Falha ao buscar elenco de ${espnTeamId}:`, err.message);
      }
    }

    if (!data?.athletes || !Array.isArray(data.athletes)) {
      return 0;
    }

    let synced = 0;
    for (const athlete of data.athletes) {
      try {
        const knownName = athlete.displayName || `${athlete.firstName || ""} ${athlete.lastName || ""}`.trim() || "Jogador";
        const firstName = athlete.firstName || knownName.split(" ")[0] || "Jogador";
        const lastName = athlete.lastName || knownName.split(" ").slice(1).join(" ") || firstName;
        const nationality = athlete.citizenship || "Brasil";
        const birthDate = athlete.dateOfBirth ? athlete.dateOfBirth.split("T")[0] : null;

        const posDisplay = athlete.position?.displayName || "";
        let position: "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD" = "FORWARD";
        if (posDisplay.includes("Goal")) position = "GOALKEEPER";
        else if (posDisplay.includes("Def")) position = "DEFENDER";
        else if (posDisplay.includes("Mid")) position = "MIDFIELDER";

        const jerseyNumber = athlete.jersey ? parseInt(athlete.jersey, 10) : null;
        const photoUrl = athlete.headshot?.href || null;

        // Converter peso (lbs para kg) se disponível
        let weightKg: number | null = null;
        if (athlete.displayWeight) {
          const match = athlete.displayWeight.match(/(\d+)/);
          if (match) weightKg = Math.round(parseInt(match[1], 10) * 0.453592);
        }

        // Converter altura (pés/polegadas para cm) se disponível
        let heightCm: number | null = null;
        if (athlete.displayHeight) {
          const match = athlete.displayHeight.match(/(\d+)'\s*(\d+)/);
          if (match) {
            const feet = parseInt(match[1], 10);
            const inches = parseInt(match[2], 10);
            heightCm = Math.round((feet * 12 + inches) * 2.54);
          }
        }

        // Buscar ou criar jogador por nome exato para evitar colisões (ex: Hugo x Hugo Souza)
        const [existingPlayer] = await db
          .select()
          .from(players)
          .where(
            or(
              ilike(players.knownName, knownName),
              and(ilike(players.firstName, firstName), ilike(players.lastName, lastName))
            )
          )
          .limit(1);

        let playerId: number;
        if (existingPlayer) {
          playerId = existingPlayer.id;
          await db
            .update(players)
            .set({
              photoUrl: photoUrl || existingPlayer.photoUrl,
              birthDate: birthDate || existingPlayer.birthDate,
              heightCm: heightCm || existingPlayer.heightCm,
              weightKg: weightKg || existingPlayer.weightKg,
              primaryPosition: position,
              nationality,
              updatedAt: new Date(),
            })
            .where(eq(players.id, playerId));
        } else {
          const [inserted] = await db
            .insert(players)
            .values({
              firstName,
              lastName,
              knownName,
              birthDate,
              nationality,
              primaryPosition: position,
              heightCm,
              weightKg,
              photoUrl,
            })
            .returning();
          playerId = inserted.id;
        }

        // Vincular ao elenco (team_rosters)
        const [existingRoster] = await db
          .select()
          .from(teamRosters)
          .where(
            and(
              eq(teamRosters.teamId, teamId),
              eq(teamRosters.playerId, playerId),
              eq(teamRosters.seasonId, seasonId)
            )
          )
          .limit(1);

        if (existingRoster) {
          await db
            .update(teamRosters)
            .set({
              jerseyNumber: jerseyNumber ?? existingRoster.jerseyNumber,
              position,
            })
            .where(eq(teamRosters.id, existingRoster.id));
        } else {
          await db.insert(teamRosters).values({
            teamId,
            playerId,
            seasonId,
            jerseyNumber,
            position,
          });
        }

        synced++;
      } catch (err: any) {
        console.warn(`[EspnSync] Erro ao sincronizar jogador ${athlete?.displayName}:`, err.message);
      }
    }

    return synced;
  }
}

export const ESPN_TEAM_MAP: Record<string, { espnId: string; league: string }> = {
  corinthians: { espnId: "874", league: "bra.1" },
  palmeiras: { espnId: "2029", league: "bra.1" },
  flamengo: { espnId: "819", league: "bra.1" },
  "sao paulo": { espnId: "2026", league: "bra.1" },
  "são paulo": { espnId: "2026", league: "bra.1" },
  santos: { espnId: "2674", league: "bra.1" },
  fluminense: { espnId: "3445", league: "bra.1" },
  botafogo: { espnId: "6086", league: "bra.1" },
  vasco: { espnId: "3454", league: "bra.1" },
  gremio: { espnId: "6273", league: "bra.1" },
  grêmio: { espnId: "6273", league: "bra.1" },
  internacional: { espnId: "1936", league: "bra.1" },
  cruzeiro: { espnId: "2022", league: "bra.1" },
  "atletico-mg": { espnId: "7632", league: "bra.1" },
  "atlético-mg": { espnId: "7632", league: "bra.1" },
  bahia: { espnId: "9967", league: "bra.1" },
  "athletico-pr": { espnId: "3458", league: "bra.1" },
  fortaleza: { espnId: "7633", league: "bra.1" },
  vitoria: { espnId: "3457", league: "bra.1" },
  vitória: { espnId: "3457", league: "bra.1" },
  "red bull bragantino": { espnId: "6079", league: "bra.1" },
  bragantino: { espnId: "6079", league: "bra.1" },
};
