// src/utils/hubspot.ts
import fetch from "node-fetch";

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY!;

interface HubSpotContact {
  id: string;
  properties: {
    email: string;
    [key: string]: any;
  };
}

interface HubSpotMarketingResponse {
  updated: string[];
  skipped: string[];
  errors: any[];
}

/**
 * Create a contact in HubSpot and mark it as a marketing contact
 */
export async function addContactToHubSpot(email: string, site: string) {
  try {
    // 1. Create the contact
    const createResponse = await fetch(
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
            website: site,
          },
        }),
      }
    );

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      throw new Error(
        `❌ HubSpot create contact error: ${createResponse.status} - ${errText}`
      );
    }

    const contact: HubSpotContact =
      (await createResponse.json()) as HubSpotContact;

    // 2. Upgrade to marketing contact
    const setMarketingResponse = await fetch(
      "https://api.hubapi.com/marketing/v3/marketing-contacts/set-as-marketing-contact",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: [
            {
              id: contact.id,
            },
          ],
        }),
      }
    );

    if (!setMarketingResponse.ok) {
      const errText = await setMarketingResponse.text();
      throw new Error(
        `⚠️ HubSpot marketing upgrade error: ${setMarketingResponse.status} - ${errText}`
      );
    }

    const marketingData: HubSpotMarketingResponse =
      (await setMarketingResponse.json()) as HubSpotMarketingResponse;

    return {
      contact,
      marketingData,
    };
  } catch (error: any) {
    console.error("❌ Failed to add HubSpot contact:", error.message);
    throw error;
  }
}
