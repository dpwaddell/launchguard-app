import type { Prisma, Shop } from "@prisma/client";

export type PlanKey = "FREE" | "STARTER" | "GROWTH" | "SCALE";

export type PlanEntitlements = {
  activeLaunchLimit: number | null;
  productsPerLaunch: number | null;
  vipAccess: boolean;
  purchaseLimits: boolean;
  seoSuppression: boolean;
  hiddenProductControls: boolean;
  brandingEnabled: boolean;
};

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  price: number;
  interval: "month";
  badge?: string;
  description: string;
  features: string[];
  entitlements: PlanEntitlements;
};

export const PLAN_DEFINITIONS: Record<PlanKey, PlanDefinition> = {
  FREE: {
    key: "FREE",
    name: "Free",
    price: 0,
    interval: "month",
    description: "Test a launch setup with one product and a simple countdown.",
    features: [
      "1 active launch",
      "1 product per launch",
      "Basic countdown timer",
      "LaunchGuard branding",
      "Audit log"
    ],
    entitlements: {
      activeLaunchLimit: 1,
      productsPerLaunch: 1,
      vipAccess: false,
      purchaseLimits: false,
      seoSuppression: false,
      hiddenProductControls: false,
      brandingEnabled: true
    }
  },
  STARTER: {
    key: "STARTER",
    name: "Starter",
    price: 9,
    interval: "month",
    badge: "Best for small stores",
    description: "Run up to 10 launches with VIP access and SEO suppression.",
    features: [
      "Up to 10 active launches",
      "Up to 10 products per launch",
      "VIP early access by customer tag",
      "SEO suppression before launch",
      "Hidden product controls",
      "Countdown customisation",
      "Remove branding"
    ],
    entitlements: {
      activeLaunchLimit: 10,
      productsPerLaunch: 10,
      vipAccess: true,
      purchaseLimits: false,
      seoSuppression: true,
      hiddenProductControls: true,
      brandingEnabled: false
    }
  },
  GROWTH: {
    key: "GROWTH",
    name: "Growth",
    price: 29,
    interval: "month",
    badge: "Most popular",
    description: "Unlimited launches with purchase limits and one-per-customer rules.",
    features: [
      "Unlimited launches",
      "Unlimited products per launch",
      "Purchase limits (per order)",
      "One-per-customer rules",
      "VIP early access windows",
      "Full purchase limit enforcement",
      "Remove branding"
    ],
    entitlements: {
      activeLaunchLimit: null,
      productsPerLaunch: null,
      vipAccess: true,
      purchaseLimits: true,
      seoSuppression: true,
      hiddenProductControls: true,
      brandingEnabled: false
    }
  },
  SCALE: {
    key: "SCALE",
    name: "Scale",
    price: 79,
    interval: "month",
    badge: "Coming soon",
    description: "Future placeholder — advanced analytics, Shopify Flow, and bot controls.",
    features: [
      "Everything in Growth",
      "Shopify Flow integration",
      "Advanced analytics",
      "Bot/queue controls",
      "Priority support"
    ],
    entitlements: {
      activeLaunchLimit: null,
      productsPerLaunch: null,
      vipAccess: true,
      purchaseLimits: true,
      seoSuppression: true,
      hiddenProductControls: true,
      brandingEnabled: false
    }
  }
};

export function normalizePlanName(planName: string | null | undefined): PlanKey {
  if (planName === "STARTER" || planName === "GROWTH" || planName === "SCALE") return planName;
  return "FREE";
}

export function getPlanDefinition(planName: string | null | undefined) {
  return PLAN_DEFINITIONS[normalizePlanName(planName)];
}

export function getPlanEntitlements(planName: string | null | undefined) {
  return getPlanDefinition(planName).entitlements;
}

export function serializePlanDefinitions(currentPlanName: string | null | undefined) {
  const currentPlan = normalizePlanName(currentPlanName);
  return Object.values(PLAN_DEFINITIONS).map((plan) => ({
    ...plan,
    current: plan.key === currentPlan
  }));
}

export function billingLimitError(message: string, planName: string | null | undefined, requiredPlan: PlanKey) {
  // `error` is included explicitly because Error.message is non-enumerable and
  // won't appear in JSON.stringify — without it the frontend falls back to a generic toast.
  return Object.assign(new Error(message), {
    error: message,
    statusCode: 402,
    code: "PLAN_LIMIT_REACHED",
    plan: normalizePlanName(planName),
    requiredPlan,
    upgradeRequired: true
  });
}

export async function assertActiveLaunchLimit(
  tx: Prisma.TransactionClient,
  shop: Pick<Shop, "id" | "planName">,
  nextEnabled: boolean,
  excludingCampaignId?: string
) {
  if (!nextEnabled) return;

  const limit = getPlanEntitlements(shop.planName).activeLaunchLimit;
  if (limit === null) return;

  const activeLaunches = await tx.launchCampaign.count({
    where: {
      shopId: shop.id,
      isEnabled: true,
      status: { in: ["SCHEDULED", "VIP_ACTIVE", "LIVE"] },
      ...(excludingCampaignId ? { id: { not: excludingCampaignId } } : {})
    }
  });

  if (activeLaunches >= limit) {
    throw billingLimitError(
      `Your current plan allows ${limit} active ${limit === 1 ? "launch" : "launches"}. Disable an existing launch or upgrade to add more.`,
      shop.planName,
      shop.planName === "FREE" ? "STARTER" : "GROWTH"
    );
  }
}

export async function assertProductsPerLaunchLimit(
  tx: Prisma.TransactionClient,
  shop: Pick<Shop, "planName">,
  campaignId: string,
  nextProductCount: number
) {
  const limit = getPlanEntitlements(shop.planName).productsPerLaunch;
  if (limit === null) return;

  if (nextProductCount > limit) {
    throw billingLimitError(
      `Your current plan allows ${limit} ${limit === 1 ? "product" : "products"} per launch. Remove a product or upgrade to add more.`,
      shop.planName,
      shop.planName === "FREE" ? "STARTER" : "GROWTH"
    );
  }
}
