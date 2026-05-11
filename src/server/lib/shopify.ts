import "@shopify/shopify-api/adapters/node";
import { ApiVersion, shopifyApi } from "@shopify/shopify-api";
import { env } from "../config/env.js";

export const shopify = shopifyApi({
  apiKey: env.SHOPIFY_API_KEY,
  apiSecretKey: env.SHOPIFY_API_SECRET,
  scopes: env.SHOPIFY_SCOPES.split(",").map((scope) => scope.trim()),
  hostName: new URL(env.SHOPIFY_APP_URL).host,
  hostScheme: new URL(env.SHOPIFY_APP_URL).protocol.replace(":", "") as "http" | "https",
  apiVersion: ApiVersion.October25 ?? "2025-10",
  isEmbeddedApp: true,
  future: {
    unstable_managedPricingSupport: true
  }
});
