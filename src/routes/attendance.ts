import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { AttendanceService } from "../services/attendance.js";
import { db } from "../db/index.js";
import { venues } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const attendanceRoutes: FastifyPluginAsyncZod = async (app) => {
  // 1. Ranking de público pagante e renda de bilheteria da competição
  app.get(
    "/competitions/:id",
    {
      schema: {
        tags: ["Público & Bilheteria dos Estádios"],
        summary: "Ranking de público, bilheteria e ocupação da competição",
        description:
          "Relatório financeiro e de engajamento das torcidas: média de público pagante por clube, taxa de ocupação da arena (%), renda bruta acumulada e preço médio do ingresso.",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request) => {
      const { id } = request.params;
      return AttendanceService.getCompetitionAttendanceRanking(id);
    }
  );

  // 2. Histórico e recordes de público de um estádio
  app.get(
    "/venues/:id",
    {
      schema: {
        tags: ["Público & Bilheteria dos Estádios"],
        summary: "Estatísticas e recorde histórico de público de um estádio",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const [venue] = await db
        .select({
          id: venues.id,
          name: venues.name,
          capacity: venues.capacity,
        })
        .from(venues)
        .where(eq(venues.id, id))
        .limit(1);

      if (!venue) {
        return reply.status(404).send({ error: `Estádio com ID ${id} não encontrado.` });
      }

      return AttendanceService.getVenueAttendanceRecords(venue.id, venue.name, venue.capacity || 50000);
    }
  );
};
