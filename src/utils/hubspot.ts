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

interface HubSpotErrorResponse {
  status: string;
  message: string;
  correlationId: string;
  category: string;
}

interface HubSpotMarketingResponse {
  updated: string[];
  skipped: string[];
  errors: any[];
}

/**
 * Create a contact in HubSpot and mark it as a marketing contact
 */
export async function addContactToHubSpot(
  email: string,
  site: string,
  signupSource: "warriorsol" | "foundation" | "tasha"
) {
  try {
    // 1. Create the contact with signupSource
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
            signup_source: signupSource,
          },
        }),
      }
    );

    if (createResponse.status === 409) {
      // Contact already exists
      const errData = (await createResponse.json()) as HubSpotErrorResponse;
      console.warn("⚠️ HubSpot contact already exists:", errData);

      return {
        success: false,
        message: "Email already exists in waitlist",
        existingId: errData.message?.match(/ID: (\d+)/)?.[1] || null,
      };
    }

    const responseData = await createResponse.json();

    // Type guard to validate the response matches HubSpotContact
    function isHubSpotContact(data: any): data is HubSpotContact {
      return (
        typeof data === "object" &&
        data !== null &&
        "id" in data &&
        "properties" in data &&
        "email" in data.properties
      );
    }

    if (!isHubSpotContact(responseData)) {
      throw new Error("Invalid response format from HubSpot API");
    }

    const contact = responseData;
  } catch (error: any) {
    console.error("❌ Failed to add HubSpot contact:", error.message);
    throw error;
  }
}
