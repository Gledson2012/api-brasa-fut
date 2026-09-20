import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";
import { eq, or } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../utils/password.js";
import {
  apiKeyPrefix,
  generateApiKey,
  hashApiKey,
} from "../utils/apiKey.js";
import {
  invalidateCachedKey,
  requireAdminOrPlan,
} from "../middleware/auth.js";

const userResponseSchema = z.object({
  id: z.number(),
  userName: z.string(),
  email: z.string(),
  plan: z.enum(["FREE", "PRO", "ENTERPRISE"]),
  rateLimitPerMinute: z.number(),
  isActive: z.boolean(),
});

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
        description:
          "Gera uma chave 'bf_live_...' para consumir a API. A chave é exibida apenas nesta resposta: guardamos somente o hash dela. Aceita senha para possibilitar login e rotação posteriores.",
        body: z.object({
          userName: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
          email: z.string().email("E-mail inválido"),
          password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional(),
        }),
        response: {
          201: z.object({
            message: z.string(),
            key: z.string(),
            keyPrefix: z.string(),
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
          error: "E-mail já cadastrado. Utilize o login (/api/v1/auth/login) com sua senha ou rotacione a chave em (/api/v1/auth/keys/rotate).",
        });
      }

      // Gerar chave segura (ex: bf_live_7a8f9c1e...)
      const generatedKey = generateApiKey("FREE");
      const passwordHash = password ? hashPassword(password) : null;

      const [newKey] = await db
        .insert(apiKeys)
        .values({
          userName: userName.trim(),
          email: normalizedEmail,
          passwordHash,
          keyHash: hashApiKey(generatedKey),
          keyPrefix: apiKeyPrefix(generatedKey),
          plan: "FREE",
          rateLimitPerMinute: 10,
          isActive: true,
        })
        .returning();

      return reply.status(201).send({
        message:
          "Chave de API gerada com sucesso! Guarde-a agora: por segurança ela não é armazenada em texto puro e não será exibida novamente.",
        key: generatedKey,
        keyPrefix: newKey.keyPrefix ?? apiKeyPrefix(generatedKey),
        userName: newKey.userName,
        email: newKey.email,
        plan: newKey.plan,
        rateLimitPerMinute: newKey.rateLimitPerMinute,
      });
    }
  );

  // Login com e-mail/usuário e senha
  app.post(
    "/login",
    {
      schema: {
        tags: ["Autenticação & Planos"],
        summary: "Login com usuário/e-mail e senha",
        description:
          "Autentica a conta e retorna os dados do plano. A chave de API não é exibida novamente: use /api/v1/auth/keys/rotate para gerar uma nova.",
        body: z.object({
          login: z.string().min(1, "Login (e-mail ou nome de usuário) é obrigatório"),
          password: z.string().min(1, "Senha é obrigatória"),
        }),
        response: {
          200: z.object({
            message: z.string(),
            keyPrefix: z.string().nullable(),
            user: userResponseSchema,
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
          error:
            "Esta conta foi cadastrada sem senha. Gere uma nova chave em /api/v1/auth/register ou contate o suporte.",
        });
      }

      const isValid = verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return reply.status(401).send({
          error: "Credenciais inválidas. Senha incorreta.",
        });
      }

      return reply.send({
        message:
          "Login realizado com sucesso! Por segurança a chave não é exibida novamente — use POST /api/v1/auth/keys/rotate para gerar uma nova chave.",
        keyPrefix: user.keyPrefix,
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

  // Rotacionar a chave de API (autenticado por login + senha)
  app.post(
    "/keys/rotate",
    {
      schema: {
        tags: ["Autenticação & Planos"],
        summary: "Rotacionar a chave de API (requer login e senha)",
        description:
          "Invalida imediatamente a chave atual da conta e devolve uma nova. A nova chave é exibida apenas nesta resposta.",
        body: z.object({
          login: z.string().min(1, "Login (e-mail ou nome de usuário) é obrigatório"),
          password: z.string().min(1, "Senha é obrigatória"),
        }),
        response: {
          200: z.object({
            message: z.string(),
            key: z.string(),
            keyPrefix: z.string(),
          }),
          401: z.object({ error: z.string() }),
          403: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { login, password } = request.body;
      const cleanLogin = login.trim();

      const [user] = await db
        .select()
        .from(apiKeys)
        .where(
          or(
            eq(apiKeys.email, cleanLogin.toLowerCase()),
            eq(apiKeys.userName, cleanLogin)
          )
        );

      if (!user || !user.passwordHash) {
        return reply.status(401).send({
          error: "Credenciais inválidas. Usuário ou e-mail não encontrado.",
        });
      }

      if (!user.isActive) {
        return reply.status(403).send({
          error: "Esta conta está inativa ou suspensa. Entre em contato com o suporte.",
        });
      }

      if (!verifyPassword(password, user.passwordHash)) {
        return reply.status(401).send({
          error: "Credenciais inválidas. Senha incorreta.",
        });
      }

      const newKey = generateApiKey(user.plan);
      await db
        .update(apiKeys)
        .set({
          keyHash: hashApiKey(newKey),
          keyPrefix: apiKeyPrefix(newKey),
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, user.id));

      // Invalida o cache imediatamente (Redis compartilhado) e, no fallback
      // em memória, a chave antiga expira no TTL de 60s por instância.
      await invalidateCachedKey(user.keyHash);

      return reply.send({
        message:
          "Chave rotacionada com sucesso! A chave anterior foi invalidada. Guarde a nova chave agora: ela não será exibida novamente.",
        key: newKey,
        keyPrefix: apiKeyPrefix(newKey),
      });
    }
  );

  // Criar ou promover conta Enterprise (requer privilégios administrativos)
  app.post(
    "/enterprise/register",
    {
      schema: {
        tags: ["Autenticação & Planos"],
        summary: "Criar ou configurar conta do plano ENTERPRISE (Admin)",
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
            keyPrefix: z.string(),
            userName: z.string(),
            email: z.string(),
            plan: z.enum(["FREE", "PRO", "ENTERPRISE"]),
            rateLimitPerMinute: z.number(),
          }),
          401: z.object({ error: z.string() }),
          403: z.object({ error: z.string() }),
          409: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      if (!requireAdminOrPlan(request, reply, ["ENTERPRISE"])) return;

      const { userName, email, password } = request.body;
      const cleanEmail = email.toLowerCase().trim();

      const [existing] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.email, cleanEmail));

      if (existing) {
        // Promove a conta existente para ENTERPRISE e emite uma chave nova
        const newKey = generateApiKey("ENTERPRISE");
        const [updated] = await db
          .update(apiKeys)
          .set({
            userName: userName.trim(),
            passwordHash: hashPassword(password),
            keyHash: hashApiKey(newKey),
            keyPrefix: apiKeyPrefix(newKey),
            plan: "ENTERPRISE",
            rateLimitPerMinute: 1000,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(apiKeys.id, existing.id))
          .returning();

        await invalidateCachedKey(existing.keyHash);

        return reply.status(201).send({
          message:
            "Conta existente promovida para o plano ENTERPRISE. A chave anterior foi invalidada e a nova aparece somente nesta resposta.",
          apiKey: newKey,
          keyPrefix: updated.keyPrefix ?? apiKeyPrefix(newKey),
          userName: updated.userName,
          email: updated.email,
          plan: updated.plan,
          rateLimitPerMinute: updated.rateLimitPerMinute,
        });
      }

      const enterpriseKey = generateApiKey("ENTERPRISE");

      const [newKey] = await db
        .insert(apiKeys)
        .values({
          userName: userName.trim(),
          email: cleanEmail,
          passwordHash: hashPassword(password),
          keyHash: hashApiKey(enterpriseKey),
          keyPrefix: apiKeyPrefix(enterpriseKey),
          plan: "ENTERPRISE",
          rateLimitPerMinute: 1000,
          isActive: true,
        })
        .returning();

      return reply.status(201).send({
        message:
          "Conta ENTERPRISE criada com sucesso! A chave aparece somente nesta resposta — use login + /api/v1/auth/keys/rotate para obter outra.",
        apiKey: enterpriseKey,
        keyPrefix: newKey.keyPrefix ?? apiKeyPrefix(enterpriseKey),
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
        keyPrefix: user.keyPrefix,
        plan: user.plan,
        rateLimitPerMinute: user.rateLimitPerMinute,
        status: user.isActive ? "ACTIVE" : "INACTIVE",
      };
    }
  );
};
