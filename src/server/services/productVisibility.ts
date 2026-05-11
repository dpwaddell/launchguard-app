import type { Shop } from "@prisma/client";
import { logger } from "../lib/logger.js";

type GraphqlResponse<T> = { data?: T; errors?: Array<{ message: string }> };

const PUBLICATION_LIST_QUERY = `#graphql
  query GetPublications {
    publications(first: 10) {
      nodes {
        id
        name
        catalog {
          id
        }
      }
    }
  }
`;

const PRODUCT_STATUS_QUERY = `#graphql
  query GetProductStatus($id: ID!) {
    product(id: $id) {
      id
      status
      publishedAt
      resourcePublicationsV2(first: 10) {
        nodes {
          publication {
            id
            name
          }
          isPublished
          publishDate
        }
      }
    }
  }
`;

const PRODUCT_PUBLISH_MUTATION = `#graphql
  mutation PublishProduct($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      publishable {
        ... on Product {
          id
          status
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const PRODUCT_UNPUBLISH_MUTATION = `#graphql
  mutation UnpublishProduct($id: ID!, $input: [PublicationInput!]!) {
    publishableUnpublish(id: $id, input: $input) {
      publishable {
        ... on Product {
          id
          status
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export type ProductPublicationState = {
  productId: string;
  status: string;
  publishedAt: string | null;
  publications: Array<{ publicationId: string; name: string; isPublished: boolean }>;
  capturedAt: string;
};

export async function captureProductPublicationState(
  shop: Pick<Shop, "shopDomain" | "accessToken">,
  shopifyProductId: string
): Promise<ProductPublicationState | null> {
  try {
    const data = await shopifyGraphql<{
      product: {
        id: string;
        status: string;
        publishedAt: string | null;
        resourcePublicationsV2: {
          nodes: Array<{ publication: { id: string; name: string }; isPublished: boolean; publishDate: string | null }>;
        };
      } | null;
    }>(shop, PRODUCT_STATUS_QUERY, { id: shopifyProductId });

    if (!data.product) return null;

    return {
      productId: shopifyProductId,
      status: data.product.status,
      publishedAt: data.product.publishedAt,
      publications: data.product.resourcePublicationsV2.nodes.map((node) => ({
        publicationId: node.publication.id,
        name: node.publication.name,
        isPublished: node.isPublished
      })),
      capturedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.warn({ err: error, shop: shop.shopDomain, productId: shopifyProductId }, "failed to capture product publication state");
    return null;
  }
}

export async function hideProduct(
  shop: Pick<Shop, "shopDomain" | "accessToken">,
  shopifyProductId: string,
  onlineStorePublicationId: string
) {
  try {
    const data = await shopifyGraphql<{ publishableUnpublish: { userErrors: Array<{ field: string; message: string }> } }>(
      shop,
      PRODUCT_UNPUBLISH_MUTATION,
      { id: shopifyProductId, input: [{ publicationId: onlineStorePublicationId }] }
    );

    const errors = data.publishableUnpublish?.userErrors ?? [];
    if (errors.length > 0) {
      logger.warn({ shop: shop.shopDomain, productId: shopifyProductId, errors }, "product unpublish had user errors");
    }

    logger.info({ shop: shop.shopDomain, productId: shopifyProductId }, "product hidden from online store");
    return { success: true, errors };
  } catch (error) {
    logger.error({ err: error, shop: shop.shopDomain, productId: shopifyProductId }, "product hide failed");
    throw error;
  }
}

export async function publishProduct(
  shop: Pick<Shop, "shopDomain" | "accessToken">,
  shopifyProductId: string,
  onlineStorePublicationId: string
) {
  try {
    const data = await shopifyGraphql<{ publishablePublish: { userErrors: Array<{ field: string; message: string }> } }>(
      shop,
      PRODUCT_PUBLISH_MUTATION,
      { id: shopifyProductId, input: [{ publicationId: onlineStorePublicationId }] }
    );

    const errors = data.publishablePublish?.userErrors ?? [];
    if (errors.length > 0) {
      logger.warn({ shop: shop.shopDomain, productId: shopifyProductId, errors }, "product publish had user errors");
    }

    logger.info({ shop: shop.shopDomain, productId: shopifyProductId }, "product published to online store");
    return { success: true, errors };
  } catch (error) {
    logger.error({ err: error, shop: shop.shopDomain, productId: shopifyProductId }, "product publish failed");
    throw error;
  }
}

export async function getOnlineStorePublicationId(shop: Pick<Shop, "shopDomain" | "accessToken">) {
  const data = await shopifyGraphql<{
    publications: { nodes: Array<{ id: string; name: string }> };
  }>(shop, PUBLICATION_LIST_QUERY, {});

  const onlineStore = data.publications.nodes.find(
    (p) => p.name === "Online Store" || p.name.toLowerCase().includes("online store")
  );

  if (!onlineStore) {
    logger.warn({ shop: shop.shopDomain }, "online store publication not found");
    return null;
  }

  return onlineStore.id;
}

async function shopifyGraphql<T>(
  shop: Pick<Shop, "shopDomain" | "accessToken">,
  query: string,
  variables: Record<string, unknown>
) {
  const response = await fetch(`https://${shop.shopDomain}/admin/api/2026-04/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": shop.accessToken },
    body: JSON.stringify({ query, variables })
  });

  const body = (await response.json()) as GraphqlResponse<T>;
  if (!response.ok || body.errors?.length || !body.data) {
    throw Object.assign(new Error(body.errors?.[0]?.message ?? "Shopify GraphQL request failed"), { statusCode: 502 });
  }
  return body.data;
}
