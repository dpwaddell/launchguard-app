import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { shopify } from "../lib/shopify.js";
import { logger } from "../lib/logger.js";
import { ensureExpiringOfflineAccessToken } from "../services/adminAccessToken.js";

function getBearerToken(req: Request) {
  const header = req.header("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

function shopFromDest(dest: string) {
  const url = new URL(dest);
  return url.hostname.toLowerCase();
}

export async function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  const token = getBearerToken(req);

  if (!token) {
    res.status(401).json({ error: "Missing Shopify session token" });
    return;
  }

  try {
    const payload = await shopify.session.decodeSessionToken(token);
    const shopDomain = shopFromDest(payload.dest);
    const requestedShop = typeof req.query.shop === "string" ? req.query.shop.toLowerCase() : undefined;

    if (requestedShop && requestedShop !== shopDomain) {
      res.status(403).json({ error: "Shop does not match session token" });
      return;
    }

    let shop = await prisma.shop.findUnique({ where: { shopDomain } });

    if (!shop || shop.uninstalledAt) {
      res.status(401).json({ error: "Shop is not installed" });
      return;
    }

    try {
      shop = await ensureExpiringOfflineAccessToken(shop, token);
    } catch (error) {
      logger.warn({ err: error, shop: shopDomain }, "could not prepare expiring offline token for admin request");
    }

    req.adminAuth = {
      shopDomain,
      shopId: shop.id,
      payload,
      sessionToken: token,
      shop
    };

    next();
  } catch (error) {
    logger.warn({
      err: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
      shop: req.query.shop,
      hasAuthHeader: Boolean(req.header("authorization")),
      tokenPrefix: req.header("authorization")?.slice(0, 24)
    }, "invalid admin session token");
    res.status(401).json({ error: "Invalid Shopify session token" });
  }
}
