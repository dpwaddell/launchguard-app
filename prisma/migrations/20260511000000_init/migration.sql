-- CreateEnum
CREATE TYPE "PlanName" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'SCALE');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'VIP_ACTIVE', 'LIVE', 'ENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "LimitType" AS ENUM ('PER_ORDER', 'PER_CUSTOMER');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "SupportIssueType" AS ENUM ('SETUP_HELP', 'LAUNCH_NOT_WORKING', 'VIP_ACCESS', 'PURCHASE_LIMITS', 'STOREFRONT_DISPLAY', 'BILLING_PLAN', 'OTHER');

-- CreateEnum
CREATE TYPE "FeatureCategory" AS ENUM ('LAUNCH_SCHEDULING', 'VIP_ACCESS', 'PURCHASE_LIMITS', 'STOREFRONT_DISPLAY', 'ANALYTICS', 'INTEGRATIONS', 'OTHER');

-- CreateEnum
CREATE TYPE "FeatureImportance" AS ENUM ('NICE_TO_HAVE', 'IMPORTANT', 'NEEDED_FOR_NEXT_LAUNCH');

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "offlineAccessTokenExpiresAt" TIMESTAMP(3),
    "offlineRefreshToken" TEXT,
    "offlineRefreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT NOT NULL,
    "planName" "PlanName" NOT NULL DEFAULT 'FREE',
    "billingPlanName" "PlanName",
    "billingSubscriptionId" TEXT,
    "billingStatus" TEXT NOT NULL DEFAULT 'NONE',
    "billingConfirmationUrl" TEXT,
    "billingCurrentPeriodEnd" TIMESTAMP(3),
    "billingTest" BOOLEAN NOT NULL DEFAULT false,
    "billingLastVerifiedAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "state" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "accessToken" TEXT,
    "scope" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "brandingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchCampaign" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "publicLaunchAt" TIMESTAMP(3) NOT NULL,
    "vipAccessStartsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "seoSuppressionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "countdownTitle" TEXT NOT NULL DEFAULT 'Coming soon',
    "countdownBody" TEXT NOT NULL DEFAULT 'This product will be available soon.',
    "lockedMessage" TEXT NOT NULL DEFAULT 'This product is not yet available.',
    "vipMessage" TEXT NOT NULL DEFAULT 'You have early access. Enjoy the launch!',
    "brandingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "schedulerLastRunAt" TIMESTAMP(3),
    "schedulerError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchCampaignProduct" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyProductHandle" TEXT NOT NULL,
    "shopifyProductTitle" TEXT NOT NULL DEFAULT '',
    "originalPublicationState" JSONB,
    "originalSeoState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaunchCampaignProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchAccessRule" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "customerTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaunchAccessRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchPurchaseLimit" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "limitType" "LimitType" NOT NULL,
    "maxQuantity" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "validationMessage" TEXT NOT NULL DEFAULT 'This launch is limited to {max} per order.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchPurchaseLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT,
    "issueType" "SupportIssueType" NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "diagnostics" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureRequest" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "FeatureCategory" NOT NULL,
    "importance" "FeatureImportance" NOT NULL,
    "planName" TEXT NOT NULL,
    "diagnostics" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT,
    "action" TEXT NOT NULL,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");
CREATE INDEX "Shop_shopDomain_idx" ON "Shop"("shopDomain");
CREATE INDEX "Session_shopDomain_idx" ON "Session"("shopDomain");
CREATE INDEX "Session_shopId_idx" ON "Session"("shopId");
CREATE UNIQUE INDEX "ShopSettings_shopId_key" ON "ShopSettings"("shopId");
CREATE INDEX "LaunchCampaign_shopId_status_idx" ON "LaunchCampaign"("shopId", "status");
CREATE INDEX "LaunchCampaign_shopId_publicLaunchAt_idx" ON "LaunchCampaign"("shopId", "publicLaunchAt");
CREATE INDEX "LaunchCampaign_status_publicLaunchAt_idx" ON "LaunchCampaign"("status", "publicLaunchAt");
CREATE INDEX "LaunchCampaign_status_vipAccessStartsAt_idx" ON "LaunchCampaign"("status", "vipAccessStartsAt");
CREATE INDEX "LaunchCampaign_status_endsAt_idx" ON "LaunchCampaign"("status", "endsAt");
CREATE INDEX "LaunchCampaignProduct_campaignId_idx" ON "LaunchCampaignProduct"("campaignId");
CREATE UNIQUE INDEX "LaunchCampaignProduct_campaignId_shopifyProductId_key" ON "LaunchCampaignProduct"("campaignId", "shopifyProductId");
CREATE INDEX "LaunchAccessRule_campaignId_idx" ON "LaunchAccessRule"("campaignId");
CREATE UNIQUE INDEX "LaunchAccessRule_campaignId_customerTag_key" ON "LaunchAccessRule"("campaignId", "customerTag");
CREATE INDEX "LaunchPurchaseLimit_campaignId_idx" ON "LaunchPurchaseLimit"("campaignId");
CREATE UNIQUE INDEX "LaunchPurchaseLimit_campaignId_limitType_key" ON "LaunchPurchaseLimit"("campaignId", "limitType");
CREATE INDEX "SupportRequest_shopId_createdAt_idx" ON "SupportRequest"("shopId", "createdAt");
CREATE INDEX "FeatureRequest_shopId_createdAt_idx" ON "FeatureRequest"("shopId", "createdAt");
CREATE INDEX "AuditLog_shopId_createdAt_idx" ON "AuditLog"("shopId", "createdAt");
CREATE INDEX "AuditLog_shopId_campaignId_createdAt_idx" ON "AuditLog"("shopId", "campaignId", "createdAt");
CREATE INDEX "AuditLog_severity_createdAt_idx" ON "AuditLog"("severity", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopSettings" ADD CONSTRAINT "ShopSettings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LaunchCampaign" ADD CONSTRAINT "LaunchCampaign_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LaunchCampaignProduct" ADD CONSTRAINT "LaunchCampaignProduct_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "LaunchCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LaunchAccessRule" ADD CONSTRAINT "LaunchAccessRule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "LaunchCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LaunchPurchaseLimit" ADD CONSTRAINT "LaunchPurchaseLimit_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "LaunchCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeatureRequest" ADD CONSTRAINT "FeatureRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
