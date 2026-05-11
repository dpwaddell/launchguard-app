/**
 * LaunchGuard Cart and Checkout Validation Function
 *
 * Reads per-order limits from product metafields (namespace: launchguard, key: limits).
 * The metafield value is a JSON object: { perOrder: number | null }
 *
 * To activate: set the metafield on campaign products when a campaign goes live.
 * Clear the metafield when the campaign ends.
 *
 * TODO: Add cross-order per-customer enforcement once customer purchase history
 * query is available in the Function input.
 */

const input = JSON.parse(String.fromCharCode(...readInput()));
const errors = [];

const cart = input.cart;
const lines = cart?.lines ?? [];

for (const line of lines) {
  const limitMeta = line.merchandise?.product?.metafield;
  if (!limitMeta?.value) continue;

  let limits;
  try {
    limits = JSON.parse(limitMeta.value);
  } catch {
    continue;
  }

  if (limits.perOrder && typeof limits.perOrder === 'number') {
    const qty = line.quantity ?? 0;
    if (qty > limits.perOrder) {
      const msg = (limits.perOrderMessage ?? 'This launch is limited to {max} per order.')
        .replace('{max}', String(limits.perOrder));
      errors.push({
        localizedMessage: msg,
        target: 'cart'
      });
    }
  }
}

const result = {
  errors
};

writeOutput(new TextEncoder().encode(JSON.stringify(result)));
