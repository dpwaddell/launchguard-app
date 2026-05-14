import type { Shop } from "@prisma/client";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";
const ID_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id_token";
const OFFLINE_TOKEN_TYPE = "urn:shopify:params:oauth:token-type:offline-access-token";

export async function ensureExpiringOfflineAccessToken(shop: Shop, sessionToken?: string) {
  if (hasUsableExpiringOfflineToken(shop)) return shop;

  // Shopify's expiring offline token flow requires re-exchange via session token;
  // the refresh_token grant is not supported. Prefer session-token exchange when
  // available; fall back to refresh_token only for background contexts (no session).
  if (sessionToken) {
    return exchangeSessionTokenForExpiringOfflineToken(shop, sessionToken);
  }

  if (shop.offlineRefreshToken && refreshTokenUsable(shop)) {
    return refreshExpiringOfflineToken(shop);
  }

  return shop;
}

function hasUsableExpiringOfflineToken(shop: Shop) {
  return Boolean(
    shop.accessToken &&
      shop.offlineAccessTokenExpiresAt &&
      shop.offlineAccessTokenExpiresAt.getTime() > Date.now() + TOKEN_REFRESH_BUFFER_MS
  );
}

function refreshTokenUsable(shop: Shop) {
  return Boolean(!shop.offlineRefreshTokenExpiresAt || shop.offlineRefreshTokenExpiresAt.getTime() > Date.now() + TOKEN_REFRESH_BUFFER_MS);
}

async function exchangeSessionTokenForExpiringOfflineToken(shop: Shop, sessionToken: string) {
  const body = new URLSearchParams({
    client_id: env.SHOPIFY_API_KEY,
    client_secret: env.SHOPIFY_API_SECRET,
    grant_type: TOKEN_EXCHANGE_GRANT,
    subject_token: sessionToken,
    subject_token_type: ID_TOKEN_TYPE,
    requested_token_type: OFFLINE_TOKEN_TYPE,
    expiring: "1"
  });

  const token = await requestToken(shop.shopDomain, body);
  logger.info({ shop: shop.shopDomain }, "exchanged Shopify session token for expiring offline token");
  return persistTokenResponse(shop, token);
}

async function refreshExpiringOfflineToken(shop: Shop) {
  const body = new URLSearchParams({
    client_id: env.SHOPIFY_API_KEY,
    client_secret: env.SHOPIFY_API_SECRET,
    grant_type: "refresh_token",
    refresh_token: shop.offlineRefreshToken ?? ""
  });

  const token = await requestToken(shop.shopDomain, body);
  logger.info({ shop: shop.shopDomain }, "refreshed Shopify expiring offline token");
  return persistTokenResponse(shop, token);
}

async function requestToken(shopDomain: string, body: URLSearchParams) {
  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const payload = (await response.json()) as TokenResponse;
  if (!response.ok || !payload.access_token) {
    logger.warn({ shop: shopDomain, status: response.status, error: payload.error }, "Shopify token request failed");
    throw Object.assign(new Error(payload.error_description ?? payload.error ?? "Shopify token request failed"), { statusCode: 502 });
  }

  return payload;
}

async function persistTokenResponse(shop: Shop, token: TokenResponse) {
  const now = Date.now();
  const accessTokenExpiresAt = token.expires_in ? new Date(now + token.expires_in * 1000) : null;
  const refreshTokenExpiresAt = token.refresh_token_expires_in ? new Date(now + token.refresh_token_expires_in * 1000) : null;

  return prisma.shop.update({
    where: { id: shop.id },
    data: {
      accessToken: token.access_token!,
      scope: token.scope ?? shop.scope,
      offlineAccessTokenExpiresAt: accessTokenExpiresAt,
      offlineRefreshToken: token.refresh_token ?? shop.offlineRefreshToken,
      offlineRefreshTokenExpiresAt: refreshTokenExpiresAt ?? shop.offlineRefreshTokenExpiresAt
    }
  });
}
