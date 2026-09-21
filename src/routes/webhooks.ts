import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { webhooks, webhookDeliveries } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { WebhookDispatcher } from "../services/webhookDispatcher.js";
import { auditLog } from "../services/auditLog.js";

export const webhookRoutes: FastifyPluginAsyncZod = async (app) => {
  // Listar webhooks do desenvolvedor autenticado
  app.get(
    "/",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Listar webhooks cadastrados",
      },
    },
    async (request, reply) => {
      const user = request.apiUser;
      if (!user) {
        return reply.status(401).send({ error: "Não autenticado" });
      }

      return await db
        .select()
        .from(webhooks)
        .where(eq(webhooks.apiKeyId, user.id));
    }
  );

  // Cadastrar novo webhook
  app.post(
    "/",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Cadastrar novo endpoint de Webhook",
        description: "Registra uma URL para receber notificações instantâneas de gols, cartões e mudanças de status.",
        body: z.object({
          url: z.string().url("URL inválida"),
          events: z
            .array(z.enum(["ALL", "SCORE_UPDATE", "MATCH_EVENT", "STATUS_CHANGE"]))
            .default(["ALL"]),
        }),
      },
    },
    async (request, reply) => {
      const user = request.apiUser;
      if (!user) {
        return reply.status(401).send({ error: "Não autenticado" });
      }

      const { url, events } = request.body;

      // Gerar secret para assinatura HMAC (ex: whsec_...)
      const secret = `whsec_${randomBytes(24).toString("hex")}`;

      const [newWebhook] = await db
        .insert(webhooks)
        .values({
          apiKeyId: user.id,
          url,
          secret,
          events,
          isActive: true,
        })
        .returning();

      auditLog({
        action: "webhook.create",
        userId: user.id,
        userEmail: user.email,
        userPlan: user.plan,
        resourceType: "webhook",
        resourceId: newWebhook.id,
        ip: request.ip,
        requestId: request.id as string,
        metadata: { url, events },
      });

      return reply.status(201).send({
        message: "Webhook cadastrado com sucesso!",
        webhook: newWebhook,
        instructions:
          "Verifique o cabeçalho 'X-BrasaFut-Signature' usando HMAC SHA256 com seu secret para validar a autenticidade.",
      });
    }
  );

  // Excluir webhook
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Remover webhook cadastrado",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const user = request.apiUser;
      if (!user) return reply.status(401).send({ error: "Não autenticado" });
      const { id } = request.params;

      const [deleted] = await db
        .delete(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.apiKeyId, user.id)))
        .returning();

      if (!deleted) {
        return reply.status(404).send({ error: "Webhook não encontrado" });
      }

      auditLog({
        action: "webhook.delete",
        userId: user.id,
        userEmail: user.email,
        userPlan: user.plan,
        resourceType: "webhook",
        resourceId: id,
        ip: request.ip,
        requestId: request.id as string,
      });

      return { message: "Webhook removido com sucesso" };
    }
  );

  // Histórico de disparos do webhook
  app.get(
    "/:id/deliveries",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Consultar histórico e auditoria de entregas do webhook",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const user = request.apiUser;
      if (!user) return reply.status(401).send({ error: "Não autenticado" });
      const { id } = request.params;

      // Garantir que o webhook pertence ao usuário autenticado
      const [hook] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.apiKeyId, user.id)));

      if (!hook) {
        return reply.status(404).send({ error: "Webhook não encontrado" });
      }

      const deliveries = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, id))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(50);

      return deliveries;
    }
  );

  // Disparar evento de teste (Ping)
  app.post(
    "/:id/test",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Disparar evento de teste para o webhook",
        params: z.object({
          id: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
      const user = request.apiUser;
      if (!user) return reply.status(401).send({ error: "Não autenticado" });
      const { id } = request.params;

      const [hook] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.apiKeyId, user.id)));

      if (!hook) {
        return reply.status(404).send({ error: "Webhook não encontrado" });
      }

      await WebhookDispatcher.dispatchTo(hook, {
        event: "STATUS_CHANGE",
        matchId: 1,
        timestamp: new Date().toISOString(),
        data: {
          test: true,
          message: "Este é um disparo de teste da BrasaFut API",
        },
      });

      return { message: "Disparo de teste realizado exclusivamente para este webhook." };
    }
  );
};
