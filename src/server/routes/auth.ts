import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { shopify } from "../lib/shopify.js";
import { logger } from "../lib/logger.js";
import { registerRequiredWebhooks } from "../services/webhookRegistration.js";

export const authRouter = Router();

authRouter.get("/auth", async (req, res) => {
  const shop = String(req.query.shop ?? "");
  if (!shop) {
    res.status(400).send("Missing shop");
    return;
  }

  const redirectUrl = await shopify.auth.begin({
    shop,
    callbackPath: "/auth/callback",
    isOnline: false,
    rawRequest: req,
    rawResponse: res
  });

  if (!res.headersSent) {
    res.redirect(redirectUrl);
  }
});

authRouter.get("/auth/callback", async (req, res) => {
  const callback = await shopify.auth.callback({ rawRequest: req, rawResponse: res });
  const session = callback.session;

  const shop = await prisma.shop.upsert({
    where: { shopDomain: session.shop },
    create: {
      shopDomain: session.shop,
      accessToken: session.accessToken ?? "",
      scope: session.scope ?? ""
    },
    update: {
      accessToken: session.accessToken ?? "",
      scope: session.scope ?? "",
      uninstalledAt: null
    }
  });

  await prisma.shopSettings.upsert({
    where: { shopId: shop.id },
    create: { shopId: shop.id },
    update: {}
  });

  const registeredWebhookTopics = await registerRequiredWebhooks(shop);

  await prisma.auditLog.create({
    data: {
      shopId: shop.id,
      action: "INSTALL_COMPLETED",
      severity: "INFO",
      message: "LaunchGuard installed"
    }
  });

  logger.info({ shop: session.shop, webhooks: registeredWebhookTopics }, "shop installed");
  res.redirect(`/app?shop=${encodeURIComponent(session.shop)}`);
});
