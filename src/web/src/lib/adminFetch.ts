async function getSessionToken() {
  if (!window.shopify?.idToken) {
    throw new Error("Shopify App Bridge is not available");
  }
  await window.shopify.ready;
  return window.shopify.idToken();
}

export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await getSessionToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(input, { ...init, headers });
}
