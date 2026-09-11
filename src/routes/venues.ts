import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { venues } from "../db/schema.js";
import { eq, ilike } from "drizzle-orm";

export const venueRoutes: FastifyPluginAsyncZod = async (app) => {
  // Listar estádios
  app.get(
    "/",
    {
      schema: {
        tags: ["Estádios"],
        summary: "Listar todos os estádios",
        querystring: z.object({
          city: z.string().optional(),
          search: z.string().optional(),
        }),
      },
    },
    async (request) => {
      const { city, search } = request.query;

      let query = db.select().from(venues);

      if (city) {
        query = query.where(eq(venues.city, city)) as typeof query;
      }
      if (search) {
        query = query.where(ilike(venues.name, `%${search}%`)) as typeof query;
      }

      return await query;
    }
  );

  // Detalhes do estádio
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Estádios"],
        summary: "Obter detalhes de um estádio",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [venue] = await db.select().from(venues).where(eq(venues.id, id));

      if (!venue) {
        return reply.status(404).send({ error: "Estádio não encontrado" });
      }

      return venue;
    }
  );
};
