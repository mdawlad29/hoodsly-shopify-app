import { syncOrderToHub } from "../services/hoodslyHub.server";
import { sendToHubSpot } from "../services/hubspot.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { topic, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "ORDERS_CREATE": {
      const order = payload;
      // 1. Sync to HoodslyHub
      await syncOrderToHub(order);
      // 2. Send to HubSpot
      await sendToHubSpot(order);
      break;
    }

    case "ORDERS_FULFILLED": {
      const order = payload;
      // Send BirdEye review request
      const { sendBirdEyeRequest } = await import("../services/birdeye.server");
      await sendBirdEyeRequest(order);
      break;
    }

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  return new Response("OK", { status: 200 });
};
