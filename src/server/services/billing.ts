import type { PlanName, Shop } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { ensureExpiringOfflineAccessToken } from "./adminAccessToken.js";
import { getPlanDefinition, normalizePlanName, type PlanKey } from "./plans.js";

type GraphqlResponse<T> = { data?: T; errors?: Array<{ message: string }> };

type AppSubscription = {
  id: string;
  name: string;
  status: string;
  test?: boolean;
  currentPeriodEnd?: string | null;
};

const ACTIVE_SUBSCRIPTIONS = `#graphql
  query LaunchGuardActiveSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        test
        currentPeriodEnd
      }
    }
  }
`;

export async function verifyBillingForShop(shop: Shop, sessionToken?: string) {
  const currentShop = await ensureExpiringOfflineAccessToken(shop, sessionToken);
  const activeSubscriptions = await getActiveSubscriptions(currentShop);
  const matching = findManagedPricingSubscription(activeSubscriptions);
  const now = new Date();

  if (matching) {
    const planName = planNameFromSubscription(matching);
    const updatedShop = await prisma.shop.update({
      where: { id: currentShop.id },
      data: {
        planName: planName as PlanName,
        billingPlanName: planName as PlanName,
        billingSubscriptionId: matching.id,
        billingStatus: matching.status,
        billingConfirmationUrl: null,
        billingCurrentPeriodEnd: matching.currentPeriodEnd ? new Date(matching.currentPeriodEnd) : null,
        billingTest: Boolean(matching.test),
        billingLastVerifiedAt: now
      }
    });
    return { status: "active" as const, planName, subscription: matching, shop: updatedShop };
  }

  const updatedShop = await prisma.shop.update({
    where: { id: currentShop.id },
    data: {
      planName: "FREE",
      billingPlanName: null,
      billingSubscriptionId: null,
      billingStatus: "MISSING",
      billingConfirmationUrl: null,
      billingCurrentPeriodEnd: null,
      billingTest: false,
      billingLastVerifiedAt: now
    }
  });

  return { status: "missing" as const, planName: "FREE" as const, subscription: null, shop: updatedShop };
}

export function billingManageUrl(shopDomain: string) {
  const store = shopDomain.replace(/\.myshopify\.com$/i, "");
  return `https://admin.shopify.com/store/${encodeURIComponent(store)}/charges/${encodeURIComponent(env.SHOPIFY_APP_HANDLE)}/pricing_plans`;
}

export function billingDiagnostics(shop: Shop, refresh?: { failed?: boolean; message?: string }) {
  const status = refresh?.failed ? "degraded" : normalizeBillingStatus(shop);
  return {
    currentPlan: getPlanDefinition(shop.planName).name,
    status,
    planName: shop.billingPlanName ? normalizePlanName(shop.billingPlanName) : normalizePlanName(shop.planName),
    subscriptionId: shop.billingSubscriptionId,
    currentPeriodEnd: shop.billingCurrentPeriodEnd,
    lastVerifiedAt: shop.billingLastVerifiedAt,
    manageUrl: billingManageUrl(shop.shopDomain),
    test: shop.billingTest,
    refreshFailed: Boolean(refresh?.failed),
    refreshError: refresh?.message ?? null
  };
}

function normalizeBillingStatus(shop: Shop) {
  if (normalizePlanName(shop.planName) !== "FREE" && shop.billingStatus === "ACTIVE" && shop.billingSubscriptionId) return "active";
  return "missing";
}

async function getActiveSubscriptions(shop: Shop) {
  const response = await shopifyGraphql<{ currentAppInstallation: { activeSubscriptions: AppSubscription[] } }>(
    shop,
    ACTIVE_SUBSCRIPTIONS,
    {}
  );
  return response.currentAppInstallation.activeSubscriptions;
}

function findManagedPricingSubscription(subscriptions: AppSubscription[]) {
  const paidPlans: PlanKey[] = ["SCALE", "GROWTH", "STARTER"];
  return (
    paidPlans
      .map((planName) =>
        subscriptions.find((s) => s.status === "ACTIVE" && planNameFromSubscription(s) === planName)
      )
      .find(Boolean) ?? null
  );
}

function planNameFromSubscription(subscription: AppSubscription) {
  const normalizedName = subscription.name.trim().toLowerCase();
  const matching = (["STARTER", "GROWTH", "SCALE"] as const).find((planName) => {
    const plan = getPlanDefinition(planName);
    return normalizedName === plan.name.toLowerCase() || normalizedName === plan.key.toLowerCase();
  });
  return normalizePlanName(matching);
}

async function shopifyGraphql<T>(shop: Shop, query: string, variables: Record<string, unknown>) {
  const response = await fetch(`https://${shop.shopDomain}/admin/api/2026-04/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": shop.accessToken },
    body: JSON.stringify({ query, variables })
  });

  const body = (await response.json()) as GraphqlResponse<T>;
  if (!response.ok || body.errors?.length || !body.data) {
    logger.warn({ shop: shop.shopDomain, errors: body.errors, status: response.status }, "shopify billing graphql failed");
    throw Object.assign(new Error(body.errors?.[0]?.message ?? "Shopify Billing request failed"), { statusCode: 502 });
  }
  return body.data;
}
