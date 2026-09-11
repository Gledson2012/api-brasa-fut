import type { FastifyPluginAsync } from "fastify";
import { SofascoreSyncService } from "../services/sofascoreSync.js";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.get("/debug", async () => {
    const results: any = {};
    try {
      const { stdout } = await execFileAsync("curl", ["--version"]);
      results.curlVersion = stdout.split("\n")[0];
    } catch (e: any) {
      results.curlError = e.message;
    }

    try {
      const { stdout } = await execFileAsync("curl", [
        "-i",
        "-s",
        "-m",
        "5",
        "-A",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "https://api.sofascore.com/api/v1/unique-tournament/325/season/87678/rounds",
      ]);
      results.sofascoreResponse = stdout.slice(0, 300);
    } catch (e: any) {
      results.sofascoreError = e.message;
    }
    return results;
  });

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
