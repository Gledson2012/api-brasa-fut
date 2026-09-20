import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { matches, teams } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { cache } from "../services/cache.js";
import { HighlightsService } from "../services/highlights.js";

export const highlightsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Feed global de vídeos e melhores momentos
  app.get(
    "/",
    {
      schema: {
        tags: ["Vídeos & Melhores Momentos (Highlights)"],
        summary: "Feed global de vídeos e melhores momentos de partidas",
        description:
          "Retorna galeria de vídeos oficiais, clipes de gols e jogadas capitais, com URLs de streaming (MP4), embeds de player (`<iframe>`) e metadados de geoblocking.",
        querystring: z.object({
          countryCode: z
            .string()
            .length(2)
            .optional()
            .describe("Código ISO do país do cliente (ex: BR, PT, US) para filtrar restrições geográficas de transmissão"),
          category: z
            .enum(["FULL_HIGHLIGHTS", "GOAL", "KEY_PLAYS", "TACTICAL_SUMMARY"])
            .optional()
            .describe("Filtrar por tipo de conteúdo de vídeo"),
          limit: z.coerce.number().optional().default(20),
        }),
      },
    },
    async (request) => {
      const { countryCode, category, limit } = request.query;

      return await cache.wrap(
        `highlights:feed:${countryCode || "all"}:${category || "all"}:${limit}`,
        120,
        async () => {
          const items = HighlightsService.listHighlights({
            countryCode,
            category,
            limit,
          });

          return {
            total: items.length,
            filters: {
              appliedCountry: countryCode || "GLOBAL",
              category: category || "ALL",
            },
            data: items,
          };
        }
      );
    }
  );

  // Detalhes de um Highlight por ID
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Vídeos & Melhores Momentos (Highlights)"],
        summary: "Obter clipe de vídeo específico por ID",
        description:
          "Retorna link direto de reprodução, URL para embed em sites/apps, momentos capitais com timestamp em segundos e detalhes do canal de transmissão.",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const all = HighlightsService.listHighlights({ limit: 50 });
      const item = all.find((h) => h.id === id);

      if (!item) {
        return reply.status(404).send({ error: "Vídeo ou highlight não encontrado." });
      }

      return item;
    }
  );

  // Auditoria e regras de restrição geográfica (Geo-restrictions)
  app.get(
    "/:id/geo-restrictions",
    {
      schema: {
        tags: ["Vídeos & Melhores Momentos (Highlights)"],
        summary: "Consultar travas geográficas e direitos territoriais de um vídeo",
        description:
          "Informa se o vídeo possui transmissão liberada globalmente, whitelist de países permitidos ou blacklist de países bloqueados, além da permissão para embedding via iframe.",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request) => {
      const { id } = request.params;
      return HighlightsService.getGeoRestrictions(id);
    }
  );

  // Melhores momentos de uma partida específica
  app.get(
    "/matches/:matchId",
    {
      schema: {
        tags: ["Vídeos & Melhores Momentos (Highlights)"],
        summary: "Obter highlights vinculados a uma partida",
        description:
          "Busca todos os vídeos, gols recortados e lances polêmicos do VAR relacionados a uma partida específica.",
        params: z.object({
          matchId: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { matchId } = request.params;

      const [match] = await db
        .select({
          id: matches.id,
          homeTeamId: matches.homeTeamId,
          awayTeamId: matches.awayTeamId,
        })
        .from(matches)
        .where(eq(matches.id, matchId))
        .limit(1);

      let hName = "Flamengo";
      let aName = "Palmeiras";

      if (match) {
        const [h] = await db.select({ name: teams.shortName }).from(teams).where(eq(teams.id, match.homeTeamId)).limit(1);
        const [a] = await db.select({ name: teams.shortName }).from(teams).where(eq(teams.id, match.awayTeamId)).limit(1);
        if (h?.name) hName = h.name;
        if (a?.name) aName = a.name;
      }

      return HighlightsService.getHighlightsForMatch(matchId, hName, aName);
    }
  );
};
