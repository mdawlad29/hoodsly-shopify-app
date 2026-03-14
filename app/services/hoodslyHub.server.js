import db from "../db.server";

const MAX_RETRIES = 3;
const ENDPOINT = process.env.HOODSLYHUB_ENDPOINT;

// Exponential backoff: 1min, 5min, 25min
function getBackoffMs(attempt) {
  return Math.pow(5, attempt) * 60 * 1000;
}

export async function syncOrderToHub(order) {
  const payload = {
    orderId: order.id,
    orderName: order.name,
    customerEmail: order.email,
    lineItems: order.lineItems.edges.map((e) => ({
      title: e.node.title,
      quantity: e.node.quantity,
      price: e.node.originalUnitPriceSet.shopMoney.amount,
      properties: e.node.customAttributes,
    })),
    shippingAddress: order.shippingAddress,
    orderTotal: order.totalPriceSet.shopMoney.amount,
  };

  // Create or find log entry
  let log = await db.syncLog.findFirst({
    where: { orderId: order.id },
  });

  if (!log) {
    log = await db.syncLog.create({
      data: {
        orderId: order.id,
        orderName: order.name || order.id,
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

    // SUCCESS
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
      // PERMANENTLY FAILED
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
      // SCHEDULE RETRY
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
