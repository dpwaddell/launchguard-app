import { Router } from "express";
import { verifyBillingForShop } from "../services/billing.js";
import { logger } from "../lib/logger.js";

export const billingRouter = Router();

billingRouter.post("/billing/refresh", async (req, res) => {
  const shop = req.adminAuth!.shop;
  const sessionToken = req.adminAuth!.sessionToken;

  try {
    const result = await verifyBillingForShop(shop, sessionToken);
    logger.info({ shop: shop.shopDomain, planName: result.planName, status: result.status }, "billing refreshed");
    res.json({ planName: result.planName, status: result.status });
  } catch (error) {
    logger.warn({ err: error, shop: shop.shopDomain }, "billing refresh failed");
    res.status(502).json({ error: "Billing refresh failed. Please try again." });
  }
});
