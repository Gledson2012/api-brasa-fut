import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { players, teamRosters, teams } from "../db/schema.js";
import { eq, ilike, and, or } from "drizzle-orm";

export const playerRoutes: FastifyPluginAsyncZod = async (app) => {
  // Listar atletas com filtros
  app.get(
    "/",
    {
      schema: {
        tags: ["Atletas"],
        summary: "Listar atletas com paginação e busca",
        querystring: z.object({
          search: z.string().optional(),
          nationality: z.string().optional(),
          position: z
            .enum(["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"])
            .optional(),
          limit: z.coerce.number().min(1).max(100).default(20),
          page: z.coerce.number().min(1).default(1),
        }),
      },
    },
    async (request) => {
      const { search, nationality, position, limit, page } = request.query;
      const offset = (page - 1) * limit;

      let query = db.select().from(players);

      const conditions = [];

      if (search) {
        conditions.push(
          or(
            ilike(players.firstName, `%${search}%`),
            ilike(players.lastName, `%${search}%`),
            ilike(players.knownName, `%${search}%`)
          )
        );
      }
      if (nationality) {
        conditions.push(eq(players.nationality, nationality));
      }
      if (position) {
        conditions.push(eq(players.primaryPosition, position));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const results = await query.limit(limit).offset(offset);
      return {
        page,
        limit,
        data: results,
      };
    }
  );

  // Detalhes do atleta com histórico de clubes
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Atletas"],
        summary: "Obter detalhes do atleta",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [player] = await db.select().from(players).where(eq(players.id, id));

      if (!player) {
        return reply.status(404).send({ error: "Atleta não encontrado" });
      }

      const clubs = await db
        .select({
          teamId: teams.id,
          teamName: teams.name,
          teamShortName: teams.shortName,
          jerseyNumber: teamRosters.jerseyNumber,
          position: teamRosters.position,
          seasonId: teamRosters.seasonId,
        })
        .from(teamRosters)
        .innerJoin(teams, eq(teamRosters.teamId, teams.id))
        .where(eq(teamRosters.playerId, id));

      return {
        ...player,
        clubs,
      };
    }
  );
};
