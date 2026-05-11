import type { Shop } from "@prisma/client";
import type { JwtPayload } from "@shopify/shopify-api";

declare global {
  namespace Express {
    interface Request {
      adminAuth?: {
        shopDomain: string;
        shopId: string;
        payload: JwtPayload;
        sessionToken: string;
        shop: Shop;
      };
    }
  }
}
