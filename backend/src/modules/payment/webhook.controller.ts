import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

import { getRazorpayConfig } from "@/core/config/externalServices";
import { ApiError } from "@/core/errors/apiError";
import prisma from "@/core/db/prisma";
import { applyGatewayPaymentUpdate } from "@/modules/payment/payment.service";

function getRawBody(req: Request) {
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (raw && raw.length) return raw;
  if (req.body) {
    return Buffer.from(JSON.stringify(req.body));
  }
  return Buffer.from("");
}

function verifyWebhookSignature(rawBody: Buffer, signature: string, secret: string) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
}

export async function razorpayWebhook(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!signature || Array.isArray(signature)) {
      throw new ApiError(400, "Missing webhook signature");
    }

    const config = await getRazorpayConfig();
    if (!config.webhookSecret) {
      throw new ApiError(500, "Razorpay webhook secret is not configured");
    }

    const rawBody = getRawBody(req);
    const isValid = verifyWebhookSignature(rawBody, signature, config.webhookSecret);
    if (!isValid) {
      throw new ApiError(400, "Invalid webhook signature");
    }

    const payload = rawBody.length ? JSON.parse(rawBody.toString("utf-8")) : req.body;
    const eventId: string | undefined = payload?.id;

    if (eventId) {
      const existing = await prisma.paymentLog.findFirst({
        where: { gatewayEventId: eventId },
        select: { id: true },
      });
      if (existing) {
        return res.status(200).json({ received: true, duplicate: true });
      }
    }

    const event = payload?.event as string | undefined;
    const paymentEntity = payload?.payload?.payment?.entity ?? null;
    const orderEntity = payload?.payload?.order?.entity ?? null;

    const orderId: string | null =
      paymentEntity?.order_id ?? orderEntity?.id ?? null;
    const paymentId: string | null = paymentEntity?.id ?? null;

    if (!orderId) {
      return res.status(200).json({ received: true });
    }

    try {
      if (event === "payment.captured" || event === "order.paid") {
        await applyGatewayPaymentUpdate({
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          status: "PAID",
          source: "WEBHOOK",
          gatewayEventId: eventId ?? null,
          rawPayload: payload,
        });
      } else if (event === "payment.failed") {
        await applyGatewayPaymentUpdate({
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          status: "FAILED",
          source: "WEBHOOK",
          gatewayEventId: eventId ?? null,
          rawPayload: payload,
        });
      }
    } catch {
      return res.status(200).json({ received: true, conflict: true });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    return next(error);
  }
}
