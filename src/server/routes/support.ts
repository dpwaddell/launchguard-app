import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { notifyOwner } from "../services/email.js";

export const supportRouter = Router();

const supportRequestSchema = z.object({
  issueType: z.enum(["SETUP_HELP", "LAUNCH_NOT_WORKING", "VIP_ACCESS", "PURCHASE_LIMITS", "STOREFRONT_DISPLAY", "BILLING_PLAN", "OTHER"]),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  contactEmail: z.string().email(),
  campaignId: z.string().optional().nullable()
});

const featureRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category: z.enum(["LAUNCH_SCHEDULING", "VIP_ACCESS", "PURCHASE_LIMITS", "STOREFRONT_DISPLAY", "ANALYTICS", "INTEGRATIONS", "OTHER"]),
  importance: z.enum(["NICE_TO_HAVE", "IMPORTANT", "NEEDED_FOR_NEXT_LAUNCH"])
});

supportRouter.post("/support/request", async (req, res) => {
  const parsed = supportRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid support request data" });
    return;
  }

  const shop = req.adminAuth!.shop;

  let recentCampaignStatus = null;
  if (parsed.data.campaignId) {
    const campaign = await prisma.launchCampaign.findFirst({
      where: { id: parsed.data.campaignId, shopId: shop.id },
      select: { name: true, status: true, publicLaunchAt: true }
    });
    recentCampaignStatus = campaign;
  }

  const recentErrors = await prisma.auditLog.findMany({
    where: { shopId: shop.id, severity: "ERROR" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { action: true, message: true, createdAt: true }
  });

  const diagnostics = {
    shopDomain: shop.shopDomain,
    planName: shop.planName,
    appVersion: "0.1.0",
    selectedCampaignId: parsed.data.campaignId ?? null,
    recentCampaignStatus,
    recentAuditErrors: recentErrors,
    timestamp: new Date().toISOString()
  };

  const request = await prisma.supportRequest.create({
    data: {
      shopId: shop.id,
      campaignId: parsed.data.campaignId ?? null,
      issueType: parsed.data.issueType,
      subject: parsed.data.subject,
      message: parsed.data.message,
      contactEmail: parsed.data.contactEmail,
      planName: shop.planName,
      diagnostics
    }
  });

  logger.info({ shop: shop.shopDomain, requestId: request.id, issueType: parsed.data.issueType }, "support request submitted");

  notifyOwner(
    `[LaunchGuard Support] ${parsed.data.subject}`,
    `Shop: ${shop.shopDomain}\nPlan: ${shop.planName}\nIssue: ${parsed.data.issueType}\nFrom: ${parsed.data.contactEmail}\n\n${parsed.data.message}`
  ).catch(() => {});

  res.json({ ok: true, message: "Support request saved. We'll review it as soon as possible." });
});

supportRouter.post("/support/feature", async (req, res) => {
  const parsed = featureRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid feature request data" });
    return;
  }

  const shop = req.adminAuth!.shop;

  const diagnostics = {
    shopDomain: shop.shopDomain,
    planName: shop.planName,
    appVersion: "0.1.0",
    timestamp: new Date().toISOString()
  };

  const request = await prisma.featureRequest.create({
    data: {
      shopId: shop.id,
      ...parsed.data,
      planName: shop.planName,
      diagnostics
    }
  });

  logger.info({ shop: shop.shopDomain, requestId: request.id, category: parsed.data.category }, "feature request submitted");

  notifyOwner(
    `[LaunchGuard Feature] ${parsed.data.title}`,
    `Shop: ${shop.shopDomain}\nPlan: ${shop.planName}\nCategory: ${parsed.data.category}\nImportance: ${parsed.data.importance}\n\n${parsed.data.description}`
  ).catch(() => {});

  res.json({ ok: true, message: "Feature request submitted. Thank you for the feedback." });
});

supportRouter.get("/support/campaigns", async (req, res) => {
  const shopId = req.adminAuth!.shopId;
  const campaigns = await prisma.launchCampaign.findMany({
    where: { shopId },
    select: { id: true, name: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 20
  });
  res.json(campaigns);
});
