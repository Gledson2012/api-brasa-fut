import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { competitions, seasons } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const competitionRoutes: FastifyPluginAsyncZod = async (app) => {
  // Listar todas as competições
  app.get(
    "/",
    {
      schema: {
        tags: ["Competições"],
        summary: "Listar todas as competições",
        description: "Retorna todas as ligas e copas cadastradas no sistema.",
        response: {
          200: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              code: z.string().nullable(),
              country: z.string().nullable(),
              type: z.enum(["LEAGUE", "CUP", "INTERNATIONAL"]),
              logoUrl: z.string().nullable(),
              createdAt: z.date().nullable(),
            })
          ),
        },
      },
    },
    async () => {
      return await db.select().from(competitions);
    }
  );

  // Detalhes de uma competição
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Competições"],
        summary: "Obter detalhes de uma competição",
        params: z.object({
          id: z.coerce.number(),
        }),
        response: {
          200: z.object({
            id: z.number(),
            name: z.string(),
            code: z.string().nullable(),
            country: z.string().nullable(),
            type: z.enum(["LEAGUE", "CUP", "INTERNATIONAL"]),
            logoUrl: z.string().nullable(),
            createdAt: z.date().nullable(),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [competition] = await db
        .select()
        .from(competitions)
        .where(eq(competitions.id, id));

      if (!competition) {
        return reply.status(404).send({ error: "Competição não encontrada" });
      }

      return competition;
    }
  );

  // Temporadas de uma competição
  app.get(
    "/:id/seasons",
    {
      schema: {
        tags: ["Competições"],
        summary: "Listar temporadas de uma competição",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request) => {
      const { id } = request.params;
      return await db
        .select()
        .from(seasons)
        .where(eq(seasons.competitionId, id));
    }
  );
};
