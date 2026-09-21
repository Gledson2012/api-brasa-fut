import fastify from "fastify";
import cors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyWebsocket from "@fastify/websocket";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import * as dotenv from "dotenv";

import { competitionRoutes } from "./routes/competitions.js";
import { teamRoutes } from "./routes/teams.js";
import { venueRoutes } from "./routes/venues.js";
import { playerRoutes } from "./routes/players.js";
import { matchRoutes } from "./routes/matches.js";
import { standingsRoutes } from "./routes/standings.js";
import { liveRoutes } from "./routes/live.js";
import { authRoutes } from "./routes/auth.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { syncRoutes } from "./routes/sync.js";
import { billingRoutes } from "./routes/billing.js";
import { newsRoutes } from "./routes/news.js";
import { searchRoutes } from "./routes/search.js";
import { transfersRoutes } from "./routes/transfers.js";
import { refereesRoutes } from "./routes/referees.js";
import { exportRoutes } from "./routes/export.js";
import { injuryRoutes } from "./routes/injuries.js";
import { oddsRoutes } from "./routes/odds.js";
import { financeRoutes } from "./routes/finances.js";
import { scoutingRoutes } from "./routes/scouting.js";
import { authAndRateLimitMiddleware } from "./middleware/auth.js";

dotenv.config();

