import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { DerbiesService } from "../services/derbies.js";

export const derbiesRoutes: FastifyPluginAsyncZod = async (app) => {
  // 1. Listar todos os dérbis e clássicos mundiais
  app.get(
    "/",
    {
      schema: {
        tags: ["Grandes Clássicos & Dérbis"],
        summary: "Listar rivalidades históricas e grandes clássicos",
        description:
          "Retorna os maiores clássicos do futebol brasileiro e internacional (Dérbi Paulista, Fla-Flu, Gre-Nal, Clássico Mineiro, El Clásico), incluindo placares históricos e vantagem.",
        querystring: z.object({
          country: z.string().optional(),
        }),
      },
    },
    async (request) => {
      const { country } = request.query;
      const data = DerbiesService.listDerbies(country);
      return {
        total: data.length,
        derbies: data,
      };
    }
  );

  // 2. Detalhes de um clássico pelo slug
  app.get(
    "/:slug",
    {
      schema: {
        tags: ["Grandes Clássicos & Dérbis"],
        summary: "Estatísticas completas de um clássico específico",
        description:
          "Retorna retrospecto geral (vitórias, empates, gols), maiores goleadas de cada lado, maiores artilheiros históricos e últimos 5 confrontos diretos.",
        params: z.object({
          slug: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { slug } = request.params;
      const derby = DerbiesService.getDerbyBySlug(slug);
      if (!derby) {
        return reply.status(404).send({ error: `Clássico '${slug}' não encontrado no catálogo oficial.` });
      }
      return derby;
    }
  );
};
