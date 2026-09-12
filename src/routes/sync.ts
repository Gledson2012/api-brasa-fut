import type { FastifyPluginAsync } from "fastify";
import { SofascoreSyncService } from "../services/sofascoreSync.js";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireAdminOrPlan } from "../middleware/auth.js";

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

  app.get(
    "/fix-logos",
    {
      schema: {
        tags: ["Sincronização"],
        summary: "Atualizar escudos legados para o CDN oficial do Sofascore",
      },
    },
    async () => {
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

  app.get(
    "/setup-enterprise",
    {
      schema: {
        tags: ["Sincronização"],
        summary: "Configurar conta ENTERPRISE e migrar tabela api_keys",
      },
    },
    async () => {
      const { client } = await import("../db/index.js");
      const { hashPassword } = await import("../utils/password.js");

      // 1. Garantir que a coluna password_hash existe
      await client`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);`;

      const passHash = hashPassword("BrasaFut@Enterprise2026");
      const key = "bf_live_enterprise_9f83a21c45e87b60d4e92a11bf738e45";

      // 2. Upsert conta ENTERPRISE
      await client`
        INSERT INTO api_keys (user_name, email, password_hash, key, plan, rate_limit_per_minute, is_active)
        VALUES ('enterprise_admin', 'enterprise@brasafut.com.br', ${passHash}, ${key}, 'ENTERPRISE', 1000, true)
        ON CONFLICT (email) DO UPDATE SET
          user_name = EXCLUDED.user_name,
          password_hash = EXCLUDED.password_hash,
          key = EXCLUDED.key,
          plan = 'ENTERPRISE',
          rate_limit_per_minute = 1000,
          is_active = true,
          updated_at = NOW();
      `;

      return {
        success: true,
        message: "Conta ENTERPRISE configurada e sincronizada com sucesso!",
        email: "enterprise@brasafut.com.br",
        userName: "enterprise_admin",
        plan: "ENTERPRISE",
        rateLimitPerMinute: 1000,
        apiKey: key,
      };
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
      const result = await SofascoreSyncService.sync(true);
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
        body.competitionCode || "BRA-1"
      );

      return result;
    }
  );
};
