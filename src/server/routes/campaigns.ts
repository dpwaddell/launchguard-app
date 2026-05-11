import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { assertActiveLaunchLimit, assertProductsPerLaunchLimit, getPlanEntitlements } from "../services/plans.js";
import { captureAndHideProducts } from "../services/campaignLifecycle.js";

export const campaignsRouter = Router();

const productSchema = z.object({
  shopifyProductId: z.string().min(1),
  shopifyProductHandle: z.string().min(1),
  shopifyProductTitle: z.string().default("")
});

const accessRuleSchema = z.object({
  customerTag: z.string().min(1)
});

const purchaseLimitSchema = z.object({
  limitType: z.enum(["PER_ORDER", "PER_CUSTOMER"]),
  maxQuantity: z.coerce.number().int().min(1),
  enabled: z.boolean().default(true),
  validationMessage: z.string().default("This launch is limited to {max} per order.")
});

const campaignSchema = z.object({
  name: z.string().min(1).max(200),
  timezone: z.string().default("UTC"),
  publicLaunchAt: z.string().datetime(),
  vipAccessStartsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  seoSuppressionEnabled: z.boolean().default(false),
  countdownTitle: z.string().default("Coming soon"),
  countdownBody: z.string().default("This product will be available soon."),
  lockedMessage: z.string().default("This product is not yet available."),
  vipMessage: z.string().default("You have early access. Enjoy the launch!"),
  brandingEnabled: z.boolean().default(true),
  isEnabled: z.boolean().default(true),
  products: z.array(productSchema).default([]),
  accessRules: z.array(accessRuleSchema).default([]),
  purchaseLimits: z.array(purchaseLimitSchema).default([])
});

campaignsRouter.get("/", async (req, res) => {
  const shopId = req.adminAuth!.shopId;
  const campaigns = await prisma.launchCampaign.findMany({
    where: { shopId },
    include: {
      products: true,
      accessRules: true,
      purchaseLimits: true
    },
    orderBy: { publicLaunchAt: "asc" }
  });
  res.json(campaigns);
});

campaignsRouter.get("/:id", async (req, res) => {
  const shopId = req.adminAuth!.shopId;
  const campaign = await prisma.launchCampaign.findFirst({
    where: { id: req.params.id, shopId },
    include: { products: true, accessRules: true, purchaseLimits: true }
  });

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  res.json(campaign);
});

campaignsRouter.post("/", async (req, res) => {
  const parsed = campaignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid campaign data", details: parsed.error.issues });
    return;
  }

  const shop = req.adminAuth!.shop;
  const entitlements = getPlanEntitlements(shop.planName);

  const { products, accessRules, purchaseLimits, ...campaignData } = parsed.data;

  if (!entitlements.vipAccess && accessRules.length > 0) {
    res.status(402).json({ error: "VIP access requires the Starter plan or higher.", upgradeRequired: true, requiredPlan: "STARTER" });
    return;
  }

  if (!entitlements.purchaseLimits && purchaseLimits.length > 0) {
    res.status(402).json({ error: "Purchase limits require the Growth plan.", upgradeRequired: true, requiredPlan: "GROWTH" });
    return;
  }

  if (!entitlements.seoSuppression && campaignData.seoSuppressionEnabled) {
    res.status(402).json({ error: "SEO suppression requires the Starter plan or higher.", upgradeRequired: true, requiredPlan: "STARTER" });
    return;
  }

  try {
    const campaign = await prisma.$transaction(async (tx) => {
      await assertActiveLaunchLimit(tx, shop, campaignData.isEnabled);
      await assertProductsPerLaunchLimit(tx, shop, "", products.length);

      const created = await tx.launchCampaign.create({
        data: {
          shopId: shop.id,
          ...campaignData,
          status: campaignData.isEnabled ? "SCHEDULED" : "DRAFT",
          publicLaunchAt: new Date(campaignData.publicLaunchAt),
          vipAccessStartsAt: campaignData.vipAccessStartsAt ? new Date(campaignData.vipAccessStartsAt) : null,
          endsAt: campaignData.endsAt ? new Date(campaignData.endsAt) : null,
          products: { create: products },
          accessRules: { create: accessRules },
          purchaseLimits: { create: purchaseLimits }
        },
        include: { products: true, accessRules: true, purchaseLimits: true }
      });

      return created;
    });

    await prisma.auditLog.create({
      data: {
        shopId: shop.id,
        campaignId: campaign.id,
        action: "CAMPAIGN_CREATED",
        severity: "INFO",
        message: `Campaign "${campaign.name}" created with ${products.length} product(s)`
      }
    });

    logger.info({ shop: shop.shopDomain, campaignId: campaign.id, name: campaign.name }, "campaign created");
    res.status(201).json(campaign);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "PLAN_LIMIT_REACHED") {
      res.status(402).json(error);
      return;
    }
    logger.error({ err: error, shop: shop.shopDomain }, "campaign creation failed");
    res.status(500).json({ error: "Campaign could not be created. Please try again." });
  }
});

