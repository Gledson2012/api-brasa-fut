import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { transfers, teams, players } from "../db/schema.js";
import { desc, eq, or, ilike, and, sql, count } from "drizzle-orm";
import { cache } from "../services/cache.js";
import { paginate } from "../utils/pagination.js";
import { unaccentIlike } from "../utils/search.js";

// Lista de transferências iniciais padrão para seed automático caso a tabela esteja zerada
const DEFAULT_TRANSFERS_SEED = [
  {
    playerName: "Memphis Depay",
    fromTeamName: "Atlético de Madrid",
    toTeamName: "Corinthians",
    type: "FREE_AGENT",
    transferDate: "2024-09-09",
    feeAmount: "Grátis",
    marketValue: "€ 10.00M",
    position: "FORWARD",
    contractUntil: "2026-12-31",
    photoUrl: "https://img.sofascore.com/api/v1/player/138534/image",
  },
  {
    playerName: "Thiago Silva",
    fromTeamName: "Chelsea",
    toTeamName: "Fluminense",
    type: "FREE_AGENT",
    transferDate: "2024-07-01",
    feeAmount: "Grátis",
    marketValue: "€ 1.00M",
    position: "DEFENDER",
    contractUntil: "2026-06-30",
    photoUrl: "https://img.sofascore.com/api/v1/player/18029/image",
  },
  {
    playerName: "Luiz Henrique",
    fromTeamName: "Real Betis",
    toTeamName: "Botafogo",
    type: "PERMANENT",
    transferDate: "2024-02-01",
    feeAmount: "€ 16.00M",
    marketValue: "€ 16.00M",
    position: "FORWARD",
    contractUntil: "2028-12-31",
    photoUrl: "https://img.sofascore.com/api/v1/player/1018861/image",
  },
  {
    playerName: "Thiago Almada",
    fromTeamName: "Atlanta United",
    toTeamName: "Botafogo",
    type: "PERMANENT",
    transferDate: "2024-07-06",
    feeAmount: "€ 19.50M",
    marketValue: "€ 27.00M",
    position: "MIDFIELDER",
    contractUntil: "2029-06-30",
    photoUrl: "https://img.sofascore.com/api/v1/player/965158/image",
  },
  {
    playerName: "Felipe Anderson",
    fromTeamName: "Lazio",
    toTeamName: "Palmeiras",
    type: "FREE_AGENT",
    transferDate: "2024-07-01",
    feeAmount: "Grátis",
    marketValue: "€ 8.00M",
    position: "MIDFIELDER",
    contractUntil: "2027-12-31",
    photoUrl: "https://img.sofascore.com/api/v1/player/163013/image",
  },
  {
    playerName: "Carlos Alcaraz",
    fromTeamName: "Southampton",
    toTeamName: "Flamengo",
    type: "PERMANENT",
    transferDate: "2024-08-28",
    feeAmount: "€ 18.00M",
    marketValue: "€ 15.00M",
    position: "MIDFIELDER",
    contractUntil: "2029-08-31",
    photoUrl: "https://img.sofascore.com/api/v1/player/1032549/image",
  },
  {
    playerName: "Kylian Mbappé",
    fromTeamName: "Paris Saint-Germain",
    toTeamName: "Real Madrid",
    type: "FREE_AGENT",
    transferDate: "2024-07-01",
    feeAmount: "Grátis",
    marketValue: "€ 180.00M",
    position: "FORWARD",
    contractUntil: "2029-06-30",
    photoUrl: "https://img.sofascore.com/api/v1/player/826643/image",
  },
  {
    playerName: "Julián Álvarez",
    fromTeamName: "Manchester City",
    toTeamName: "Atlético de Madrid",
    type: "PERMANENT",
    transferDate: "2024-08-12",
    feeAmount: "€ 75.00M",
    marketValue: "€ 90.00M",
    position: "FORWARD",
    contractUntil: "2030-06-30",
    photoUrl: "https://img.sofascore.com/api/v1/player/951809/image",
  },
  {
    playerName: "Dani Olmo",
    fromTeamName: "RB Leipzig",
    toTeamName: "Barcelona",
    type: "PERMANENT",
    transferDate: "2024-08-09",
    feeAmount: "€ 55.00M",
    marketValue: "€ 60.00M",
    position: "MIDFIELDER",
    contractUntil: "2030-06-30",
    photoUrl: "https://img.sofascore.com/api/v1/player/787265/image",
  },
  {
    playerName: "Endrick",
    fromTeamName: "Palmeiras",
    toTeamName: "Real Madrid",
    type: "PERMANENT",
    transferDate: "2024-07-21",
    feeAmount: "€ 47.50M",
    marketValue: "€ 60.00M",
    position: "FORWARD",
    contractUntil: "2030-06-30",
    photoUrl: "https://img.sofascore.com/api/v1/player/1173950/image",
  },
  {
    playerName: "Philippe Coutinho",
    fromTeamName: "Aston Villa",
    toTeamName: "Vasco da Gama",
    type: "LOAN",
    transferDate: "2024-07-10",
    feeAmount: "Empréstimo",
    marketValue: "€ 7.50M",
    position: "MIDFIELDER",
    contractUntil: "2025-06-30",
    photoUrl: "https://img.sofascore.com/api/v1/player/87103/image",
  },
  {
    playerName: "Everton Ribeiro",
    fromTeamName: "Flamengo",
    toTeamName: "Bahia",
    type: "FREE_AGENT",
    transferDate: "2024-01-06",
    feeAmount: "Grátis",
    marketValue: "€ 2.00M",
    position: "MIDFIELDER",
    contractUntil: "2025-12-31",
    photoUrl: "https://img.sofascore.com/api/v1/player/36979/image",
  },
];

