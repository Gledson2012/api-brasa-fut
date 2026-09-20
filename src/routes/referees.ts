import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { referees } from "../db/schema.js";
import { eq, ilike, sql } from "drizzle-orm";
import { cache } from "../services/cache.js";

const DEFAULT_REFEREES_SEED = [
  {
    name: "Wilton Pereira Sampaio",
    federation: "CBF / FIFA (GO)",
    matchesCount: 28,
    yellowCardsTotal: 142,
    redCardsTotal: 6,
    foulsAvg: "28.3",
    penaltiesTotal: 9,
    homeWinPct: 50,
    awayWinPct: 25,
    drawPct: 25,
    photoUrl: "https://img.sofascore.com/api/v1/referee/50700/image",
  },
  {
    name: "Raphael Claus",
    federation: "CBF / FIFA (SP)",
    matchesCount: 26,
    yellowCardsTotal: 128,
    redCardsTotal: 4,
    foulsAvg: "25.1",
    penaltiesTotal: 7,
    homeWinPct: 46,
    awayWinPct: 31,
    drawPct: 23,
    photoUrl: "https://img.sofascore.com/api/v1/referee/50699/image",
  },
  {
    name: "Anderson Daronco",
    federation: "CBF / FIFA (RS)",
    matchesCount: 25,
    yellowCardsTotal: 115,
    redCardsTotal: 5,
    foulsAvg: "26.4",
    penaltiesTotal: 8,
    homeWinPct: 52,
    awayWinPct: 24,
    drawPct: 24,
    photoUrl: "https://img.sofascore.com/api/v1/referee/50701/image",
  },
  {
    name: "Ramon Abatti Abel",
    federation: "CBF / FIFA (SC)",
    matchesCount: 24,
    yellowCardsTotal: 119,
    redCardsTotal: 3,
    foulsAvg: "24.8",
    penaltiesTotal: 6,
    homeWinPct: 42,
    awayWinPct: 33,
    drawPct: 25,
    photoUrl: "https://img.sofascore.com/api/v1/referee/834241/image",
  },
  {
    name: "Bráulio da Silva Machado",
    federation: "CBF / FIFA (SC)",
    matchesCount: 22,
    yellowCardsTotal: 124,
    redCardsTotal: 7,
    foulsAvg: "29.2",
    penaltiesTotal: 11,
    homeWinPct: 45,
    awayWinPct: 27,
    drawPct: 28,
    photoUrl: "https://img.sofascore.com/api/v1/referee/86212/image",
  },
  {
    name: "Edina Alves Batista",
    federation: "CBF / FIFA (SP)",
    matchesCount: 18,
    yellowCardsTotal: 86,
    redCardsTotal: 2,
    foulsAvg: "23.9",
    penaltiesTotal: 4,
    homeWinPct: 50,
    awayWinPct: 28,
    drawPct: 22,
    photoUrl: "https://img.sofascore.com/api/v1/referee/792617/image",
  },
];

/** Seed inicial de árbitros (schema garantido pelas migrations). */
async function ensureRefereesSeed() {
  try {
    const [res] = await db.select({ count: sql<number>`count(*)` }).from(referees);
    if (Number(res?.count) === 0) {
      for (const item of DEFAULT_REFEREES_SEED) {
        await db.insert(referees).values({
          name: item.name,
          federation: item.federation,
          matchesCount: item.matchesCount,
          yellowCardsTotal: item.yellowCardsTotal,
          redCardsTotal: item.redCardsTotal,
          foulsAvg: item.foulsAvg,
          penaltiesTotal: item.penaltiesTotal,
          homeWinPct: item.homeWinPct,
          awayWinPct: item.awayWinPct,
          drawPct: item.drawPct,
          photoUrl: item.photoUrl,
        });
      }
    }
  } catch {
    // Ignorar se erro durante criação
  }
}

