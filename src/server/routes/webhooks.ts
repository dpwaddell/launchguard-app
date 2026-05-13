import crypto from "node:crypto";
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";

export const webhooksRouter = Router();

type WebhookPayload = {
  shop_domain?: string;
  customer?: { email?: string };
};

type VerifiedWebhookRequest = Request & {
  verifiedWebhook: {
    shopDomain: string;
    topic: string;
    payload: WebhookPayload;
  };
};

function verifyShopifyWebhook(req: Request, res: Response, next: NextFunction) {
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  const hmac = req.header("x-shopify-hmac-sha256") ?? "";
  const expected = crypto.createHmac("sha256", env.SHOPIFY_API_SECRET).update(body).digest("base64");
  const hmacBuffer = Buffer.from(hmac, "base64");
  const expectedBuffer = Buffer.from(expected, "base64");

  if (!hmac || hmacBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(hmacBuffer, expectedBuffer)) {
    logger.warn({ topic: req.header("x-shopify-topic") ?? "unknown" }, "invalid shopify webhook hmac");
    res.status(401).send("Invalid webhook signature");
    return;
  }

  try {
    const payload = (body.length ? JSON.parse(body.toString("utf8")) : {}) as WebhookPayload;
    (req as VerifiedWebhookRequest).verifiedWebhook = {
      shopDomain: req.header("x-shopify-shop-domain") ?? payload.shop_domain ?? "",
      topic: req.header("x-shopify-topic") ?? "unknown",
      payload
    };
    next();
  } catch {
    res.status(400).send("Invalid webhook payload");
  }
}

webhooksRouter.use(verifyShopifyWebhook);

webhooksRouter.post("/app/uninstalled", async (req, res) => {
  const { shopDomain } = (req as VerifiedWebhookRequest).verifiedWebhook;
  await prisma.shop.updateMany({
    where: { shopDomain },
    data: { uninstalledAt: new Date(), accessToken: "" }
  });
  logger.info({ shopDomain }, "shop uninstalled webhook received");
  res.status(200).send("ok");
});

// Single handler for all GDPR compliance webhooks — dispatched by X-Shopify-Topic header
webhooksRouter.post("/", async (req, res) => {
  const { shopDomain, topic, payload } = (req as VerifiedWebhookRequest).verifiedWebhook;

  if (topic === "customers/data_request") {
    logger.info({ shopDomain }, "customers/data_request compliance webhook received");
    res.status(200).send("ok");
    return;
  }

  if (topic === "customers/redact") {
    const email = typeof payload.customer?.email === "string" ? payload.customer.email : undefined;
    if (email) {
      await prisma.supportRequest.updateMany({
        where: { shop: { shopDomain }, contactEmail: email },
        data: { contactEmail: `redacted-${Date.now()}@launchguard.invalid`, message: "Redacted" }
      });
    }
    logger.info({ shopDomain, redacted: Boolean(email) }, "customers/redact compliance webhook received");
    res.status(200).send("ok");
    return;
  }

  if (topic === "shop/redact") {
    await prisma.shop.deleteMany({ where: { shopDomain } });
    logger.info({ shopDomain }, "shop/redact compliance webhook received");
    res.status(200).send("ok");
    return;
  }

  logger.warn({ shopDomain, topic }, "unhandled webhook topic at root handler");
  res.status(200).send("ok");
});