export const transfersRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["Mercado da Bola & Transferências"],
        summary: "Consultar movimentações do Mercado da Bola e transferências confirmadas",
        description:
          "Retorna o histórico e as últimas transferências de atletas entre clubes (compras definitivas, empréstimos e contratações livres), incluindo valores envolvidos e resumo do mercado.",
        querystring: z.object({
          page: z.coerce.number().min(1).default(1),
          limit: z.coerce.number().min(1).max(100).default(20),
          teamId: z.coerce.number().optional().describe("Filtrar por clube (origem ou destino)"),
          playerId: z.coerce.number().optional().describe("Filtrar por atleta"),
          type: z
            .enum(["PERMANENT", "LOAN", "FREE_AGENT", "END_OF_LOAN"])
            .optional()
            .describe("Tipo de negociação"),
          q: z.string().optional().describe("Buscar por atleta ou clube"),
        }),
      },
    },
    async (request) => {
      const { page, limit, teamId, playerId, type, q } = request.query;
      const offset = (page - 1) * limit;

      const cacheKey = `transfers:p${page}:l${limit}:t${teamId || 0}:p${playerId || 0}:${type || "all"}:${q || "none"}`;

      return await cache.wrap(cacheKey, 60, async () => {
        // Garantir que a tabela existe caso não tenha sido executada migração
        try {
          const check = await db.select({ total: count() }).from(transfers);
          if (check[0]?.total === 0) {
            // Fazer seed inicial de transferências com vínculo aos clubes caso existam
            for (const item of DEFAULT_TRANSFERS_SEED) {
              const [foundToTeam] = await db
                .select({ id: teams.id })
                .from(teams)
                .where(ilike(teams.name, `%${item.toTeamName}%`))
                .limit(1);

              const [foundFromTeam] = await db
                .select({ id: teams.id })
                .from(teams)
                .where(ilike(teams.name, `%${item.fromTeamName}%`))
                .limit(1);

              const [foundPlayer] = await db
                .select({ id: players.id })
                .from(players)
                .where(
                  or(
                    ilike(players.knownName, `%${item.playerName}%`),
                    ilike(players.lastName, `%${item.playerName}%`)
                  )
                )
                .limit(1);

              await db.insert(transfers).values({
                playerId: foundPlayer?.id || null,
                playerName: item.playerName,
                fromTeamId: foundFromTeam?.id || null,
                fromTeamName: item.fromTeamName,
                toTeamId: foundToTeam?.id || null,
                toTeamName: item.toTeamName,
                type: item.type,
                transferDate: item.transferDate,
                feeAmount: item.feeAmount,
                marketValue: item.marketValue,
                contractUntil: item.contractUntil,
                position: item.position,
                photoUrl: item.photoUrl,
              });
            }
          }
        } catch {
          // Se a tabela transfers não existir no banco de dados ainda, criá-la dinamicamente
          const { client } = await import("../db/index.js");
          await client.unsafe(`
            CREATE TABLE IF NOT EXISTS transfers (
              id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
              player_id BIGINT REFERENCES players(id) ON DELETE SET NULL,
              player_name VARCHAR(150) NOT NULL,
              from_team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
              from_team_name VARCHAR(120) NOT NULL,
              to_team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
              to_team_name VARCHAR(120) NOT NULL,
              type VARCHAR(50) DEFAULT 'PERMANENT' NOT NULL,
              transfer_date DATE NOT NULL,
              fee_amount VARCHAR(50),
              market_value VARCHAR(50),
              contract_until DATE,
              position VARCHAR(50),
              photo_url TEXT,
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_transfers_player_id ON transfers (player_id);
            CREATE INDEX IF NOT EXISTS idx_transfers_from_team_id ON transfers (from_team_id);
            CREATE INDEX IF NOT EXISTS idx_transfers_to_team_id ON transfers (to_team_id);
            CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers (transfer_date);
          `);

          for (const item of DEFAULT_TRANSFERS_SEED) {
            await client.unsafe(
              `INSERT INTO transfers (player_name, from_team_name, to_team_name, type, transfer_date, fee_amount, market_value, position, photo_url)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                item.playerName,
                item.fromTeamName,
                item.toTeamName,
                item.type,
                item.transferDate,
                item.feeAmount,
                item.marketValue,
                item.position,
                item.photoUrl,
              ]
            );
          }
        }

        // Construção de filtros
        const conditions = [];

        if (teamId) {
          conditions.push(or(eq(transfers.fromTeamId, teamId), eq(transfers.toTeamId, teamId)));
        }

        if (playerId) {
          conditions.push(eq(transfers.playerId, playerId));
        }

        if (type) {
          conditions.push(eq(transfers.type, type));
        }

        if (q && q.trim().length > 0) {
          const cleanQ = q.trim();
          conditions.push(
            or(
              unaccentIlike(transfers.playerName, cleanQ),
              unaccentIlike(transfers.fromTeamName, cleanQ),
              unaccentIlike(transfers.toTeamName, cleanQ)
            )
          );
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Contagem total
        const [totalCount] = await db
          .select({ count: count() })
          .from(transfers)
          .where(whereClause);

        const total = totalCount?.count || 0;

        // Consulta de registros ordenados por data decrescente
        const rows = await db
          .select({
            id: transfers.id,
            playerId: transfers.playerId,
            playerName: transfers.playerName,
            fromTeamId: transfers.fromTeamId,
            fromTeamName: transfers.fromTeamName,
            toTeamId: transfers.toTeamId,
            toTeamName: transfers.toTeamName,
            type: transfers.type,
            transferDate: transfers.transferDate,
            feeAmount: transfers.feeAmount,
            marketValue: transfers.marketValue,
            contractUntil: transfers.contractUntil,
            position: transfers.position,
            photoUrl: transfers.photoUrl,
            createdAt: transfers.createdAt,
          })
          .from(transfers)
          .where(whereClause)
          .orderBy(desc(transfers.transferDate), desc(transfers.id))
          .limit(limit)
          .offset(offset);

        // Buscar dados extras dos times vinculados (logos)
        const teamIds = new Set<number>();
        for (const r of rows) {
          if (r.fromTeamId) teamIds.add(r.fromTeamId);
          if (r.toTeamId) teamIds.add(r.toTeamId);
        }

        const teamMap = new Map<number, { logoUrl: string | null; shortName: string | null }>();
        if (teamIds.size > 0) {
          const teamDetails = await db
            .select({
              id: teams.id,
              logoUrl: teams.logoUrl,
              shortName: teams.shortName,
            })
            .from(teams)
            .where(sql`${teams.id} IN ${Array.from(teamIds)}`);

          for (const t of teamDetails) {
            teamMap.set(t.id, { logoUrl: t.logoUrl, shortName: t.shortName });
          }
        }

        const formatted = rows.map((r) => ({
          id: r.id,
          player: {
            id: r.playerId,
            name: r.playerName,
            position: r.position,
            photoUrl: r.photoUrl,
          },
          fromTeam: {
            id: r.fromTeamId,
            name: r.fromTeamName,
            shortName: r.fromTeamId ? teamMap.get(r.fromTeamId)?.shortName : null,
            logoUrl: r.fromTeamId ? teamMap.get(r.fromTeamId)?.logoUrl : null,
          },
          toTeam: {
            id: r.toTeamId,
            name: r.toTeamName,
            shortName: r.toTeamId ? teamMap.get(r.toTeamId)?.shortName : null,
            logoUrl: r.toTeamId ? teamMap.get(r.toTeamId)?.logoUrl : null,
          },
          type: r.type,
          transferDate: r.transferDate,
          feeAmount: r.feeAmount,
          marketValue: r.marketValue,
          contractUntil: r.contractUntil,
        }));

        return paginate(page, limit, total, formatted, {
          marketSummary: {
            totalTransfers: total,
            topTransfers: formatted.slice(0, 3).map((t) => ({
              player: t.player.name,
              deal: `${t.fromTeam.name} ➔ ${t.toTeam.name}`,
              fee: t.feeAmount,
            })),
          },
        });
      });
    }
  );
};
