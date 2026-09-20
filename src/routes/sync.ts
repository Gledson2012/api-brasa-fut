import type { FastifyPluginAsync } from "fastify";
import { SofascoreSyncService } from "../services/sofascoreSync.js";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireAdminOrPlan } from "../middleware/auth.js";

const execFileAsync = promisify(execFile);

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.get("/debug", async (request, reply) => {
    if (!requireAdminOrPlan(request, reply, ["ENTERPRISE"])) return;

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
      const { liveOnly, force, leagues } = (request.query || {}) as {
        liveOnly?: string;
        force?: string;
        leagues?: string;
      };
      const result = await SofascoreSyncService.sync(force === "true", {
        liveOnly: liveOnly === "true",
        leagues: leagues ? leagues.split(",") : undefined,
      });
      return result;
    }
  );

  app.get(
    "/live",
    {
      schema: {
        tags: ["Sincronização"],
        summary: "Sincronização ultra-rápida (sub-segundo) apenas das partidas ao vivo",
      },
    },
    async () => {
      const result = await SofascoreSyncService.syncLiveMatchesDirect();
      return result;
    }
  );

  app.get(
    "/fix-logos",
    {
      schema: {
        tags: ["Sincronização"],
        summary: "Atualizar escudos legados para o CDN oficial do Sofascore (Admin)",
      },
    },
    async (request, reply) => {
      if (!requireAdminOrPlan(request, reply, ["ENTERPRISE"])) return;

      const { client } = await import("../db/index.js");
      const updates = [
        { name: "Flamengo", id: 5981 },
        { name: "Palmeiras", id: 1963 },
        { name: "São Paulo", id: 1981 },
        { name: "Corinthians", id: 1957 },
        { name: "Botafogo", id: 1958 },
        { name: "Fluminense", id: 1961 },
        { name: "Vasco da Gama", id: 1974 },
        { name: "Atlético Mineiro", id: 1977 },
        { name: "Cruzeiro", id: 1954 },
        { name: "Internacional", id: 1966 },
        { name: "Grêmio", id: 5926 },
        { name: "Bahia", id: 1955 },
        { name: "Fortaleza", id: 2020 },
        { name: "Athletico Paranaense", id: 1967 },
      ];

      for (const t of updates) {
        const logo = `https://api.sofascore.app/api/v1/team/${t.id}/image`;
        await client`UPDATE teams SET logo_url = ${logo} WHERE name ILIKE ${'%' + t.name + '%'};`;
      }

      return { success: true, message: "Escudos atualizados com sucesso para CDN Sofascore!", count: updates.length };
    }
  );

  app.post(
    "/sofascore",
    {
      schema: {
        tags: ["Sincronização"],
        summary: "Forçar sincronização imediata com Sofascore (ignora cache - Admin)",
      },
    },
    async (request, reply) => {
      if (!requireAdminOrPlan(request, reply, ["ENTERPRISE"])) return;
      const { liveOnly, leagues } = (request.query || {}) as {
        liveOnly?: string;
        leagues?: string;
      };
      const result = await SofascoreSyncService.sync(true, {
        liveOnly: liveOnly === "true",
        leagues: leagues ? leagues.split(",") : undefined,
      });
      return result;
    }
  );

  app.post(
    "/push",
    {
      schema: {
        tags: ["Sincronização"],
        summary: "Receber e persistir eventos e tabela do Sofascore via Push Worker (Admin/Worker)",
      },
    },
    async (request, reply) => {
      if (!requireAdminOrPlan(request, reply, ["ENTERPRISE", "PRO"])) return;

      const body = request.body as {
        events?: any[];
        standings?: any[];
        currentRound?: number;
        competitionCode?: string;
        competitionMeta?: any;
      };

      if (!body || (!body.events && !body.standings)) {
        return reply.status(400).send({
          success: false,
          message: "Payload inválido. Envie 'events' ou 'standings'.",
        });
      }

      const result = await SofascoreSyncService.processData(
        body.events || [],
        body.standings || [],
        body.currentRound || 27,
        body.competitionCode || "BRA-1",
        body.competitionMeta
      );

      return result;
    }
  );
};
