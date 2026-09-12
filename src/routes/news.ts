import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { EspnNewsService, ESPN_LEAGUES } from "../services/espnNews.js";

export const newsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Listar ligas e torneios com suporte a notícias
  app.get(
    "/leagues",
    {
      schema: {
        tags: ["Notícias & Imprensa"],
        summary: "Listar ligas e competições suportadas para notícias",
        description:
          "Retorna os códigos e apelidos das ligas suportadas pela central de notícias (ex: Brasileirão, Libertadores, Premier League, Champions).",
        response: {
          200: z.object({
            total: z.number(),
            leagues: z.array(
              z.object({
                espnCode: z.string(),
                name: z.string(),
                aliases: z.array(z.string()),
              })
            ),
          }),
        },
      },
    },
    async () => {
      return {
        total: ESPN_LEAGUES.length,
        leagues: ESPN_LEAGUES,
      };
    }
  );

  // Feed principal de notícias
  app.get(
    "/",
    {
      schema: {
        tags: ["Notícias & Imprensa"],
        summary: "Obter feed de notícias de futebol em tempo real (ESPN Brasil)",
        description:
          "Retorna as últimas notícias esportivas, manchetes, resumos, fotos de alta qualidade e links oficiais. Suporta filtro por liga (ex: 'bra.1', 'BRA-1', 'PL', 'libertadores', 'all') e busca por time (ex: 'flamengo', 'palmeiras').",
        querystring: z.object({
          league: z
            .string()
            .optional()
            .describe("Código ou apelido da liga (ex: 'bra.1', 'BRA-1', 'PL', 'libertadores', 'all'). Padrão: 'all'"),
          team: z
            .string()
            .optional()
            .describe("Nome ou sigla do clube para filtrar notícias (ex: 'flamengo', 'palmeiras', 'corinthians', 'real madrid')"),
          limit: z
            .coerce
            .number()
            .min(1)
            .max(50)
            .optional()
            .default(15)
            .describe("Quantidade máxima de notícias (1 a 50). Padrão: 15"),
        }),
        response: {
          200: z.object({
            league: z.string(),
            total: z.number(),
            cached: z.boolean(),
            articles: z.array(
              z.object({
                id: z.string(),
                title: z.string(),
                description: z.string(),
                publishedAt: z.string(),
                lastModified: z.string().optional(),
                source: z.string(),
                url: z.string(),
                imageUrl: z.string().nullable(),
                type: z.string(),
                categories: z.object({
                  leagues: z.array(
                    z.object({
                      id: z.string(),
                      name: z.string(),
                      abbreviation: z.string().optional(),
                    })
                  ),
                  teams: z.array(
                    z.object({
                      id: z.string(),
                      name: z.string(),
                      abbreviation: z.string().optional(),
                    })
                  ),
                  athletes: z.array(
                    z.object({
                      id: z.string(),
                      name: z.string(),
                    })
                  ),
                }),
              })
            ),
          }),
        },
      },
    },
    async (request) => {
      const { league, team, limit } = request.query;

      const result = await EspnNewsService.getNews({
        league,
        team,
        limit,
      });

      return result;
    }
  );
};
