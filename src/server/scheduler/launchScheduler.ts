import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { activateCampaignLive, activateCampaignVip, endCampaign } from "../services/campaignLifecycle.js";

const POLL_INTERVAL_MS = 30_000;

export function startLaunchScheduler() {
  logger.info("launch scheduler started");
  const interval = setInterval(runSchedulerTick, POLL_INTERVAL_MS);
  interval.unref();
  return interval;
}

async function runSchedulerTick() {
  const now = new Date();

  try {
    await transitionToVipActive(now);
    await transitionToLive(now);
    await transitionToEnded(now);
  } catch (error) {
    logger.error({ err: error }, "scheduler tick failed");
  }
}

async function transitionToVipActive(now: Date) {
  const campaigns = await prisma.launchCampaign.findMany({
    where: {
      status: "SCHEDULED",
      isEnabled: true,
      vipAccessStartsAt: { lte: now },
      publicLaunchAt: { gt: now }
    },
    include: { shop: true }
  });

  for (const campaign of campaigns) {
    if (!campaign.shop.accessToken || campaign.shop.uninstalledAt) continue;

    try {
      await activateCampaignVip(campaign, campaign.shop);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.error({ err: error, campaignId: campaign.id, shop: campaign.shop.shopDomain }, "failed to transition campaign to VIP_ACTIVE");
      await prisma.launchCampaign.update({
        where: { id: campaign.id },
        data: { schedulerError: msg, schedulerLastRunAt: now }
      });
    }
  }
}

async function transitionToLive(now: Date) {
  const campaigns = await prisma.launchCampaign.findMany({
    where: {
      status: { in: ["SCHEDULED", "VIP_ACTIVE"] },
      isEnabled: true,
      publicLaunchAt: { lte: now }
    },
    include: { shop: true }
  });

  for (const campaign of campaigns) {
    if (!campaign.shop.accessToken || campaign.shop.uninstalledAt) continue;

    try {
      await activateCampaignLive(campaign, campaign.shop);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.error({ err: error, campaignId: campaign.id, shop: campaign.shop.shopDomain }, "failed to transition campaign to LIVE");
      await prisma.launchCampaign.update({
        where: { id: campaign.id },
        data: { schedulerError: msg, schedulerLastRunAt: now }
      });
    }
  }
}

async function transitionToEnded(now: Date) {
  const campaigns = await prisma.launchCampaign.findMany({
    where: {
      status: "LIVE",
      isEnabled: true,
      endsAt: { lte: now }
    },
    include: { shop: true }
  });

  for (const campaign of campaigns) {
    if (!campaign.shop.accessToken || campaign.shop.uninstalledAt) continue;

    try {
      await endCampaign(campaign, campaign.shop);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.error({ err: error, campaignId: campaign.id, shop: campaign.shop.shopDomain }, "failed to transition campaign to ENDED");
      await prisma.launchCampaign.update({
        where: { id: campaign.id },
        data: { schedulerError: msg, schedulerLastRunAt: now }
      });
    }
  }
}
