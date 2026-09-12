import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { teams, players, competitions, venues } from "../db/schema.js";
import { ilike, or, eq } from "drizzle-orm";
import { EspnNewsService } from "../services/espnNews.js";
import { cache } from "../services/cache.js";

export const searchRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["Busca Global"],
        summary: "Busca global unificada (Clubes, Atletas, Competições e Notícias)",
        description:
          "Pesquisa simultaneamente em clubes, atletas, ligas e notícias com uma única requisição. Ideal para alimentar barras de pesquisa de aplicativos móveis.",
        querystring: z.object({
          q: z.string().min(2, "O termo de busca deve conter pelo menos 2 caracteres"),
          limit: z.coerce.number().min(1).max(20).default(5),
        }),
      },
    },
    async (request) => {
      const { q, limit } = request.query;
      const cleanQ = q.trim();
      const cacheKey = `search:${cleanQ.toLowerCase()}:${limit}`;

      return await cache.wrap(cacheKey, 45, async () => {
        // 1. Buscar Clubes
        const teamsPromise = db
          .select({
            id: teams.id,
            name: teams.name,
            shortName: teams.shortName,
            acronym: teams.acronym,
            country: teams.country,
            logoUrl: teams.logoUrl,
          })
          .from(teams)
          .where(
            or(
              ilike(teams.name, `%${cleanQ}%`),
              ilike(teams.shortName, `%${cleanQ}%`),
              eq(teams.acronym, cleanQ.toUpperCase())
            )
          )
          .limit(limit);

        // 2. Buscar Atletas
        const playersPromise = db
          .select({
            id: players.id,
            name: players.knownName,
            firstName: players.firstName,
            lastName: players.lastName,
            nationality: players.nationality,
            position: players.primaryPosition,
            photoUrl: players.photoUrl,
          })
          .from(players)
          .where(
            or(
              ilike(players.knownName, `%${cleanQ}%`),
              ilike(players.firstName, `%${cleanQ}%`),
              ilike(players.lastName, `%${cleanQ}%`)
            )
          )
          .limit(limit);

        // 3. Buscar Competições
        const competitionsPromise = db
          .select({
            id: competitions.id,
            name: competitions.name,
            code: competitions.code,
            country: competitions.country,
            type: competitions.type,
            logoUrl: competitions.logoUrl,
          })
          .from(competitions)
          .where(
            or(
              ilike(competitions.name, `%${cleanQ}%`),
              ilike(competitions.code, `%${cleanQ}%`)
            )
          )
          .limit(limit);

        // 4. Buscar Notícias relevantes da ESPN
        const newsPromise = EspnNewsService.getNews({
          team: cleanQ,
          limit: Math.min(limit, 3),
        }).catch(() => ({ articles: [] }));

        // Executar todas em paralelo
        const [foundTeams, foundPlayers, foundCompetitions, foundNews] = await Promise.all([
          teamsPromise,
          playersPromise,
          competitionsPromise,
          newsPromise,
        ]);

        return {
          query: cleanQ,
          counts: {
            teams: foundTeams.length,
            players: foundPlayers.length,
            competitions: foundCompetitions.length,
            news: foundNews.articles.length,
          },
          teams: foundTeams,
          players: foundPlayers.map((p) => ({
            id: p.id,
            name: p.name || `${p.firstName} ${p.lastName}`,
            nationality: p.nationality,
            position: p.position,
            photoUrl: p.photoUrl,
          })),
          competitions: foundCompetitions,
          news: foundNews.articles.map((a) => ({
            id: a.id,
            title: a.title,
            publishedAt: a.publishedAt,
            url: a.url,
            imageUrl: a.imageUrl,
            source: a.source,
          })),
        };
      });
    }
  );
};