export const refereesRoutes: FastifyPluginAsyncZod = async (app) => {
  // Listar árbitros com estatísticas resumidas
  app.get(
    "/",
    {
      schema: {
        tags: ["Arbitragem & Juízes"],
        summary: "Listar árbitros e juízes com estatísticas resumidas",
        description: "Retorna a relação de árbitros cadastrados nas competições, médias de cartões e tendências de apito.",
        querystring: z.object({
          search: z.string().optional().describe("Filtrar por nome do árbitro"),
          limit: z.coerce.number().min(1).max(50).default(20),
        }),
      },
    },
    async (request) => {
      const { search, limit } = request.query;
      await ensureRefereesSeed();

      const cacheKey = `referees:list:${search || "all"}:${limit}`;
      return await cache.wrap(cacheKey, 180, async () => {
        let query = db.select().from(referees);
        if (search && search.trim().length > 0) {
          query = query.where(ilike(referees.name, `%${search.trim()}%`)) as typeof query;
        }

        const rows = await query.limit(limit);
        return {
          total: rows.length,
          data: rows.map((r) => {
            const yAvg = r.matchesCount > 0 ? Number((r.yellowCardsTotal / r.matchesCount).toFixed(2)) : 0;
            const rAvg = r.matchesCount > 0 ? Number((r.redCardsTotal / r.matchesCount).toFixed(2)) : 0;
            const pAvg = r.matchesCount > 0 ? Number((r.penaltiesTotal / r.matchesCount).toFixed(2)) : 0;

            return {
              id: r.id,
              name: r.name,
              nationality: r.nationality,
              federation: r.federation,
              photoUrl: r.photoUrl,
              matchesCount: r.matchesCount,
              stats: {
                yellowCardsTotal: r.yellowCardsTotal,
                yellowCardsPerMatch: yAvg,
                redCardsTotal: r.redCardsTotal,
                redCardsPerMatch: rAvg,
                foulsPerMatch: parseFloat(r.foulsAvg || "26.0"),
                penaltiesTotal: r.penaltiesTotal,
                penaltiesPerMatch: pAvg,
                homeWinPct: r.homeWinPct,
                awayWinPct: r.awayWinPct,
                drawPct: r.drawPct,
              },
            };
          }),
        };
      });
    }
  );

  // Scout detalhado de um árbitro
  app.get(
    "/:id/stats",
    {
      schema: {
        tags: ["Arbitragem & Juízes"],
        summary: "Scout detalhado e estatísticas de arbitragem",
        description: "Médias de cartões amarelos, vermelhos, faltas marcadas por jogo, pênaltis assinalados e tendência de resultados (mandante vs visitante).",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      await ensureRefereesSeed();

      const [ref] = await db.select().from(referees).where(eq(referees.id, id));
      if (!ref) {
        return reply.status(404).send({ error: "Árbitro não encontrado." });
      }

      const yAvg = ref.matchesCount > 0 ? Number((ref.yellowCardsTotal / ref.matchesCount).toFixed(2)) : 0;
      const rAvg = ref.matchesCount > 0 ? Number((ref.redCardsTotal / ref.matchesCount).toFixed(2)) : 0;
      const pAvg = ref.matchesCount > 0 ? Number((ref.penaltiesTotal / ref.matchesCount).toFixed(2)) : 0;

      return {
        referee: {
          id: ref.id,
          name: ref.name,
          federation: ref.federation,
          nationality: ref.nationality,
          photoUrl: ref.photoUrl,
        },
        scout: {
          totalMatches: ref.matchesCount,
          yellowCards: {
            total: ref.yellowCardsTotal,
            averagePerMatch: yAvg,
          },
          redCards: {
            total: ref.redCardsTotal,
            averagePerMatch: rAvg,
          },
          fouls: {
            averagePerMatch: parseFloat(ref.foulsAvg || "26.0"),
          },
          penalties: {
            total: ref.penaltiesTotal,
            averagePerMatch: pAvg,
          },
          matchOutcomes: {
            homeWinPct: ref.homeWinPct,
            awayWinPct: ref.awayWinPct,
            drawPct: ref.drawPct,
          },
          profile:
            yAvg > 5.2
              ? "RIGOROSO (Média alta de advertências)"
              : yAvg < 4.2
              ? "PERMISSIVO (Deixa o jogo correr)"
              : "PADRÃO FIFA",
        },
      };
    }
  );
};
