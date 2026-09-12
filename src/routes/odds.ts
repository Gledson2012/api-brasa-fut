import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { matches, teams } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { cache } from "../services/cache.js";
import { OddsService } from "../services/odds.js";

export const oddsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Odds e mercados para uma partida específica
  app.get(
    "/matches/:matchId",
    {
      schema: {
        tags: ["Apostas & Odds (Mercados Esportivos)"],
        summary: "Obter Odds completas e Fair Odds de uma partida",
        description: "Retorna cotações de 1X2, Over/Under de gols, Ambas Marcam e Dupla Hipótese comparadas entre Bet365, Betano e Betfair, acompanhadas das Fair Odds matemáticas.",
        params: z.object({
          matchId: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const { matchId } = request.params;

      return await cache.wrap(`odds:match:${matchId}`, 120, async () => {
        const match = await db.query.matches.findFirst({
          where: eq(matches.id, matchId),
          with: {
            homeTeam: true,
            awayTeam: true,
          },
        });

        if (!match || !match.homeTeam || !match.awayTeam) {
          // Fallback caso a partida não exista: buscar 2 primeiros times
          const sampleTeams = await db.select().from(teams).limit(2);
          if (sampleTeams.length < 2) {
            return reply.status(404).send({ error: "Partida ou times não encontrados." });
          }
          return OddsService.getOddsForMatch({
            id: matchId,
            homeTeam: { id: sampleTeams[0].id, name: sampleTeams[0].name },
            awayTeam: { id: sampleTeams[1].id, name: sampleTeams[1].name },
          });
        }

        return OddsService.getOddsForMatch({
          id: match.id,
          homeTeam: { id: match.homeTeam.id, name: match.homeTeam.name },
          awayTeam: { id: match.awayTeam.id, name: match.awayTeam.name },
        });
      });
    }
  );

  // Varredura de apostas com valor esperado positivo (Value Bets)
  app.get(
    "/value-bets",
    {
      schema: {
        tags: ["Apostas & Odds (Mercados Esportivos)"],
        summary: "Radar de Value Bets (Apostas com Valor Esperado Positivo - EV+)",
        description: "Compara as probabilidades matemáticas do modelo de IA contra as odds das casas de apostas, identificando distorções de mercado e oportunidades com EV+ lucrativo.",
        querystring: z.object({
          minEv: z.coerce.number().optional().default(3.0).describe("Valor esperado mínimo em porcentagem (ex: 3.0)"),
        }),
      },
    },
    async (request) => {
      const { minEv } = request.query;

      return await cache.wrap(`odds:value-bets:min-${minEv}`, 180, async () => {
        const matchesList = await db
          .select({
            id: matches.id,
            homeTeamId: matches.homeTeamId,
            awayTeamId: matches.awayTeamId,
          })
          .from(matches)
          .limit(10);

        const allTeams = await db.select().from(teams);
        const teamMap = new Map(allTeams.map((t) => [t.id, t]));

        const formattedMatches = matchesList
          .map((m) => {
            const h = teamMap.get(m.homeTeamId);
            const a = teamMap.get(m.awayTeamId);
            if (!h || !a) return null;
            return {
              id: m.id,
              homeTeam: { id: h.id, name: h.shortName || h.name },
              awayTeam: { id: a.id, name: a.shortName || a.name },
            };
          })
          .filter(Boolean) as Array<{
            id: number;
            homeTeam: { id: number; name: string };
            awayTeam: { id: number; name: string };
          }>;

        // Se não houver partidas cadastradas, montar lista com clubes existentes
        if (formattedMatches.length === 0 && allTeams.length >= 2) {
          for (let i = 0; i < Math.min(4, Math.floor(allTeams.length / 2)); i++) {
            formattedMatches.push({
              id: i + 1,
              homeTeam: { id: allTeams[i * 2].id, name: allTeams[i * 2].shortName || allTeams[i * 2].name },
              awayTeam: { id: allTeams[i * 2 + 1].id, name: allTeams[i * 2 + 1].shortName || allTeams[i * 2 + 1].name },
            });
          }
        }

        const results = OddsService.findValueBets(formattedMatches).filter(
          (vb) => vb.expectedValuePct >= minEv
        );

        return {
          totalFound: results.length,
          criteria: {
            minimumExpectedValuePct: minEv,
            analyzedBookmakers: ["Bet365", "Betano", "Betfair"],
          },
          opportunities: results,
        };
      });
    }
  );
};
