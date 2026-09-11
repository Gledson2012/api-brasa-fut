import type { FastifyPluginAsync } from "fastify";
import { SofascoreSyncService } from "../services/sofascoreSync.js";

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/sofascore",
    {
      schema: {
        tags: ["Sincronização"],
        summary: "Sincronizar partidas e tabela em tempo real via Sofascore (cache 60s)",
      },
    },
    async (request, reply) => {
      const result = await SofascoreSyncService.sync(false);
      return result;
    }
  );

  app.post(
    "/sofascore",
    {
      schema: {
        tags: ["Sincronização"],
        summary: "Forçar sincronização imediata com Sofascore (ignora cache)",
      },
    },
    async (request, reply) => {
      const result = await SofascoreSyncService.sync(true);
      return result;
    }
  );
};
