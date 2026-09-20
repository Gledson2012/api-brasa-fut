import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { cache } from "../services/cache.js";
import { TVGuideService } from "../services/tv-guide.js";

export const broadcastRoutes: FastifyPluginAsyncZod = async (app) => {
  // Guia completo de transmissões de futebol na TV e Streaming
  app.get(
    "/guide",
    {
      schema: {
        tags: ["Transmissões & Onde Assistir"],
        summary: "Guia completo de transmissões de futebol do dia (TV & Streaming)",
        description:
          "Grade agregada de jogos com canais de TV Aberta (Globo), TV Fechada (SporTV, ESPN, Premiere) e Streaming (CazéTV, Prime Video, Disney+, Max), acompanhados de narradores e comentaristas.",
        querystring: z.object({
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato deve ser YYYY-MM-DD")
            .optional()
            .describe("Data da rodada (padrão: hoje)"),
        }),
      },
    },
    async (request) => {
      const { date } = request.query;

      return await cache.wrap(`broadcasts:guide:${date || "today"}`, 120, async () => {
        return TVGuideService.getBroadcastGuide(date);
      });
    }
  );

  // Alias para jogos de hoje
  app.get(
    "/today",
    {
      schema: {
        tags: ["Transmissões & Onde Assistir"],
        summary: "Onde assistir futebol hoje na TV e no Streaming",
        description: "Retorna a grade de jogos de hoje com todas as opções de transmissão ao vivo.",
      },
    },
    async () => {
      return await cache.wrap("broadcasts:guide:today_alias", 120, async () => {
        return TVGuideService.getBroadcastGuide();
      });
    }
  );
};
