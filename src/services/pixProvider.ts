export interface PixChargeInput {
  paymentId: string;
  targetPlan: string;
  amountCents: number;
  payerEmail?: string;
}

export interface PixChargeOutput {
  pixCopyPaste: string;
  pixQrCodeBase64?: string;
  provider: "mock" | "mercadopago";
  providerPaymentId?: string;
}

/**
 * Provedor Pix com fallback sandbox.
 *
 * - Com MP_ACCESS_TOKEN configurado: cria cobrança real via Mercado Pago
 *   (POST /v1/payments, payment_method_id=pix). Retorna copia-e-cola e QR base64.
 * - Sem token: gera payload sandbox local (NUNCA roteado a terceiros).
 *
 * Nenhuma dependência nova: usa `fetch` nativo.
 */
export class PixProvider {
  static isLive(): boolean {
    return Boolean(process.env.MP_ACCESS_TOKEN);
  }

  static async createCharge(input: PixChargeInput): Promise<PixChargeOutput> {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
      return this.createMockCharge(input);
    }

    try {
      const res = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": input.paymentId,
        },
        body: JSON.stringify({
          transaction_amount: input.amountCents / 100,
          description: `BrasaFut API ${input.targetPlan} (${input.paymentId})`,
          payment_method_id: "pix",
          payer: { email: input.payerEmail || "cliente@brasafut.com.br" },
          external_reference: input.paymentId,
          notification_url: process.env.BILLING_MP_WEBHOOK_URL,
          date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        }),
      });

      if (!res.ok) {
        console.warn(`⚠️ [pix] MercadoPago ${res.status}, usando mock sandbox.`);
        return this.createMockCharge(input);
      }

      const json = (await res.json()) as {
        id?: number | string;
        point_of_interaction?: {
          transaction_data?: { qr_code?: string; qr_code_base64?: string };
        };
      };
      const qrCode = json.point_of_interaction?.transaction_data?.qr_code;
      if (!qrCode) {
        console.warn("⚠️ [pix] Resposta MP sem qr_code, usando mock sandbox.");
        return this.createMockCharge(input);
      }

      return {
        pixCopyPaste: qrCode,
        pixQrCodeBase64: json.point_of_interaction?.transaction_data?.qr_code_base64,
        provider: "mercadopago",
        providerPaymentId: json.id !== undefined ? String(json.id) : undefined,
      };
    } catch (err) {
      console.warn(`⚠️ [pix] Falha MP (${(err as Error).message}), usando mock sandbox.`);
      return this.createMockCharge(input);
    }
  }

  private static createMockCharge(input: PixChargeInput): PixChargeOutput {
    const pixKey = process.env.BILLING_PIX_KEY || "financeiro@brasafut.com.br";
    const valueStr = (input.amountCents / 100).toFixed(2);
    const pixPayload = `00020126580014br.gov.bcb.pix0136${pixKey}5204000053039865405${valueStr}5802BR5916BrasaFut API LTDA6009Sao Paulo62240520${input.paymentId}6304ABCD`;
    return { pixCopyPaste: pixPayload, provider: "mock" };
  }
}
