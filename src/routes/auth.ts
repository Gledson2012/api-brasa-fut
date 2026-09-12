import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";
import { eq, or } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "../utils/password.js";

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // Planos disponíveis
  app.get(
    "/plans",
    {
      schema: {
        tags: ["Autenticação & Planos"],
        summary: "Listar planos e limites de requisição",
      },
    },
    async () => {
      return [
        {
          plan: "FREE",
          rateLimitPerMinute: 10,
          price: "R$ 0,00",
          features: [
            "Acesso a todas as partidas, clubes e atletas",
            "10 requisições por minuto",
            "Suporte a WebSockets ao vivo",
          ],
        },
        {
          plan: "PRO",
          rateLimitPerMinute: 120,
          price: "R$ 49,90/mês",
          features: [
            "Acesso completo a estatísticas avançadas e H2H",
            "120 requisições por minuto",
            "WebSockets sem restrição de canais",
            "Suporte prioritário",
          ],
        },
        {
          plan: "ENTERPRISE",
          rateLimitPerMinute: 1000,
          price: "Sob consulta",
          features: [
            "Taxa de 1.000 requisições por minuto",
            "SLA de 99.9% de uptime",
            "Webhooks dedicados",
            "Acesso irrestrito a todos os recursos da API",
          ],
        },
      ];
    }
  );

  // Registrar desenvolvedor e obter nova API Key (com senha opcional/recomendada)
  app.post(
    "/register",
    {
      schema: {
        tags: ["Autenticação & Planos"],
        summary: "Registrar desenvolvedor e gerar chave de API (API Key)",
        description: "Gera instantaneamente uma chave no formato 'bf_live_...' para consumir a API. Aceita senha para possibilitar login posterior.",
        body: z.object({
          userName: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
          email: z.string().email("E-mail inválido"),
          password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional(),
        }),
        response: {
          201: z.object({
            message: z.string(),
            key: z.string(),
            userName: z.string(),
            email: z.string(),
            plan: z.enum(["FREE", "PRO", "ENTERPRISE"]),
            rateLimitPerMinute: z.number(),
          }),
          409: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { userName, email, password } = request.body;
      const normalizedEmail = email.toLowerCase().trim();

      // Verificar se e-mail já possui chave
      const [existing] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.email, normalizedEmail));

      if (existing) {
        return reply.status(409).send({
          error: "E-mail já cadastrado. Utilize o login (/api/v1/auth/login) com sua senha ou sua chave existente.",
        });
      }

      // Gerar chave segura (ex: bf_live_7a8f9c1e...)
      const randomPart = randomBytes(20).toString("hex");
      const generatedKey = `bf_live_${randomPart}`;
      const passwordHash = password ? hashPassword(password) : null;

      const [newKey] = await db
        .insert(apiKeys)
        .values({
          userName: userName.trim(),
          email: normalizedEmail,
          passwordHash,
          key: generatedKey,
          plan: "FREE",
          rateLimitPerMinute: 10,
          isActive: true,
        })
        .returning();

      return reply.status(201).send({
        message: "Chave de API gerada com sucesso! Inclua no cabeçalho 'x-api-key' das suas requisições.",
        key: newKey.key,
        userName: newKey.userName,
        email: newKey.email,
        plan: newKey.plan,
        rateLimitPerMinute: newKey.rateLimitPerMinute,
      });
    }
  );

  // Login com e-mail/usuário e senha para recuperar a API Key
  app.post(
    "/login",
    {
      schema: {
        tags: ["Autenticação & Planos"],
        summary: "Login com usuário/e-mail e senha para obter a API Key",
        description: "Permite autenticar na plataforma e recuperar sua chave de API e informações de plano.",
        body: z.object({
          login: z.string().min(1, "Login (e-mail ou nome de usuário) é obrigatório"),
          password: z.string().min(1, "Senha é obrigatória"),
        }),
        response: {
          200: z.object({
            message: z.string(),
            apiKey: z.string(),
            user: z.object({
              id: z.number(),
              userName: z.string(),
              email: z.string(),
              plan: z.enum(["FREE", "PRO", "ENTERPRISE"]),
              rateLimitPerMinute: z.number(),
              isActive: z.boolean(),
            }),
          }),
          401: z.object({ error: z.string() }),
          403: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { login, password } = request.body;
      const cleanLogin = login.trim();

      // Buscar por e-mail ou userName
      const [user] = await db
        .select()
        .from(apiKeys)
        .where(
          or(
            eq(apiKeys.email, cleanLogin.toLowerCase()),
            eq(apiKeys.userName, cleanLogin)
          )
        );

      if (!user) {
        return reply.status(401).send({
          error: "Credenciais inválidas. Usuário ou e-mail não encontrado.",
        });
      }

      if (!user.isActive) {
        return reply.status(403).send({
          error: "Esta conta está inativa ou suspensa. Entre em contato com o suporte.",
        });
      }

      if (!user.passwordHash) {
        return reply.status(401).send({
          error: "Esta conta foi cadastrada sem senha. Utilize sua API Key diretamente no cabeçalho 'x-api-key'.",
        });
      }

      const isValid = verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return reply.status(401).send({
          error: "Credenciais inválidas. Senha incorreta.",
        });
      }

      return reply.send({
        message: "Login realizado com sucesso!",
        apiKey: user.key,
        user: {
          id: user.id,
          userName: user.userName,
          email: user.email,
          plan: user.plan,
          rateLimitPerMinute: user.rateLimitPerMinute,
          isActive: user.isActive,
        },
      });
    }
  );

  // Criar ou atualizar conta Enterprise
  app.post(
    "/enterprise/register",
    {
      schema: {
        tags: ["Autenticação & Planos"],
        summary: "Criar ou configurar conta do plano ENTERPRISE",
        description: "Cria uma conta Enterprise com taxa de 1.000 requisições por minuto e suporte total.",
        body: z.object({
          userName: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
          email: z.string().email("E-mail inválido"),
          password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
        }),
        response: {
          201: z.object({
            message: z.string(),
            apiKey: z.string(),
            userName: z.string(),
            email: z.string(),
            plan: z.enum(["FREE", "PRO", "ENTERPRISE"]),
            rateLimitPerMinute: z.number(),
          }),
          409: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { userName, email, password } = request.body;
      const cleanEmail = email.toLowerCase().trim();

      const [existing] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.email, cleanEmail));

      if (existing) {
        // Atualiza a conta existente para ENTERPRISE com nova senha e chave
        const passwordHash = hashPassword(password);
        const [updated] = await db
          .update(apiKeys)
          .set({
            userName: userName.trim(),
            passwordHash,
            plan: "ENTERPRISE",
            rateLimitPerMinute: 1000,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(apiKeys.id, existing.id))
          .returning();

        return reply.status(201).send({
          message: "Conta existente promovida para o plano ENTERPRISE com sucesso!",
          apiKey: updated.key,
          userName: updated.userName,
          email: updated.email,
          plan: updated.plan,
          rateLimitPerMinute: updated.rateLimitPerMinute,
        });
      }

      const randomPart = randomBytes(24).toString("hex");
      const enterpriseKey = `bf_live_enterprise_${randomPart}`;
      const passwordHash = hashPassword(password);

      const [newKey] = await db
        .insert(apiKeys)
        .values({
          userName: userName.trim(),
          email: cleanEmail,
          passwordHash,
          key: enterpriseKey,
          plan: "ENTERPRISE",
          rateLimitPerMinute: 1000,
          isActive: true,
        })
        .returning();

      return reply.status(201).send({
        message: "Conta ENTERPRISE criada com sucesso! Utilize o login e senha ou a API Key.",
        apiKey: newKey.key,
        userName: newKey.userName,
        email: newKey.email,
        plan: newKey.plan,
        rateLimitPerMinute: newKey.rateLimitPerMinute,
      });
    }
  );

  // Perfil e consumo da chave autenticada
  app.get(
    "/me",
    {
      schema: {
        tags: ["Autenticação & Planos"],
        summary: "Consultar dados da chave autenticada e limites de consumo",
      },
    },
    async (request, reply) => {
      const user = (request as any).apiUser;
      if (!user) {
        return reply.status(401).send({ error: "Não autenticado" });
      }

      return {
        id: user.id,
        userName: user.userName,
        email: user.email,
        plan: user.plan,
        rateLimitPerMinute: user.rateLimitPerMinute,
        status: user.isActive ? "ACTIVE" : "INACTIVE",
      };
    }
  );

  // Endpoint de migração de banco (adiciona password_hash e conta Enterprise)
  app.get(
    "/migrate-db",
    {
      schema: {
        tags: ["Autenticação & Planos"],
        summary: "Executar migração de colunas e dados no banco de dados",
      },
    },
    async () => {
      const { client } = await import("../db/index.js");

      // 1. Criar coluna password_hash se não existir
      await client`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);`;

      // 2. Garantir conta ENTERPRISE
      const passHash = hashPassword("BrasaFut@Enterprise2026");
      const key = "bf_live_enterprise_9f83a21c45e87b60d4e92a11bf738e45";

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

      // 3. Garantir tabela player_season_statistics com todas as colunas de scouts
      await client.unsafe(`
        CREATE TABLE IF NOT EXISTS player_season_statistics (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
          season_id BIGINT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
          team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          appearances INTEGER DEFAULT 0 NOT NULL,
          matches_started INTEGER DEFAULT 0 NOT NULL,
          minutes_played INTEGER DEFAULT 0 NOT NULL,
          goals INTEGER DEFAULT 0 NOT NULL,
          assists INTEGER DEFAULT 0 NOT NULL,
          yellow_cards INTEGER DEFAULT 0 NOT NULL,
          red_cards INTEGER DEFAULT 0 NOT NULL,
          rating VARCHAR(10) DEFAULT '0.0',
          expected_goals VARCHAR(10) DEFAULT '0.0',
          expected_assists VARCHAR(10) DEFAULT '0.0',
          shots_total INTEGER DEFAULT 0 NOT NULL,
          shots_on_target INTEGER DEFAULT 0 NOT NULL,
          key_passes INTEGER DEFAULT 0 NOT NULL,
          clean_sheets INTEGER DEFAULT 0 NOT NULL,
          saves INTEGER DEFAULT 0 NOT NULL,
          goals_conceded INTEGER DEFAULT 0 NOT NULL,
          penalty_saves INTEGER DEFAULT 0 NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT uq_player_season_stat UNIQUE (player_id, season_id)
        );
        CREATE INDEX IF NOT EXISTS idx_player_season_goals ON player_season_statistics (season_id, goals);
        CREATE INDEX IF NOT EXISTS idx_player_season_assists ON player_season_statistics (season_id, assists);
        CREATE INDEX IF NOT EXISTS idx_player_season_clean_sheets ON player_season_statistics (season_id, clean_sheets);

        DO $$ BEGIN
          CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;

        CREATE TABLE IF NOT EXISTS payments (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          api_key_id BIGINT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
          payment_id VARCHAR(64) NOT NULL UNIQUE,
          target_plan api_plan NOT NULL,
          amount_cents INTEGER NOT NULL,
          status payment_status DEFAULT 'PENDING' NOT NULL,
          pix_qr_code TEXT NOT NULL,
          pix_copy_paste TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          paid_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

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

        CREATE TABLE IF NOT EXISTS team_absences (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          player_id BIGINT REFERENCES players(id) ON DELETE SET NULL,
          player_name VARCHAR(150) NOT NULL,
          position VARCHAR(50),
          type VARCHAR(50) NOT NULL,
          reason VARCHAR(255) NOT NULL,
          expected_return VARCHAR(100),
          status VARCHAR(50) DEFAULT 'OUT' NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_team_absences_team_id ON team_absences (team_id);
        CREATE INDEX IF NOT EXISTS idx_team_absences_player_id ON team_absences (player_id);

        CREATE TABLE IF NOT EXISTS referees (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          nationality VARCHAR(100) DEFAULT 'Brasil' NOT NULL,
          federation VARCHAR(100) DEFAULT 'CBF / FIFA',
          matches_count INTEGER DEFAULT 0 NOT NULL,
          yellow_cards_total INTEGER DEFAULT 0 NOT NULL,
          red_cards_total INTEGER DEFAULT 0 NOT NULL,
          fouls_avg VARCHAR(10) DEFAULT '27.4',
          penalties_total INTEGER DEFAULT 0 NOT NULL,
          home_win_pct INTEGER DEFAULT 48 NOT NULL,
          away_win_pct INTEGER DEFAULT 26 NOT NULL,
          draw_pct INTEGER DEFAULT 26 NOT NULL,
          photo_url TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_referees_name ON referees (name);
      `);

      return {
        success: true,
        message: "Migração do banco de dados e conta ENTERPRISE configurada com sucesso!",
        login: "enterprise@brasafut.com.br",
        userName: "enterprise_admin",
        plan: "ENTERPRISE",
        rateLimitPerMinute: 1000,
        apiKey: key,
      };
    }
  );
};
