import db from "../db.server";

const MAX_RETRIES = 3;
const ENDPOINT = process.env.HOODSLYHUB_ENDPOINT;

function getBackoffMs(attempt) {
  return Math.pow(5, attempt) * 60 * 1000;
}

export async function syncOrderToHub(order) {
  const lineItems = Array.isArray(order.line_items)
    ? order.line_items.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        price: item.price,
        properties: item.properties || [],
      }))
    : [];

  const payload = {
    orderId: String(order.id),
    orderName: order.name || String(order.id),
    customerEmail: order.email || order.contact_email || "",
    lineItems,
    shippingAddress: order.shipping_address || {},
    orderTotal: order.total_price || "0.00",
  };

  // Create or find log entry
  let log = await db.syncLog.findFirst({
    where: { orderId: String(order.id) },
  });

  if (!log) {
    log = await db.syncLog.create({
      data: {
        orderId: String(order.id),
        orderName: order.name || String(order.id),
        customerEmail: order.email || "",
        status: "pending",
        payload: JSON.stringify(payload),
      },
    });
  }

  await attemptSync(log.id, payload);
}

export async function attemptSync(logId, payload) {
  const log = await db.syncLog.findUnique({ where: { id: logId } });

  if (!log || log.status === "permanently_failed" || log.status === "synced") {
    return;
  }

  const attempt = log.attempts + 1;

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.HOODSLYHUB_SECRET}`,
      },
      body: JSON.stringify(payload || JSON.parse(log.payload)),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    await db.syncLog.update({
      where: { id: logId },
      data: {
        status: "synced",
        attempts: attempt,
        lastAttemptAt: new Date(),
        errorMessage: null,
        nextRetryAt: null,
      },
    });
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      await db.syncLog.update({
        where: { id: logId },
        data: {
          status: "permanently_failed",
          attempts: attempt,
          lastAttemptAt: new Date(),
          errorMessage: error.message,
          nextRetryAt: null,
        },
      });
    } else {
      const nextRetry = new Date(Date.now() + getBackoffMs(attempt));
      await db.syncLog.update({
        where: { id: logId },
        data: {
          status: "failed",
          attempts: attempt,
          lastAttemptAt: new Date(),
          errorMessage: error.message,
          nextRetryAt: nextRetry,
        },
      });
      setTimeout(() => attemptSync(logId, null), getBackoffMs(attempt));
    }
  }
}
