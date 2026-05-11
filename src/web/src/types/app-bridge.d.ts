interface ShopifyResourcePickerResult {
  id: string;
  title?: string;
  handle?: string;
  variants?: Array<{ id: string; title?: string }>;
}

interface ShopifyAppBridge {
  ready: Promise<void>;
  idToken: () => Promise<string>;
  resourcePicker?: (options: {
    type: "product" | "collection";
    action?: "select";
    multiple?: boolean;
    filter?: { variants?: boolean };
  }) => Promise<ShopifyResourcePickerResult[] | { selection?: ShopifyResourcePickerResult[] } | undefined>;
}

interface Window {
  shopify?: ShopifyAppBridge;
}
