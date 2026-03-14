const ENDPOINT = process.env.BIRDEYE_ENDPOINT;
const MAX_RETRIES = 3;

export async function sendBirdEyeRequest(order) {
  const payload = {
    customerEmail: order.email,
    customerName: `${order.shippingAddress?.firstName} ${order.shippingAddress?.lastName}`,
    orderId: order.id,
    orderName: order.name,
    businessId: process.env.BIRDEYE_BUSINESS_ID,
  };

  await attemptBirdEye(payload, 0);
}

async function attemptBirdEye(payload, attempt) {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BIRDEYE_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log("BirdEye review request sent for order:", payload.orderName);
  } catch (err) {
    if (attempt < MAX_RETRIES - 1) {
      const delay = Math.pow(5, attempt + 1) * 60 * 1000;
      setTimeout(() => attemptBirdEye(payload, attempt + 1), delay);
    } else {
      console.error("BirdEye permanently failed:", err.message);
    }
  }
}
