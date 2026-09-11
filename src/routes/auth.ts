import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

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
          ],
        },
      ];
    }
  );

  // Registrar e obter nova API Key
  app.post(
    "/register",
    {
      schema: {
        tags: ["Autenticação & Planos"],
        summary: "Registrar desenvolvedor e gerar chave de API (API Key)",
        description: "Gera instantaneamente uma chave no formato 'bf_live_...' para consumir a API.",
        body: z.object({
          userName: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
          email: z.string().email("E-mail inválido"),
          plan: z.enum(["FREE", "PRO", "ENTERPRISE"]).default("FREE"),
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
      const { userName, email, plan } = request.body;

      // Verificar se e-mail já possui chave
      const [existing] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.email, email));

      if (existing) {
        return reply.status(409).send({
          error: "E-mail já cadastrado. Utilize sua chave existente ou solicite recuperação.",
        });
      }

      // Gerar chave segura (ex: bf_live_7a8f9c1e...)
      const randomPart = randomBytes(20).toString("hex");
      const generatedKey = `bf_live_${randomPart}`;

      const rateLimitMap: Record<string, number> = {
        FREE: 10,
        PRO: 120,
        ENTERPRISE: 1000,
      };

      const [newKey] = await db
        .insert(apiKeys)
        .values({
          userName,
          email,
          key: generatedKey,
          plan,
          rateLimitPerMinute: rateLimitMap[plan] || 10,
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
};
