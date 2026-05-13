import { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../lib/prisma.js";
import { requireAdminSession, getBearerToken } from "../middleware/adminAuth.js";
import { shopify } from "../lib/shopify.js";
import { campaignsRouter } from "./campaigns.js";
import { settingsRouter } from "./settings.js";
import { billingRouter } from "./billing.js";
import { supportRouter } from "./support.js";
import { billingDiagnostics, verifyBillingForShop } from "../services/billing.js";
import { emailProviderStatus } from "../services/email.js";
import { getPlanDefinition, getPlanEntitlements, serializePlanDefinitions } from "../services/plans.js";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, "../web");

export const adminRouter = Router();
const apiAdminRouter = Router();

apiAdminRouter.use(requireAdminSession);
apiAdminRouter.use("/campaigns", campaignsRouter);
apiAdminRouter.use("/settings", settingsRouter);
apiAdminRouter.use("/billing", billingRouter);
apiAdminRouter.use(supportRouter);

apiAdminRouter.get("/bootstrap", async (req, res) => {
  const shopDomain = req.adminAuth!.shopDomain;
  let billingRefresh: { failed?: boolean; message?: string } = {};

  try {
    const verification = await verifyBillingForShop(req.adminAuth!.shop, req.adminAuth!.sessionToken);
    req.adminAuth!.shop = verification.shop;
  } catch (error) {
    billingRefresh = { failed: true, message: "Billing refresh failed. Plan state may be stale." };
    logger.warn({ err: error, shop: shopDomain }, "billing verification failed during admin bootstrap");
  }

  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    include: {
      settings: true,
      campaigns: {
        include: { products: true, accessRules: true, purchaseLimits: true },
        orderBy: { publicLaunchAt: "asc" }
      },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 50 }
    }
  });

  if (!shop) {
    res.json({ shop: null });
    return;
  }

  const now = new Date();
  const activeCampaigns = shop.campaigns.filter((c) => ["SCHEDULED", "VIP_ACTIVE", "LIVE"].includes(c.status) && c.isEnabled);
  const nextScheduled = shop.campaigns.find((c) => c.status === "SCHEDULED" && c.isEnabled && c.publicLaunchAt > now);
  const liveCampaigns = shop.campaigns.filter((c) => c.status === "LIVE" && c.isEnabled);

  const billing = billingDiagnostics(req.adminAuth!.shop, billingRefresh);

  res.json({
    shop: {
      domain: shop.shopDomain,
      planName: getPlanDefinition(shop.planName).key,
      plan: getPlanDefinition(shop.planName),
      plans: serializePlanDefinitions(shop.planName),
      entitlements: getPlanEntitlements(shop.planName),
      settings: shop.settings,
      campaigns: shop.campaigns,
      auditLogs: shop.auditLogs,
      dashboard: {
        totalCampaigns: shop.campaigns.length,
        activeCampaigns: activeCampaigns.length,
        liveCampaigns: liveCampaigns.length,
        nextScheduledLaunch: nextScheduled
          ? { id: nextScheduled.id, name: nextScheduled.name, publicLaunchAt: nextScheduled.publicLaunchAt }
          : null
      },
      diagnostics: {
        emailProvider: emailProviderStatus(),
        appUrl: env.APP_URL,
        appVersion: "0.1.0",
        billing
      }
    }
  });
});

// Bootstrap-specific guard: a valid session token for a shop that hasn't completed
// OAuth yet returns { shop: null } (200) so the frontend can show the install CTA.
// Missing or invalid tokens fall through to requireAdminSession which returns 401.
// All other /api/admin/* routes are unaffected.
adminRouter.get("/api/admin/bootstrap", async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) { next(); return; }

  try {
    const payload = await shopify.session.decodeSessionToken(token);
    const shopDomain = new URL(payload.dest).hostname.toLowerCase();
    const shop = await prisma.shop.findUnique({ where: { shopDomain } });
    if (!shop || shop.uninstalledAt) {
      res.json({ shop: null });
      return;
    }
  } catch {
    // Invalid token — let requireAdminSession produce the 401
  }

  next();
});

adminRouter.use("/api/admin", apiAdminRouter);

function isEmbeddedRequest(req: any): boolean {
  // Shopify always includes `host` (base64 shop/admin) when loading the app in the admin iframe.
  // `embedded=1` is the explicit flag. Either signals an iframe context where server-side OAuth
  // redirects are forbidden — those pages set X-Frame-Options: DENY and will break the iframe.
  return Boolean(req.query.host) || req.query.embedded === "1";
}

async function ensureInstalledAppPage(req: any, res: any) {
  const shop = typeof req.query.shop === "string" ? req.query.shop.toLowerCase() : "";

  if (shop && !isEmbeddedRequest(req)) {
    const installed = await prisma.shop.findUnique({ where: { shopDomain: shop } });
    if (!installed || installed.uninstalledAt) {
      res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
      return;
    }
  }

  res.sendFile("index.html", { root: "dist/web" });
}

adminRouter.get("/app", ensureInstalledAppPage);

adminRouter.get("*", async (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/auth") || req.path.startsWith("/oauth") || req.path.startsWith("/webhooks")) {
    next();
    return;
  }

  const shop = typeof req.query.shop === "string" ? req.query.shop.toLowerCase() : "";

  if (shop && !isEmbeddedRequest(req)) {
    const installed = await prisma.shop.findUnique({ where: { shopDomain: shop } });
    if (!installed || installed.uninstalledAt) {
      res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
      return;
    }
  }

  res.sendFile("index.html", { root: "dist/web" });
});
