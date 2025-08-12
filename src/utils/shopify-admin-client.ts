export async function shopifyAdminFetch(
  query: string,
  variables: Record<string, any> = {}
) {
  const storeDomain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
  const adminAccessToken = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;

  if (!storeDomain || !adminAccessToken) {
    throw new Error("Missing Shopify Admin API environment variables");
  }

  const cleanDomain = storeDomain.replace(/^https?:\/\//, "");

  const res = await fetch(
    `https://${cleanDomain}/admin/api/2025-04/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminAccessToken,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  const data = await res.json();

  if (!res.ok || data.errors) {
    console.error("Shopify Admin API error:", data.errors || res.statusText);
    throw new Error("Failed to fetch from Shopify Admin API");
  }

  return data.data;
}
