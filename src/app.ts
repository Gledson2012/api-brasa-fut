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
import { authAndRateLimitMiddleware } from "./middleware/auth.js";

dotenv.config();

export function buildApp() {
  const app = fastify({
    logger: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // CORS
  app.register(cors, {
    origin: "*",
  });

  // WebSockets para tempo real (ativo em servidores com suporte a conexões contínuas)
  app.register(fastifyWebsocket);

  // Swagger OpenAPI Docs
  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "BrasaFut API - Documentação Oficial",
        description:
          "API profissional de futebol de alta performance, com suporte a campeonatos brasileiros e internacionais, dados em tempo real, estatísticas de partidas e webhooks.",
        version: "1.0.0",
      },
      tags: [
        { name: "Autenticação & Planos", description: "Geração de chaves, limites e planos" },
        { name: "Webhooks", description: "Disparo e auditoria de notificações instantâneas" },
        { name: "Partidas", description: "Jogos, placares ao vivo, eventos e estatísticas" },
        { name: "Partidas - Operações em Tempo Real", description: "Disparo e sincronização de lances e placar" },
        { name: "Classificação", description: "Tabelas e pontuação das ligas" },
        { name: "Clubes", description: "Times, elencos e estádios mandantes" },
        { name: "Atletas", description: "Jogadores, scouts e dados físicos" },
        { name: "Competições", description: "Ligas, copas e temporadas" },
        { name: "Estádios", description: "Praças esportivas, capacidade e cidades" },
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
  app.get("/", async () => {
    return {
      name: "BrasaFut API",
      status: "online",
      version: "1.0.0",
      documentation: "/docs",
      realtimeWebSocket: "/api/v1/live/ws",
      endpoints: {
        authRegister: "POST /api/v1/auth/register",
        authPlans: "GET /api/v1/auth/plans",
        competitions: "/api/v1/competitions",
        teams: "/api/v1/teams",
        venues: "/api/v1/venues",
        players: "/api/v1/players",
        matches: "/api/v1/matches",
        matchesLive: "/api/v1/matches/live",
        standings: "/api/v1/standings?seasonId=3",
        webhooks: "/api/v1/webhooks",
      },
    };
  });

  // Hook de Autenticação e Rate Limiting
  app.addHook("onRequest", authAndRateLimitMiddleware);

  // Registrar rotas modulares
  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(webhookRoutes, { prefix: "/api/v1/webhooks" });
  app.register(competitionRoutes, { prefix: "/api/v1/competitions" });
  app.register(teamRoutes, { prefix: "/api/v1/teams" });
  app.register(venueRoutes, { prefix: "/api/v1/venues" });
  app.register(playerRoutes, { prefix: "/api/v1/players" });
  app.register(matchRoutes, { prefix: "/api/v1/matches" });
  app.register(standingsRoutes, { prefix: "/api/v1/standings" });
  app.register(liveRoutes, { prefix: "/api/v1/live" });

  return app;
}
