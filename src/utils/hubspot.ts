// src/utils/hubspot.ts
import fetch from "node-fetch";

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY!;

export async function addContactToHubSpot(email: string, site: string) {
  try {
    const response = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            email,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HubSpot error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("❌ Failed to add HubSpot contact:", error.message);
    throw error;
  }
}
