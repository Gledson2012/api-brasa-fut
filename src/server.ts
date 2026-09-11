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

const app = fastify({
  logger: true,
}).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

async function bootstrap() {
  // CORS
  await app.register(cors, {
    origin: "*",
  });

  // WebSockets para tempo real
  await app.register(fastifyWebsocket);

  // Swagger OpenAPI Docs
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "BrasaFut API - Documentação Oficial",
        description:
          "API profissional de futebol de alta performance, com suporte a campeonatos brasileiros e internacionais, dados em tempo real, estatísticas de partidas e transmissões via WebSocket.",
        version: "1.0.0",
      },
      servers: [
        {
          url: `http://localhost:${process.env.PORT || 3333}`,
          description: "Servidor de Desenvolvimento",
        },
      ],
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

  await app.register(fastifySwaggerUi, {
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
        competitions: "/api/v1/competitions",
        teams: "/api/v1/teams",
        venues: "/api/v1/venues",
        players: "/api/v1/players",
        matches: "/api/v1/matches",
        matchesLive: "/api/v1/matches/live",
        standings: "/api/v1/standings?seasonId=1",
      },
    };
  });

  // Hook de Autenticação e Rate Limiting
  app.addHook("onRequest", authAndRateLimitMiddleware);

  // Registrar rotas modulares
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(webhookRoutes, { prefix: "/api/v1/webhooks" });
  await app.register(competitionRoutes, { prefix: "/api/v1/competitions" });
  await app.register(teamRoutes, { prefix: "/api/v1/teams" });
  await app.register(venueRoutes, { prefix: "/api/v1/venues" });
  await app.register(playerRoutes, { prefix: "/api/v1/players" });
  await app.register(matchRoutes, { prefix: "/api/v1/matches" });
  await app.register(standingsRoutes, { prefix: "/api/v1/standings" });
  await app.register(liveRoutes, { prefix: "/api/v1/live" });

  const port = Number(process.env.PORT) || 3333;
  const host = process.env.HOST || "0.0.0.0";

  try {
    await app.listen({ port, host });
    console.log(`\n🚀 BrasaFut API rodando em http://localhost:${port}`);
    console.log(`📖 Documentação Swagger em http://localhost:${port}/docs`);
    console.log(`⚡ WebSocket de Jogos Ao Vivo em ws://localhost:${port}/api/v1/live/ws\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
