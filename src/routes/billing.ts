import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "../db/index.js";
import { apiKeys, payments } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { PixProvider } from "../services/pixProvider.js";

const PLAN_RATE_LIMITS = {
  PRO: 120,
  ENTERPRISE: 1000,
} as const;

const PLAN_AMOUNTS_CENTS = {
  PRO: Number(process.env.BILLING_PRO_CENTS || 4990),
  ENTERPRISE: Number(process.env.BILLING_ENTERPRISE_CENTS || 19900),
} as const;

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function isOwnerOrAdmin(
  request: { headers: Record<string, unknown>; apiUser?: { key: string; plan: string } },
  keyRecord: { key: string }
): boolean {
  const apiUser = (request as unknown as { apiUser?: { key: string; plan: string } }).apiUser;
  if (apiUser && apiUser.key === keyRecord.key) return true;
  const adminSecret = process.env.ADMIN_SECRET;
  const adminHeader = request.headers["x-admin-key"];
  if (adminSecret && adminHeader === adminSecret) return true;
  if (apiUser && apiUser.plan === "ENTERPRISE" && process.env.ADMIN_API_KEY === apiUser.key) return true;
  return false;
}

function checkBillingWebhookAuth(request: { headers: Record<string, unknown> }): boolean {
  const secret = process.env.BILLING_WEBHOOK_SECRET;
  if (!secret) return true; // modo permissivo com aviso (ver abaixo)
  const header = request.headers["x-webhook-secret"];
  if (typeof header !== "string") return false;
  // Comparação timing-safe contra timing attacks
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const billingRoutes: FastifyPluginAsyncZod = async (app) => {
  if (!process.env.BILLING_WEBHOOK_SECRET) {
    console.warn(
      "⚠️ [billing] BILLING_WEBHOOK_SECRET não configurado. Webhook de pagamento aceita qualquer chamador — configure em produção."
    );
  }

  // 1. Criar Cobrança Pix para Upgrade de Plano
  app.post(
    "/checkout",
    {
      schema: {
        tags: ["Billing & Monetização Pix"],
        summary: "Iniciar checkout Pix para upgrade de plano",
        description:
          "Gera código Pix Copia e Cola para pagamento e upgrade de chave da API. O QR deve ser renderizado pelo cliente a partir de pixCopyPaste (não enviamos o payload a terceiros).",
        body: z.object({
          apiKey: z.string().describe("Chave de API a ser atualizada (deve pertencer ao chamador ou admin)"),
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
          403: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { apiKey, targetPlan } = request.body;

      // Buscar API Key
      const [keyRecord] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.key, apiKey));

      if (!keyRecord) {
        return reply.status(404).send({ error: "Chave de API não encontrada" });
      }

      // Anti-IDOR: só o dono da chave ou admin pode gerar cobrança para ela
      if (!isOwnerOrAdmin(request as unknown as { headers: Record<string, unknown> }, keyRecord)) {
        return reply.status(403).send({ error: "Acesso Negado. Você só pode gerar cobrança para sua própria chave." });
      }

      // Definir valor do plano (sobrescrevível via env)
      const amountCents = PLAN_AMOUNTS_CENTS[targetPlan];
      const amountFormatted = formatBRL(amountCents);
      const paymentId = `pay_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

      // Provedor Pix: Mercado Pago ao vivo quando MP_ACCESS_TOKEN existe,
      // senão payload sandbox local (nunca roteado a terceiros).
      const charge = await PixProvider.createCharge({
        paymentId,
        targetPlan,
        amountCents,
        payerEmail: keyRecord.email,
      });
      const pixPayload = charge.pixCopyPaste;

      // NÃO vazar o payload para provedores externos de QR (ex: api.qrserver.com via query string).
      // O cliente deve renderizar o QR localmente a partir de pixCopyPaste.
      // Se o provedor retornou QR base64 (MP), expõe como data URI de imagem.
      const pixQrCodeUrl = charge.pixQrCodeBase64
        ? `data:image/png;base64,${charge.pixQrCodeBase64}`
        : `data:text/plain;charset=utf-8,${encodeURIComponent(pixPayload)}`;

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
          "Renderize o QR localmente a partir de pixCopyPaste (ex: lib qrcode no frontend). Abra o app do banco em 'Pix Copia e Cola'. A ativação ocorre via webhook do PSP.",
      };
    }
  );

  // 2. Webhook de Confirmação de Pagamento (Gateway / PSP)
  app.post(
    "/webhook",
    {
      schema: {
        tags: ["Billing & Monetização Pix"],
        summary: "Webhook de confirmação de pagamento Pix (autenticado via x-webhook-secret)",
        description:
          "Endpoint chamado pelo gateway de pagamento quando o Pix é liquidado. Exige cabeçalho 'x-webhook-secret' igual a BILLING_WEBHOOK_SECRET quando configurado.",
        body: z.object({
          event: z.string().default("PAYMENT_CONFIRMED"),
          paymentId: z.string(),
        }),
      },
    },
    async (request, reply) => {
      if (!checkBillingWebhookAuth(request as unknown as { headers: Record<string, unknown> })) {
        return reply.status(401).send({ error: "Assinatura do webhook inválida." });
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

      if (payment.expiresAt && new Date(payment.expiresAt).getTime() < Date.now()) {
        await db
          .update(payments)
          .set({ status: "EXPIRED", updatedAt: new Date() })
          .where(eq(payments.id, payment.id));
        return reply.status(410).send({ error: "Cobrança expirada. Gere um novo checkout." });
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

      // Elevar o plano da chave de API (limites canônicos: PRO 120, ENTERPRISE 1000)
      const newRateLimit = PLAN_RATE_LIMITS[payment.targetPlan as "PRO" | "ENTERPRISE"];
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
        targetPlan: payment.targetPlan,
        rateLimitPerMinute: newRateLimit,
        paidAt: new Date().toISOString(),
      };
    }
  );

  // 3. Consultar Status do Pagamento (somente dono ou admin)
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

      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.paymentId, paymentId));

      if (!payment) {
        return reply.status(404).send({ error: "Pagamento não encontrado" });
      }

      const [keyRecord] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.id, payment.apiKeyId));

      if (keyRecord && !isOwnerOrAdmin(request as unknown as { headers: Record<string, unknown> }, keyRecord)) {
        return reply.status(403).send({ error: "Acesso Negado." });
      }

      return {
        paymentId: payment.paymentId,
        status: payment.status,
        targetPlan: payment.targetPlan,
        amountCents: payment.amountCents,
        amountFormatted: formatBRL(payment.amountCents),
        expiresAt: payment.expiresAt,
        paidAt: payment.paidAt,
        apiKey: keyRecord
          ? {
              key: keyRecord.key,
              userName: keyRecord.userName,
              currentPlan: keyRecord.plan,
              rateLimitPerMinute: keyRecord.rateLimitPerMinute,
            }
          : null,
      };
    }
  );

  // 4. Simular Pagamento Pix (Sandbox; bloqueado em produção sem x-admin-key)
  app.post(
    "/simulate-pix-paid/:paymentId",
    {
      schema: {
        tags: ["Billing & Monetização Pix"],
        summary: "Simular confirmação de pagamento Pix (Sandbox)",
        description:
          "Disponível apenas fora de produção, ou em produção com 'x-admin-key'. Nunca exponha sem controle.",
        params: z.object({
          paymentId: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
      if (isProd) {
        const adminSecret = process.env.ADMIN_SECRET;
        const adminHeader = (request.headers as Record<string, unknown>)["x-admin-key"];
        if (!adminSecret || adminHeader !== adminSecret) {
          return reply.status(403).send({
            error: "Simulação desabilitada em produção. Use x-admin-key ou o webhook real do PSP.",
          });
        }
      }

      const { paymentId } = request.params;

      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.paymentId, paymentId));

      if (!payment) {
        return reply.status(404).send({ error: "Pagamento não encontrado" });
      }

      if (payment.expiresAt && new Date(payment.expiresAt).getTime() < Date.now()) {
        return reply.status(410).send({ error: "Cobrança expirada." });
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

      // Elevar o plano da chave de API (limites canônicos)
      const newRateLimit = PLAN_RATE_LIMITS[payment.targetPlan as "PRO" | "ENTERPRISE"];
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
        message: `[SANDBOX] Cobrança ${paymentId} aprovada via simulação! Plano ativado: ${payment.targetPlan}.`,
        paymentId,
        targetPlan: payment.targetPlan,
        rateLimitPerMinute: newRateLimit,
        paidAt: new Date().toISOString(),
      };
    }
  );
};
