import { execFile } from "child_process";
import { promisify } from "util";
import { cache } from "./cache.js";

const execFileAsync = promisify(execFile);

export interface NewsCategory {
  id: string;
  name: string;
  abbreviation?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  lastModified?: string;
  source: string;
  url: string;
  imageUrl: string | null;
  type: string;
  categories: {
    leagues: NewsCategory[];
    teams: NewsCategory[];
    athletes: NewsCategory[];
  };
}

export interface LeagueNewsMapping {
  espnCode: string;
  name: string;
  aliases: string[];
}

export const ESPN_LEAGUES: LeagueNewsMapping[] = [
  { espnCode: "bra.1", name: "Brasileirão Série A", aliases: ["bra-1", "bra1", "brasileirao", "serie-a"] },
  { espnCode: "bra.2", name: "Brasileirão Série B", aliases: ["bra-2", "bra2", "serie-b"] },
  { espnCode: "conmebol.libertadores", name: "CONMEBOL Libertadores", aliases: ["lib", "libertadores"] },
  { espnCode: "conmebol.sudamericana", name: "CONMEBOL Sul-Americana", aliases: ["sul", "sud", "sulamericana", "sudamericana"] },
  { espnCode: "eng.1", name: "Premier League", aliases: ["pl", "eng-1", "premier-league", "ingles"] },
  { espnCode: "esp.1", name: "LaLiga", aliases: ["lal", "esp-1", "laliga", "espanhol"] },
  { espnCode: "ita.1", name: "Serie A Italiana", aliases: ["sa-ita", "ita-1", "italiano", "serie-a-italiana"] },
  { espnCode: "ger.1", name: "Bundesliga", aliases: ["bun", "ger-1", "bundesliga", "alemao"] },
  { espnCode: "fra.1", name: "Ligue 1", aliases: ["lig-1", "fra-1", "ligue-1", "frances"] },
  { espnCode: "uefa.champions", name: "UEFA Champions League", aliases: ["ucl", "champions", "champions-league"] },
];

export class EspnNewsService {
  /**
   * Resolve código de liga a partir de apelidos comuns ou formato ESPN
   */
  public static resolveLeagueCode(input?: string): string {
    if (!input || input.toLowerCase() === "all" || input.toLowerCase() === "todos") {
      return "all";
    }

    const clean = input.trim().toLowerCase();
    const found = ESPN_LEAGUES.find(
      (l) => l.espnCode.toLowerCase() === clean || l.aliases.includes(clean)
    );

    return found ? found.espnCode : clean;
  }

  /**
   * Realiza requisição HTTP resiliente para a API da ESPN
   */
  private static async fetchRawJson<T>(url: string): Promise<T | null> {
    const secureUrl = url.startsWith("http://") ? url.replace("http://", "https://") : url;
    try {
      const response = await fetch(secureUrl, {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        return (await response.json()) as T;
      }
    } catch (err: any) {
      console.warn(`[EspnNews] Erro ao buscar ${secureUrl} via fetch:`, err.message);
    }

    // Fallback para curl caso fetch falhe
    try {
      const { stdout } = await execFileAsync("curl", [
        "-s",
        "-m",
        "10",
        "-H",
        "Accept: application/json",
        secureUrl,
      ], { maxBuffer: 10 * 1024 * 1024 });

      const trimmed = stdout.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        return JSON.parse(trimmed) as T;
      }
    } catch (err: any) {
      console.warn(`[EspnNews] Fallback curl falhou para ${secureUrl}:`, err.message);
    }
    return null;
  }

