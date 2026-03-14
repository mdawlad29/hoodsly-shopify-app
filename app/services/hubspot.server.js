const HUBSPOT_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const BASE = "https://api.hubapi.com";

export async function sendToHubSpot(order) {
  if (!HUBSPOT_TOKEN) return;

  try {
    // 1. Check if contact exists
    const searchRes = await fetch(`${BASE}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HUBSPOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: "email",
                operator: "EQ",
                value: order.email,
              },
            ],
          },
        ],
      }),
    });

    const searchData = await searchRes.json();
    let contactId;

    if (searchData.total > 0) {
      // Contact exists — update
      contactId = searchData.results[0].id;
      await fetch(`${BASE}/crm/v3/objects/contacts/${contactId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${HUBSPOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            firstname: order.billingAddress?.firstName || "",
            lastname: order.billingAddress?.lastName || "",
            phone: order.phone || "",
          },
        }),
      });
    } else {
      // Create new contact
      const createRes = await fetch(`${BASE}/crm/v3/objects/contacts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUBSPOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            email: order.email,
            firstname: order.billingAddress?.firstName || "",
            lastname: order.billingAddress?.lastName || "",
            phone: order.phone || "",
          },
        }),
      });
      const createData = await createRes.json();
      contactId = createData.id;
    }

    // 2. Create a Deal for this order
    await fetch(`${BASE}/crm/v3/objects/deals`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HUBSPOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          dealname: `Shopify Order ${order.name}`,
          amount: order.totalPrice,
          dealstage: "closedwon",
          closedate: new Date().toISOString(),
        },
        associations: [
          {
            to: { id: contactId },
            types: [
              { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    console.error("HubSpot sync error:", err);
  }
}
