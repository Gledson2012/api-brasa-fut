import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { apiKeys, apiUsage } from "../db/schema.js";
import { eq, or, desc, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { invalidateKeyCache } from "../middleware/auth.js";

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

  // Criar ou atualizar conta Enterprise (RESTRITO: requer x-admin-key / ADMIN_SECRET)
  app.post(
    "/enterprise/register",
    {
      schema: {
        tags: ["Autenticação & Planos"],
        summary: "Criar ou configurar conta do plano ENTERPRISE (admin)",
        description: "Restrito a administradores via cabeçalho 'x-admin-key'. Cria uma conta Enterprise com taxa de 1.000 requisições por minuto.",
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
          403: z.object({ error: z.string() }),
          409: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const adminSecret = process.env.ADMIN_SECRET;
      const adminHeader = request.headers["x-admin-key"];
      if (!adminSecret || adminHeader !== adminSecret) {
        return reply.status(403).send({
          error: "Acesso Negado. Esta operação requer 'x-admin-key' de administrador.",
        });
      }

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

  // Rotação de chave: gera nova key; a anterior segue válida por 24h (grace period)
  app.post(
    "/rotate",
    {
      schema: {
        tags: ["Autenticação & Planos"],
        summary: "Rotacionar chave de API (antiga válida por 24h)",
        description:
          "Gera uma nova chave e move a atual para grace period de 24h. Requisições com a chave antiga recebem o cabeçalho X-Api-Key-Rotated.",
        response: {
          201: z.object({
            message: z.string(),
            key: z.string(),
            previousKeyExpiresAt: z.string(),
          }),
          401: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const user = (request as any).apiUser;
      if (!user) {
        return reply.status(401).send({ error: "Não autenticado" });
      }

      const oldKey = user.key as string;
      const newKey = `bf_live_${randomBytes(20).toString("hex")}`;
      const graceExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db
        .update(apiKeys)
        .set({
          key: newKey,
          previousKey: oldKey,
          previousKeyExpiresAt: graceExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, user.id));

      invalidateKeyCache(oldKey, newKey);

      return reply.status(201).send({
        message: "Chave rotacionada com sucesso. A anterior expira em 24h.",
        key: newKey,
        previousKeyExpiresAt: graceExpiresAt.toISOString(),
      });
    }
  );

  // Consumo (metering): requisições por dia no mês corrente
  app.get(
    "/usage",
    {
      schema: {
        tags: ["Autenticação & Planos"],
        summary: "Consultar consumo diário da chave no mês corrente",
      },
    },
    async (request, reply) => {
      const user = (request as any).apiUser;
      if (!user) {
        return reply.status(401).send({ error: "Não autenticado" });
      }

      const rows = await db
        .select({ day: apiUsage.day, count: apiUsage.count })
        .from(apiUsage)
        .where(
          sql`${apiUsage.apiKeyId} = ${user.id} AND date_trunc('month', ${apiUsage.day}) = date_trunc('month', CURRENT_DATE)`
        )
        .orderBy(desc(apiUsage.day))
        .limit(31);

      const monthTotal = rows.reduce((acc, r) => acc + (r.count ?? 0), 0);
      const today = new Date().toISOString().slice(0, 10);
      const todayRow = rows.find((r) => String(r.day).slice(0, 10) === today);

      return {
        plan: user.plan,
        rateLimitPerMinute: user.rateLimitPerMinute,
        monthTotal,
        today: todayRow?.count ?? 0,
        daily: rows,
      };
    }
  );

  // Endpoint de migração removido por segurança (410 Gone).  // Migrações DDL e seed administrativo devem rodar via CLI: `npm run db:migrate`
  // ou `tsx scripts/migrate-prod.ts` com ADMIN_SECRET. Nunca expor DDL via HTTP.
  app.get(
    "/migrate-db",
    {
      schema: {
        tags: ["Autenticação & Planos"],
        summary: "Removido por segurança (use CLI com ADMIN_SECRET)",
      },
    },
    async (_request, reply) => {
      return reply.status(410).send({
        error: "Gone",
        message:
          "Este endpoint foi removido por segurança. Execute migrações via CLI (scripts/migrate-prod.ts) com ADMIN_SECRET.",
      });
    }
  );
};
