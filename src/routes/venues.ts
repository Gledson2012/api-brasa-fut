import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { venues } from "../db/schema.js";
import { eq, ilike, and, count } from "drizzle-orm";
import { paginate } from "../utils/pagination.js";
import { unaccentIlike } from "../utils/search.js";

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
          limit: z.coerce.number().min(1).max(100).default(50),
          page: z.coerce.number().min(1).default(1),
        }),
      },
    },
    async (request) => {
      const { city, search, limit, page } = request.query;
      const offset = (page - 1) * limit;

      let query = db.select().from(venues);
      const conditions = [];

      if (city) {
        conditions.push(eq(venues.city, city));
      }
      if (search) {
        conditions.push(unaccentIlike(venues.name, search));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const [totalRow] = await db
        .select({ count: count() })
        .from(venues)
        .where(whereClause);
      const total = Number(totalRow?.count ?? 0);

      const data = await query.limit(limit).offset(offset);
      return paginate(page, limit, total, data);
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
