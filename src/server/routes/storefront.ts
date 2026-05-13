import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const storefrontRouter = Router();

storefrontRouter.get("/apps/launchguard/campaign-config", async (req, res) => {
  const shop = typeof req.query.shop === "string" ? req.query.shop : null;
  const productHandle = typeof req.query.product === "string" ? req.query.product : null;

  if (!shop || !productHandle) {
    res.json({ campaign: null });
    return;
  }

  const shopRecord = await prisma.shop.findUnique({ where: { shopDomain: shop } });
  if (!shopRecord || shopRecord.uninstalledAt) {
    res.json({ campaign: null });
    return;
  }

  const product = await prisma.launchCampaignProduct.findFirst({
    where: {
      shopifyProductHandle: productHandle,
      campaign: {
        shopId: shopRecord.id,
        isEnabled: true,
        status: { in: ["SCHEDULED", "VIP_ACTIVE", "LIVE"] }
      }
    },
    include: {
      campaign: {
        include: { accessRules: true }
      }
    }
  });

  if (!product) {
    res.json({ campaign: null });
    return;
  }

  const campaign = product.campaign;
  const now = new Date();

  res.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      publicLaunchAt: campaign.publicLaunchAt.toISOString(),
      vipAccessStartsAt: campaign.vipAccessStartsAt?.toISOString() ?? null,
      endsAt: campaign.endsAt?.toISOString() ?? null,
      countdownTitle: campaign.countdownTitle,
      countdownBody: campaign.countdownBody,
      lockedMessage: campaign.lockedMessage,
      vipMessage: campaign.vipMessage,
      brandingEnabled: campaign.brandingEnabled,
      hidePriceBeforeLaunch: campaign.hidePriceBeforeLaunch,
      vipTags: campaign.accessRules.map((r) => r.customerTag),
      serverTime: now.toISOString()
    }
  });
});