export function buildApp() {
  const app = fastify({
    logger: true,
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Remover fingerprint do framework
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.NODE_ENV === "production") {
      reply.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    }
    reply.removeHeader("X-Powered-By");
    return payload;
  });

  // CORS restritivo por ambiente (evita expor a API a qualquer origem em produção)
  const corsOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV === "production" && corsOrigins.length === 0) {
    console.warn(
      "⚠️ [cors] CORS_ORIGIN não configurado em produção. Defina domínios separados por vírgula."
    );
  }
  app.register(cors, {
    origin: corsOrigins.length > 0 ? corsOrigins : "*",
  });

  // WebSockets para tempo real (apenas fora do ambiente Serverless da Vercel)
  if (!process.env.VERCEL) {
    app.register(fastifyWebsocket);
  }

  // Swagger OpenAPI Docs
  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "BrasaFut API - Documentação Oficial",
        description:
          "API profissional de futebol de alta performance, com suporte a campeonatos brasileiros e internacionais, dados em tempo real, estatísticas de partidas e webhooks.",
        version: "1.1.0",
      },
      tags: [
        { name: "Autenticação & Planos", description: "Geração de chaves, limites e planos" },
        { name: "Billing & Monetização Pix", description: "Cobranças Pix dinâmicas, webhooks de pagamento e upgrade de planos" },
        { name: "Webhooks", description: "Disparo e auditoria de notificações instantâneas" },
        { name: "Partidas", description: "Jogos, placares ao vivo, eventos e estatísticas" },
        { name: "Partidas - Operações em Tempo Real", description: "Disparo e sincronização de lances e placar" },
        { name: "Classificação", description: "Tabelas e pontuação das ligas" },
        { name: "Clubes", description: "Times, elencos e estádios mandantes" },
        { name: "Atletas", description: "Jogadores, scouts e dados físicos" },
        { name: "Competições", description: "Ligas, copas e temporadas" },
        { name: "Estádios", description: "Praças esportivas, capacidade e cidades" },
        { name: "Notícias & Imprensa", description: "Feed de notícias de futebol em tempo real da ESPN Brasil" },
        { name: "Busca Global", description: "Busca unificada em clubes, atletas, competições e notícias" },
        { name: "Mercado da Bola & Transferências", description: "Histórico e movimentações de transferências de atletas entre clubes" },
        { name: "Arbitragem & Juízes", description: "Scouts de árbitros, médias de cartões, faltas e tendências de apito" },
        { name: "Exportação de Dados", description: "Download de tabelas, partidas e scouts em formato CSV" },
      ],
      components: {
        securitySchemes: {
          apiKeyAuth: {
            type: "apiKey",
            name: "x-api-key",
            in: "header",
            description: "Chave de acesso obtida via /api/v1/auth/register",
          },
        },
      },
      security: [
        {
          apiKeyAuth: [],
        },
      ],
    },
    transform: jsonSchemaTransform,
  });

  app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });

  // Rota raiz e status
  app.get("/health", async () => {
    return {
      status: "ok",
      version: "1.1.0",
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/api/v1/health", async () => {
    return {
      status: "ok",
      version: "1.1.0",
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/", async () => {
    return {
      name: "BrasaFut API",
      status: "online",
      version: "1.1.0",
      documentation: "/docs",
      realtimeWebSocket: "/api/v1/live/ws",
      endpoints: {
        authRegister: "POST /api/v1/auth/register",
        authPlans: "GET /api/v1/auth/plans",
        competitions: "/api/v1/competitions",
        teams: "/api/v1/teams",
        teamFixtures: "/api/v1/teams/:id/fixtures",
        venues: "/api/v1/venues",
        players: "/api/v1/players",
        playerCompare: "/api/v1/players/compare?p1=X&p2=Y",
        matches: "/api/v1/matches",
        matchesLive: "/api/v1/matches/live",
        standings: "/api/v1/standings?seasonId=3",
        standingsLive: "/api/v1/standings/live?seasonId=3",
        webhooks: "/api/v1/webhooks",
        syncSofascore: "/api/v1/sync/sofascore",
        billingCheckout: "POST /api/v1/billing/checkout",
        news: "/api/v1/news",
        newsLeagues: "/api/v1/news/leagues",
        search: "/api/v1/search?q=Flamengo",
        transfers: "/api/v1/transfers",
        matchPredictions: "/api/v1/matches/:id/predictions",
        matchMomentum: "/api/v1/matches/:id/momentum",
        matchShotMap: "/api/v1/matches/:id/shot-map",
        matchAbsences: "/api/v1/matches/:id/absences",
        matchFantasy: "/api/v1/matches/:id/fantasy",
        playerFantasy: "/api/v1/players/:id/fantasy",
        teamAbsences: "/api/v1/teams/:id/absences",
        teamH2H: "/api/v1/teams/:team1Id/vs/:team2Id",
        teamCompare: "/api/v1/teams/compare?team1=1&team2=2",
        teamTrophies: "/api/v1/teams/:id/trophies",
        competitionChampions: "/api/v1/competitions/:id/champions",
        competitionTotw: "/api/v1/competitions/:id/team-of-the-week?round=26",
        matchHeatmap: "/api/v1/matches/:id/heatmap",
        matchLineups: "/api/v1/matches/:id/lineups",
        playerHeatmap: "/api/v1/players/:id/heatmap",
        oddsMatch: "/api/v1/odds/matches/:matchId",
        oddsValueBets: "/api/v1/odds/value-bets",
        injuriesReport: "/api/v1/injuries/report",
        injuriesTeam: "/api/v1/injuries/teams/:teamId",
        standingsSimulate: "POST /api/v1/standings/simulate",
        standingsSupercomputer: "/api/v1/standings/supercomputer?seasonId=1",
        matchBroadcast: "/api/v1/matches/:id/broadcast",
        matchCommentary: "/api/v1/matches/:id/commentary",
        financesTeam: "/api/v1/finances/teams/:teamId",
        financesRanking: "/api/v1/finances/ranking?seasonId=1",
        scoutingTalents: "/api/v1/scouting/talents?maxAge=22",
        scoutingPlayer: "/api/v1/scouting/players/:playerId",
        referees: "/api/v1/referees",
        exportStandings: "/api/v1/export/standings?seasonId=1",
        exportPlayers: "/api/v1/export/players?seasonId=1",
        exportMatches: "/api/v1/export/matches?seasonId=1",
      },
    };
  });

  // Hook de Autenticação e Rate Limiting
  app.addHook("onRequest", authAndRateLimitMiddleware);

  // Registrar rotas modulares
  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(billingRoutes, { prefix: "/api/v1/billing" });
  app.register(webhookRoutes, { prefix: "/api/v1/webhooks" });
  app.register(competitionRoutes, { prefix: "/api/v1/competitions" });
  app.register(teamRoutes, { prefix: "/api/v1/teams" });
  app.register(venueRoutes, { prefix: "/api/v1/venues" });
  app.register(playerRoutes, { prefix: "/api/v1/players" });
  app.register(matchRoutes, { prefix: "/api/v1/matches" });
  app.register(standingsRoutes, { prefix: "/api/v1/standings" });
  app.register(liveRoutes, { prefix: "/api/v1/live" });
  app.register(syncRoutes, { prefix: "/api/v1/sync" });
  app.register(newsRoutes, { prefix: "/api/v1/news" });
  app.register(searchRoutes, { prefix: "/api/v1/search" });
  app.register(transfersRoutes, { prefix: "/api/v1/transfers" });
  app.register(refereesRoutes, { prefix: "/api/v1/referees" });
  app.register(exportRoutes, { prefix: "/api/v1/export" });
  app.register(injuryRoutes, { prefix: "/api/v1/injuries" });
  app.register(oddsRoutes, { prefix: "/api/v1/odds" });
  app.register(financeRoutes, { prefix: "/api/v1/finances" });
  app.register(scoutingRoutes, { prefix: "/api/v1/scouting" });

  return app;
}

export const app = buildApp();

export default async function handler(req: any, res: any) {
  await app.ready();
  await new Promise<void>((resolve, reject) => {
    res.on("finish", resolve);
    res.on("close", resolve);
    res.on("error", reject);
    app.server.emit("request", req, res);
  });
}
