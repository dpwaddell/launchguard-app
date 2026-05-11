import type { LaunchCampaign, Shop } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import {
  captureProductPublicationState,
  getOnlineStorePublicationId,
  hideProduct,
  publishProduct
} from "./productVisibility.js";

export async function activateCampaignVip(
  campaign: LaunchCampaign,
  shop: Pick<Shop, "id" | "shopDomain" | "accessToken">
) {
  await prisma.launchCampaign.update({
    where: { id: campaign.id },
    data: { status: "VIP_ACTIVE", schedulerLastRunAt: new Date(), schedulerError: null }
  });

  await prisma.auditLog.create({
    data: {
      shopId: shop.id,
      campaignId: campaign.id,
      action: "CAMPAIGN_VIP_ACTIVE",
      severity: "INFO",
      message: `Campaign "${campaign.name}" entered VIP early access window`
    }
  });

  logger.info({ shop: shop.shopDomain, campaignId: campaign.id, name: campaign.name }, "campaign transitioned to VIP_ACTIVE");
}

export async function activateCampaignLive(
  campaign: LaunchCampaign,
  shop: Pick<Shop, "id" | "shopDomain" | "accessToken">
) {
  const onlineStorePublicationId = await getOnlineStorePublicationId(shop).catch(() => null);

  const products = await prisma.launchCampaignProduct.findMany({
    where: { campaignId: campaign.id }
  });

  let publishErrors: string[] = [];

  for (const product of products) {
    if (onlineStorePublicationId) {
      try {
        await publishProduct(shop, product.shopifyProductId, onlineStorePublicationId);
        await prisma.auditLog.create({
          data: {
            shopId: shop.id,
            campaignId: campaign.id,
            action: "PRODUCT_PUBLISHED",
            severity: "INFO",
            message: `Product "${product.shopifyProductTitle || product.shopifyProductHandle}" published at launch`,
            metadata: { productId: product.shopifyProductId }
          }
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        publishErrors.push(msg);
        await prisma.auditLog.create({
          data: {
            shopId: shop.id,
            campaignId: campaign.id,
            action: "PRODUCT_PUBLISH_FAILED",
            severity: "ERROR",
            message: `Failed to publish product "${product.shopifyProductHandle}" at launch: ${msg}`,
            metadata: { productId: product.shopifyProductId, error: msg }
          }
        });
      }
    }
  }

  await prisma.launchCampaign.update({
    where: { id: campaign.id },
    data: {
      status: "LIVE",
      schedulerLastRunAt: new Date(),
      schedulerError: publishErrors.length > 0 ? publishErrors[0] : null
    }
  });

  await prisma.auditLog.create({
    data: {
      shopId: shop.id,
      campaignId: campaign.id,
      action: "CAMPAIGN_LIVE",
      severity: "INFO",
      message: `Campaign "${campaign.name}" went live`
    }
  });

  logger.info({ shop: shop.shopDomain, campaignId: campaign.id, name: campaign.name, publishErrors }, "campaign transitioned to LIVE");
}

export async function endCampaign(
  campaign: LaunchCampaign,
  shop: Pick<Shop, "id" | "shopDomain" | "accessToken">
) {
  await prisma.launchCampaign.update({
    where: { id: campaign.id },
    data: { status: "ENDED", schedulerLastRunAt: new Date(), schedulerError: null }
  });

  await prisma.auditLog.create({
    data: {
      shopId: shop.id,
      campaignId: campaign.id,
      action: "CAMPAIGN_ENDED",
      severity: "INFO",
      message: `Campaign "${campaign.name}" ended`
    }
  });

  logger.info({ shop: shop.shopDomain, campaignId: campaign.id, name: campaign.name }, "campaign ended");
}

export async function captureAndHideProducts(
  campaign: LaunchCampaign,
  shop: Pick<Shop, "id" | "shopDomain" | "accessToken">
) {
  if (!shop.accessToken) return;

  const onlineStorePublicationId = await getOnlineStorePublicationId(shop).catch(() => null);
  const products = await prisma.launchCampaignProduct.findMany({ where: { campaignId: campaign.id } });

  for (const product of products) {
    try {
      const state = await captureProductPublicationState(shop, product.shopifyProductId);
      if (state) {
        await prisma.launchCampaignProduct.update({
          where: { id: product.id },
          data: { originalPublicationState: state as object }
        });
      }

      if (onlineStorePublicationId) {
        await hideProduct(shop, product.shopifyProductId, onlineStorePublicationId);
        await prisma.auditLog.create({
          data: {
            shopId: shop.id,
            campaignId: campaign.id,
            action: "PRODUCT_HIDDEN",
            severity: "INFO",
            message: `Product "${product.shopifyProductHandle}" hidden before launch`,
            metadata: { productId: product.shopifyProductId }
          }
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.warn({ err: error, shop: shop.shopDomain, productId: product.shopifyProductId }, "failed to hide product");
      await prisma.auditLog.create({
        data: {
          shopId: shop.id,
          campaignId: campaign.id,
          action: "PRODUCT_HIDE_FAILED",
          severity: "WARN",
          message: `Could not hide product "${product.shopifyProductHandle}": ${msg}`,
          metadata: { productId: product.shopifyProductId, error: msg }
        }
      });
    }
  }
}