campaignsRouter.put("/:id", async (req, res) => {
  const parsed = campaignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid campaign data", details: parsed.error.issues });
    return;
  }

  const shop = req.adminAuth!.shop;
  const entitlements = getPlanEntitlements(shop.planName);
  const { products, accessRules, purchaseLimits, ...campaignData } = parsed.data;

  const existing = await prisma.launchCampaign.findFirst({ where: { id: req.params.id, shopId: shop.id } });
  if (!existing) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  if (!entitlements.vipAccess && accessRules.length > 0) {
    res.status(402).json({ error: "VIP access requires the Starter plan or higher.", upgradeRequired: true, requiredPlan: "STARTER" });
    return;
  }

  if (!entitlements.purchaseLimits && purchaseLimits.length > 0) {
    res.status(402).json({ error: "Purchase limits require the Growth plan.", upgradeRequired: true, requiredPlan: "GROWTH" });
    return;
  }

  try {
    const campaign = await prisma.$transaction(async (tx) => {
      await assertActiveLaunchLimit(tx, shop, campaignData.isEnabled, req.params.id);
      await assertProductsPerLaunchLimit(tx, shop, req.params.id, products.length);

      await tx.launchCampaignProduct.deleteMany({ where: { campaignId: req.params.id } });
      await tx.launchAccessRule.deleteMany({ where: { campaignId: req.params.id } });
      await tx.launchPurchaseLimit.deleteMany({ where: { campaignId: req.params.id } });

      return tx.launchCampaign.update({
        where: { id: req.params.id },
        data: {
          ...campaignData,
          publicLaunchAt: new Date(campaignData.publicLaunchAt),
          vipAccessStartsAt: campaignData.vipAccessStartsAt ? new Date(campaignData.vipAccessStartsAt) : null,
          endsAt: campaignData.endsAt ? new Date(campaignData.endsAt) : null,
          products: { create: products },
          accessRules: { create: accessRules },
          purchaseLimits: { create: purchaseLimits }
        },
        include: { products: true, accessRules: true, purchaseLimits: true }
      });
    });

    await prisma.auditLog.create({
      data: {
        shopId: shop.id,
        campaignId: campaign.id,
        action: "CAMPAIGN_UPDATED",
        severity: "INFO",
        message: `Campaign "${campaign.name}" updated`
      }
    });

    logger.info({ shop: shop.shopDomain, campaignId: campaign.id }, "campaign updated");
    res.json(campaign);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "PLAN_LIMIT_REACHED") {
      res.status(402).json(error);
      return;
    }
    logger.error({ err: error, shop: shop.shopDomain, campaignId: req.params.id }, "campaign update failed");
    res.status(500).json({ error: "Campaign could not be updated. Please try again." });
  }
});

campaignsRouter.patch("/:id/toggle", async (req, res) => {
  const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
  const shop = req.adminAuth!.shop;

  const existing = await prisma.launchCampaign.findFirst({ where: { id: req.params.id, shopId: shop.id } });
  if (!existing) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  if (enabled && existing.status === "DRAFT") {
    await prisma.$transaction(async (tx) => {
      await assertActiveLaunchLimit(tx, shop, true, req.params.id);
      await tx.launchCampaign.update({ where: { id: req.params.id }, data: { isEnabled: true, status: "SCHEDULED" } });
    });
  } else {
    await prisma.launchCampaign.update({ where: { id: req.params.id }, data: { isEnabled: enabled } });
  }

  res.json({ ok: true });
});

campaignsRouter.delete("/:id", async (req, res) => {
  const shop = req.adminAuth!.shop;
  const existing = await prisma.launchCampaign.findFirst({ where: { id: req.params.id, shopId: shop.id } });
  if (!existing) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  await prisma.launchCampaign.delete({ where: { id: req.params.id } });

  await prisma.auditLog.create({
    data: {
      shopId: shop.id,
      action: "CAMPAIGN_DELETED",
      severity: "INFO",
      message: `Campaign "${existing.name}" deleted`
    }
  });

  logger.info({ shop: shop.shopDomain, campaignId: req.params.id }, "campaign deleted");
  res.json({ ok: true });
});

campaignsRouter.post("/:id/hide-products", async (req, res) => {
  const shop = req.adminAuth!.shop;
  const entitlements = getPlanEntitlements(shop.planName);

  if (!entitlements.hiddenProductControls) {
    res.status(402).json({ error: "Hidden product controls require the Starter plan or higher.", upgradeRequired: true, requiredPlan: "STARTER" });
    return;
  }

  const campaign = await prisma.launchCampaign.findFirst({ where: { id: req.params.id, shopId: shop.id } });
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  captureAndHideProducts(campaign, shop).catch((error) => {
    logger.error({ err: error, shop: shop.shopDomain, campaignId: campaign.id }, "background product hide failed");
  });

  res.json({ ok: true, message: "Product visibility update queued." });
});
