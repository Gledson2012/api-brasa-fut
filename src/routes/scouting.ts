import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { players, teams, teamRosters } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { cache } from "../services/cache.js";
import { ScoutingService } from "../services/scouting.js";

export const scoutingRoutes: FastifyPluginAsyncZod = async (app) => {
  // Radar de Jovens Promessas (Wonderkids)
  app.get(
    "/talents",
    {
      schema: {
        tags: ["Scouting & Olheiro de Talentos"],
        summary: "Radar de jovens talentos e promessas (Wonderkids)",
        description: "Lista atletas promissores com idade até o limite definido, exibindo potencial de desenvolvimento, atributos e clube atual.",
        querystring: z.object({
          maxAge: z.coerce.number().optional().default(22),
          position: z.enum(["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"]).optional(),
          limit: z.coerce.number().optional().default(10),
        }),
      },
    },
    async (request) => {
      const { maxAge, position, limit } = request.query;

      return await cache.wrap(`scouting:talents:age-${maxAge}:pos-${position || "all"}:lim-${limit}`, 180, async () => {
        const pool = await db
          .select({
            id: players.id,
            firstName: players.firstName,
            lastName: players.lastName,
            knownName: players.knownName,
            birthDate: players.birthDate,
            primaryPosition: players.primaryPosition,
            photoUrl: players.photoUrl,
            teamId: teamRosters.teamId,
          })
          .from(players)
          .leftJoin(teamRosters, eq(players.id, teamRosters.playerId))
          .limit(30);

        const reports = pool.map((p) => {
          return ScoutingService.getPlayerReport({
            id: p.id,
            name: p.knownName || `${p.firstName} ${p.lastName}`,
            position: p.primaryPosition,
            birthDate: p.birthDate,
            teamId: p.teamId,
          });
        });

        const filtered = reports
          .filter((r) => r.age <= maxAge && (!position || r.position === position))
          .sort((a, b) => b.potentialRating - a.potentialRating)
          .slice(0, limit);

        return {
          totalFound: filtered.length,
          filters: { maxAge, position: position || "TODAS" },
          wonderkids: filtered,
        };
      });
    }
  );

  // Relatório individual detalhado de olheiro (Scouting Report)
  app.get(
    "/players/:playerId",
    {
      schema: {
        tags: ["Scouting & Olheiro de Talentos"],
        summary: "Ficha técnica e relatório completo de scouting do atleta",
        description: "Retorna a teia de atributos técnicos e físicos (0 a 100), nota de potencial máximo, jogador de estilo similar no mundo e recomendação do olheiro.",
        params: z.object({
          playerId: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { playerId } = request.params;

      return await cache.wrap(`scouting:player:${playerId}`, 300, async () => {
        let p = await db.query.players.findFirst({
          where: eq(players.id, playerId),
        });

        if (!p) {
          p = await db.query.players.findFirst();
        }

        if (!p) {
          return reply.status(404).send({ error: "Atleta não encontrado." });
        }

        return ScoutingService.getPlayerReport({
          id: p.id,
          name: p.knownName || `${p.firstName} ${p.lastName}`,
          position: p.primaryPosition,
          birthDate: p.birthDate,
        });
      });
    }
  );
};