  /**
   * Formata um artigo bruto da ESPN para o modelo padrão da BrasaFut
   */
  private static formatArticle(raw: any): NewsArticle | null {
    if (!raw || !raw.headline) return null;

    const leagues: NewsCategory[] = [];
    const teams: NewsCategory[] = [];
    const athletes: NewsCategory[] = [];

    if (Array.isArray(raw.categories)) {
      for (const cat of raw.categories) {
        if (cat.type === "league") {
          leagues.push({
            id: String(cat.leagueId || cat.id || ""),
            name: cat.league?.description || cat.description || "Futebol",
            abbreviation: cat.league?.abbreviation,
          });
        } else if (cat.type === "team") {
          teams.push({
            id: String(cat.teamId || cat.id || ""),
            name: cat.team?.description || cat.description || "",
            abbreviation: cat.team?.abbreviation,
          });
        } else if (cat.type === "athlete") {
          athletes.push({
            id: String(cat.athleteId || cat.id || ""),
            name: cat.athlete?.description || cat.description || "",
          });
        }
      }
    }

    // Escolhe a melhor imagem disponível
    let imageUrl: string | null = null;
    if (Array.isArray(raw.images) && raw.images.length > 0) {
      const headerImg = raw.images.find((img: any) => img.type === "header" && img.url);
      imageUrl = headerImg ? headerImg.url : raw.images[0]?.url || null;
    }

    const webUrl =
      raw.links?.web?.href ||
      raw.links?.mobile?.href ||
      `https://www.espn.com.br/futebol/artigo/_/id/${raw.id}`;

    return {
      id: String(raw.id || raw.contentKey || Math.random().toString(36).substring(2)),
      title: raw.headline.trim(),
      description: (raw.description || "").trim(),
      publishedAt: raw.published || new Date().toISOString(),
      lastModified: raw.lastModified,
      source: "ESPN Brasil",
      url: webUrl,
      imageUrl,
      type: raw.type || "Story",
      categories: {
        leagues,
        teams,
        athletes,
      },
    };
  }

  /**
   * Busca notícias de uma liga específica da ESPN
   */
  public static async fetchLeagueNews(
    leagueCode: string,
    limit: number = 20
  ): Promise<NewsArticle[]> {
    const url = `http://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/news?lang=pt&region=br&limit=${limit}`;
    const rawData = await this.fetchRawJson<{ articles?: any[] }>(url);

    if (!rawData || !Array.isArray(rawData.articles)) {
      return [];
    }

    const articles: NewsArticle[] = [];
    for (const raw of rawData.articles) {
      const formatted = this.formatArticle(raw);
      if (formatted) articles.push(formatted);
    }
    return articles;
  }

  /**
   * Busca e agrega notícias de futebol com suporte a filtros e cache
   */
  public static async getNews(options: {
    league?: string;
    team?: string;
    limit?: number;
  }): Promise<{
    league: string;
    total: number;
    cached: boolean;
    articles: NewsArticle[];
  }> {
    const leagueCode = this.resolveLeagueCode(options.league);
    const limit = Math.min(Math.max(options.limit || 15, 1), 50);
    const teamFilter = options.team?.trim().toLowerCase();

    const cacheKey = `news:${leagueCode}:${teamFilter || "all"}:${limit}`;

    return await cache.wrap(cacheKey, 180, async () => {
      let articles: NewsArticle[] = [];

      if (leagueCode === "all") {
        // Busca notícias das principais ligas em paralelo
        const coreLeagues = ["bra.1", "conmebol.libertadores", "eng.1", "esp.1", "uefa.champions", "bra.2"];
        const results = await Promise.allSettled(
          coreLeagues.map((code) => this.fetchLeagueNews(code, 15))
        );

        const seenIds = new Set<string>();
        for (const res of results) {
          if (res.status === "fulfilled") {
            for (const article of res.value) {
              if (!seenIds.has(article.id)) {
                seenIds.add(article.id);
                articles.push(article);
              }
            }
          }
        }
      } else {
        articles = await this.fetchLeagueNews(leagueCode, limit * 2);
      }

      // Filtrar por time se solicitado
      if (teamFilter) {
        articles = articles.filter((article) => {
          const inTeams = article.categories.teams.some(
            (t) =>
              t.name.toLowerCase().includes(teamFilter) ||
              (t.abbreviation && t.abbreviation.toLowerCase().includes(teamFilter))
          );
          const inTitle = article.title.toLowerCase().includes(teamFilter);
          const inDesc = article.description.toLowerCase().includes(teamFilter);
          return inTeams || inTitle || inDesc;
        });
      }

      // Ordenar pelas mais recentes
      articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      // Aplicar limite final
      const sliced = articles.slice(0, limit);

      return {
        league: leagueCode,
        total: sliced.length,
        cached: false,
        articles: sliced,
      };
    });
  }
}
