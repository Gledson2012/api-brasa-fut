import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { apiKeys, payments } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { hashApiKey, safeCompare } from "../utils/apiKey.js";
import { requireAdminOrPlan } from "../middleware/auth.js";

/** Modo sandbox: habilita simulação de Pix e webhook sem segredo. */
function pixSandboxEnabled(): boolean {
  return process.env.ALLOW_PIX_SIMULATION === "true";
}

export const billingRoutes: FastifyPluginAsyncZod = async (app) => {
  // 1. Criar Cobrança Pix para Upgrade de Plano
  app.post(
    "/checkout",
    {
      schema: {
        tags: ["Billing & Monetização Pix"],
        summary: "Iniciar checkout Pix para upgrade de plano",
        description:
          "Gera um QR Code Pix dinâmico e código Copia e Cola para pagamento instantâneo e upgrade de chave da API.",
        body: z.object({
          apiKey: z.string().describe("Chave de API a ser atualizada"),
          targetPlan: z.enum(["PRO", "ENTERPRISE"]).default("PRO"),
        }),
        response: {
          200: z.object({
            paymentId: z.string(),
            targetPlan: z.enum(["FREE", "PRO", "ENTERPRISE"]),
            amountCents: z.number(),
            amountFormatted: z.string(),
            pixCopyPaste: z.string(),
            pixQrCodeUrl: z.string(),
            expiresAt: z.string(),
            instructions: z.string(),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { apiKey, targetPlan } = request.body;

      // Buscar API Key pelo hash (a chave em texto puro não é armazenada)
      const [keyRecord] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, hashApiKey(apiKey)));

      if (!keyRecord) {
        return reply.status(404).send({ error: "Chave de API não encontrada" });
      }

      // Definir valor do plano
      const amountCents = targetPlan === "PRO" ? 4990 : 19900; // R$ 49,90 ou R$ 199,00
      const amountFormatted = targetPlan === "PRO" ? "R$ 49,90" : "R$ 199,00";
      const paymentId = `pay_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

      // Gerar Pix Copia e Cola formatado conforme padrão Banco Central
      const pixKey = "financeiro@brasafut.com.br";
      const valueStr = (amountCents / 100).toFixed(2);
      const pixPayload = `00020126580014br.gov.bcb.pix0136${pixKey}5204000053039865405${valueStr}5802BR5916BrasaFut API LTDA6009Sao Paulo62240520${paymentId}6304ABCD`;

      const pixQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(
        pixPayload
      )}`;

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

      // Salvar cobrança no banco
      await db.insert(payments).values({
        apiKeyId: keyRecord.id,
        paymentId,
        targetPlan,
        amountCents,
        status: "PENDING",
        pixQrCode: pixQrCodeUrl,
        pixCopyPaste: pixPayload,
        expiresAt,
      });

      return {
        paymentId,
        targetPlan,
        amountCents,
        amountFormatted,
        pixCopyPaste: pixPayload,
        pixQrCodeUrl,
        expiresAt: expiresAt.toISOString(),
        instructions:
          "Abra o app do seu banco, escolha 'Pagar com Pix / Copia e Cola' e cole o código acima ou escaneie o QR Code. A ativação é automática via webhook.",
      };
    }
  );

  // 2. Webhook de Confirmação de Pagamento (Gateway / PSP)
  app.post(
    "/webhook",
    {
      schema: {
        tags: ["Billing & Monetização Pix"],
        summary: "Webhook de confirmação de pagamento Pix (gateway/PSP)",
        description:
          "Endpoint chamado pelo gateway de pagamento quando o Pix é liquidado. Requer o segredo compartilhado no cabeçalho 'x-pix-secret' (PIX_WEBHOOK_SECRET).",
        body: z.object({
          event: z.string().default("PAYMENT_CONFIRMED"),
          paymentId: z.string(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
            paymentId: z.string(),
            status: z.string(),
            targetPlan: z.string().optional(),
            rateLimitPerMinute: z.number().optional(),
            paidAt: z.string().optional(),
          }),
          403: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      // Confirmação de pagamento só é aceita do gateway (segredo), de um admin
      // autenticado ou em modo sandbox explícito.
      const adminSecret = process.env.ADMIN_SECRET;
      const isAdmin = Boolean(
        adminSecret && request.headers["x-admin-key"] === adminSecret
      );

      const pixSecret = process.env.PIX_WEBHOOK_SECRET;
      const providedSecret = request.headers["x-pix-secret"];
      const isGateway = Boolean(
        pixSecret &&
          typeof providedSecret === "string" &&
          safeCompare(providedSecret, pixSecret)
      );

      if (!isAdmin && !isGateway && !pixSandboxEnabled()) {
        return reply.status(403).send({
          error:
            "Webhook não autorizado. Informe o cabeçalho 'x-pix-secret' configurado em PIX_WEBHOOK_SECRET.",
        });
      }

      const { paymentId } = request.body;

      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.paymentId, paymentId));

      if (!payment) {
        return reply.status(404).send({ error: "Pagamento não encontrado" });
      }

      if (payment.status === "PAID") {
        return {
          success: true,
          message: "Pagamento já havia sido processado anteriormente.",
          paymentId,
          status: "PAID",
        };
      }

      // Atualizar status do pagamento
      await db
        .update(payments)
        .set({
          status: "PAID",
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));

      // Elevar o plano da chave de API
      const newRateLimit = payment.targetPlan === "ENTERPRISE" ? 300 : 60;
      await db
        .update(apiKeys)
        .set({
          plan: payment.targetPlan,
          rateLimitPerMinute: newRateLimit,
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, payment.apiKeyId));

      return {
        success: true,
        message: `Pagamento confirmado com sucesso! Chave de API atualizada para o plano ${payment.targetPlan} (${newRateLimit} req/min).`,
        paymentId,
        status: "PAID",
        targetPlan: payment.targetPlan,
        rateLimitPerMinute: newRateLimit,
        paidAt: new Date().toISOString(),
      };
    }
  );

  // 3. Consultar Status do Pagamento (somente o dono da cobrança)
  app.get(
    "/status/:paymentId",
    {
      schema: {
        tags: ["Billing & Monetização Pix"],
        summary: "Consultar status de um pagamento Pix",
        params: z.object({
          paymentId: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { paymentId } = request.params;
      const user = (request as any).apiUser as { id: number } | undefined;

      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.paymentId, paymentId));

      // Cobranças de outras contas respondem 404 para não vazar existência
      if (!payment || !user || payment.apiKeyId !== user.id) {
        return reply.status(404).send({ error: "Pagamento não encontrado" });
      }

      const [keyRecord] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.id, payment.apiKeyId));

      return {
        paymentId: payment.paymentId,
        status: payment.status,
        targetPlan: payment.targetPlan,
        amountCents: payment.amountCents,
        amountFormatted: `R$ ${(payment.amountCents / 100).toFixed(2).replace(".", ",")}`,
        expiresAt: payment.expiresAt,
        paidAt: payment.paidAt,
        apiKey: keyRecord
          ? {
              keyPrefix: keyRecord.keyPrefix,
              userName: keyRecord.userName,
              currentPlan: keyRecord.plan,
              rateLimitPerMinute: keyRecord.rateLimitPerMinute,
            }
          : null,
      };
    }
  );

  // 4. Simular Pagamento Pix (Sandbox / Admin)
  app.post(
    "/simulate-pix-paid/:paymentId",
    {
      schema: {
        tags: ["Billing & Monetização Pix"],
        summary: "Simular confirmação de pagamento Pix (Sandbox/Admin)",
        description:
          "Aprova instantaneamente uma cobrança sem movimentar dinheiro real. Exige privilégio administrativo ou ALLOW_PIX_SIMULATION=true.",
        params: z.object({
          paymentId: z.string(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
            paymentId: z.string(),
            targetPlan: z.string(),
            rateLimitPerMinute: z.number(),
            paidAt: z.string(),
          }),
          401: z.object({ error: z.string() }),
          403: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      if (
        !pixSandboxEnabled() &&
        !requireAdminOrPlan(request, reply, ["ENTERPRISE"])
      ) {
        return;
      }

      const { paymentId } = request.params;

      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.paymentId, paymentId));

      if (!payment) {
        return reply.status(404).send({ error: "Pagamento não encontrado" });
      }

      // Atualizar status do pagamento
      await db
        .update(payments)
        .set({
          status: "PAID",
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));

      // Elevar o plano da chave de API
      const newRateLimit = payment.targetPlan === "ENTERPRISE" ? 300 : 60;
      await db
        .update(apiKeys)
        .set({
          plan: payment.targetPlan,
          rateLimitPerMinute: newRateLimit,
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, payment.apiKeyId));

      return {
        success: true,
        message: `[TESTE] Cobrança ${paymentId} aprovada via simulação! Plano ativado: ${payment.targetPlan}.`,
        paymentId,
        targetPlan: payment.targetPlan,
        rateLimitPerMinute: newRateLimit,
        paidAt: new Date().toISOString(),
      };
    }
  );
};
