import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { VarService } from "../services/var.js";
import { db } from "../db/index.js";
import { matches, teams } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const varRoutes: FastifyPluginAsyncZod = async (app) => {
  // 1. Relatório de intervenções do VAR de uma partida
  app.get(
    "/matches/:id",
    {
      schema: {
        tags: ["Central do VAR & Arbitragem"],
        summary: "Auditoria de lances checados pelo VAR na partida",
        description:
          "Retorna a cronologia de lances revisados pelo VAR em um jogo (pênaltis, impedimentos milimétricos, cartões vermelhos), tempo de paralisação e transcrição do diálogo da cabine com o árbitro de campo.",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const [match] = await db
        .select({
          id: matches.id,
          homeTeamId: matches.homeTeamId,
          awayTeamId: matches.awayTeamId,
        })
        .from(matches)
        .where(eq(matches.id, id))
        .limit(1);

      let hName = "Mandante";
      let aName = "Visitante";

      if (match) {
        const [home] = await db.select({ name: teams.shortName }).from(teams).where(eq(teams.id, match.homeTeamId)).limit(1);
        const [away] = await db.select({ name: teams.shortName }).from(teams).where(eq(teams.id, match.awayTeamId)).limit(1);
        if (home?.name) hName = home.name;
        if (away?.name) aName = away.name;
      }

      return VarService.getMatchVarReport(id, hName, aName);
    }
  );

  // 2. Tabela de classificação do VAR Líquido
  app.get(
    "/competitions/:id/table",
    {
      schema: {
        tags: ["Central do VAR & Arbitragem"],
        summary: "Tabela oficial do VAR Líquido (Impacto de decisões de arbitragem de vídeo)",
        description:
          "Ranking completo dos clubes beneficiados vs prejudicados pelo VAR na competição, saldo líquido de intervenções, gols concedidos/anulados e impacto estimado em pontos.",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request) => {
      const { id } = request.params;
      return VarService.getCompetitionVarTable(id);
    }
  );
};
