import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { shopify } from "../lib/shopify.js";
import { logger } from "../lib/logger.js";
import { registerRequiredWebhooks } from "../services/webhookRegistration.js";

async function fetchMerchantContact(shopDomain: string, accessToken: string) {
  if (!shopDomain || !accessToken) return {};

  try {
    const response = await fetch(`https://${shopDomain}/admin/api/2026-04/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({
        query: `#graphql
          query {
            shop {
              email
              contactEmail
              shopOwnerName
              name
            }
          }
        `
      })
    });

    const json = await response.json() as any;
    const shop = json?.data?.shop || {};

    return {
      merchantEmail: shop.email || null,
      merchantContactEmail: shop.contactEmail || null,
      shopOwnerName: shop.shopOwnerName || null
    };
  } catch (error) {
    logger.warn({ err: error, shopDomain }, "merchant contact fetch failed");
    return {};
  }
}

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
  const merchant = await fetchMerchantContact(session.shop, session.accessToken ?? "");

  const shop = await prisma.shop.upsert({
    where: { shopDomain: session.shop },
    create: {
      shopDomain: session.shop,
      accessToken: session.accessToken ?? "",
      scope: session.scope ?? "",
      ...merchant,
      ...((merchant as any).merchantEmail || (merchant as any).merchantContactEmail || (merchant as any).shopOwnerName
        ? { merchantDetailsCapturedAt: new Date() }
        : {})
    },
    update: {
      accessToken: session.accessToken ?? "",
      scope: session.scope ?? "",
      uninstalledAt: null,
      ...merchant,
      ...((merchant as any).merchantEmail || (merchant as any).merchantContactEmail || (merchant as any).shopOwnerName
        ? { merchantDetailsCapturedAt: new Date() }
        : {})
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
  const host = typeof req.query.host === "string" ? req.query.host : "";
    const hostParam = host ? `&host=${encodeURIComponent(host)}` : "";
    res.redirect(`/app?shop=${encodeURIComponent(session.shop)}${hostParam}`);
});
