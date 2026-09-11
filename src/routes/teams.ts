import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { teams, teamRosters, players, venues, seasons } from "../db/schema.js";
import { eq, ilike, and } from "drizzle-orm";

export const teamRoutes: FastifyPluginAsyncZod = async (app) => {
  // Listar times com filtros
  app.get(
    "/",
    {
      schema: {
        tags: ["Clubes"],
        summary: "Listar todos os clubes",
        querystring: z.object({
          search: z.string().optional(),
          country: z.string().optional(),
        }),
      },
    },
    async (request) => {
      const { search, country } = request.query;

      let query = db
        .select({
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          acronym: teams.acronym,
          foundedYear: teams.foundedYear,
          country: teams.country,
          logoUrl: teams.logoUrl,
          venue: {
            id: venues.id,
            name: venues.name,
            city: venues.city,
            capacity: venues.capacity,
          },
        })
        .from(teams)
        .leftJoin(venues, eq(teams.venueId, venues.id));

      if (search) {
        query = query.where(ilike(teams.name, `%${search}%`)) as typeof query;
      }
      if (country) {
        query = query.where(eq(teams.country, country)) as typeof query;
      }

      return await query;
    }
  );

  // Detalhes do time
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Clubes"],
        summary: "Obter detalhes de um clube",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [team] = await db
        .select({
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          acronym: teams.acronym,
          foundedYear: teams.foundedYear,
          country: teams.country,
          logoUrl: teams.logoUrl,
          venue: {
            id: venues.id,
            name: venues.name,
            city: venues.city,
            capacity: venues.capacity,
            surface: venues.surface,
          },
        })
        .from(teams)
        .leftJoin(venues, eq(teams.venueId, venues.id))
        .where(eq(teams.id, id));

      if (!team) {
        return reply.status(404).send({ error: "Clube não encontrado" });
      }

      return team;
    }
  );

  // Elenco do time por temporada
  app.get(
    "/:id/roster",
    {
      schema: {
        tags: ["Clubes"],
        summary: "Obter elenco do time",
        params: z.object({
          id: z.coerce.number(),
        }),
        querystring: z.object({
          seasonId: z.coerce.number().optional(),
        }),
      },
    },
    async (request) => {
      const { id } = request.params;
      const { seasonId } = request.query;

      let whereClause = eq(teamRosters.teamId, id);
      if (seasonId) {
        whereClause = and(whereClause, eq(teamRosters.seasonId, seasonId))!;
      }

      const roster = await db
        .select({
          rosterId: teamRosters.id,
          jerseyNumber: teamRosters.jerseyNumber,
          position: teamRosters.position,
          seasonId: teamRosters.seasonId,
          player: {
            id: players.id,
            firstName: players.firstName,
            lastName: players.lastName,
            knownName: players.knownName,
            birthDate: players.birthDate,
            nationality: players.nationality,
            primaryPosition: players.primaryPosition,
            heightCm: players.heightCm,
            weightKg: players.weightKg,
            photoUrl: players.photoUrl,
          },
        })
        .from(teamRosters)
        .innerJoin(players, eq(teamRosters.playerId, players.id))
        .where(whereClause);

      return roster;
    }
  );
};
