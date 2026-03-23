import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useFetcher, useLoaderData } from "react-router";

export async function loader({ request }) {
  await authenticate.admin(request);

  const [rushOrders, syncLogs] = await Promise.all([
    db.rushOrder.findMany({ orderBy: { markedAt: "desc" } }),
    db.syncLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  // Rush marked order IDs
  const rushOrderIds = new Set(rushOrders.map((r) => r.orderId));

  // Sync log orders that are NOT rush yet
  const availableOrders = syncLogs.filter(
    (log) => !rushOrderIds.has(log.orderId),
  );

  return { rushOrders, availableOrders };
}

export async function action({ request }) {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const orderId = formData.get("orderId");
  const orderName = formData.get("orderName");

  if (intent === "mark") {
    await db.rushOrder.upsert({
      where: { orderId },
      create: { orderId, orderName: orderName || orderId },
      update: { markedAt: new Date() },
    });
  } else if (intent === "unmark") {
    await db.rushOrder.delete({ where: { orderId } });
  }

  return { success: true };
}

export default function RushOrders() {
  const { rushOrders, availableOrders } = useLoaderData();
  const fetcher = useFetcher();

  return (
    <s-page heading="Rush Manufacturing Queue">
      <ui-title-bar title="Rush Manufacturing Queue" />

      {/* ── Rush Queue ── */}
      <s-section heading={`Priority Queue (${rushOrders.length})`}>
        {rushOrders.length === 0 ? (
          <div style={styles.emptyState}>
            No rush orders yet. Mark an order as Rush below.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                {["Priority", "Order", "Marked At", "Action"].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rushOrders.map((ro, i) => (
                <tr key={ro.id} style={styles.tr}>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.badge,
                        background: i === 0 ? "#008060" : "#b98900",
                        color: "#fff",
                      }}
                    >
                      {i === 0 ? "🔥 TOP" : `#${i + 1}`}
                    </span>
                  </td>
                  <td style={{ ...styles.td, fontWeight: 600 }}>
                    {ro.orderName}
                  </td>
                  <td style={styles.td}>
                    {new Date(ro.markedAt).toLocaleString()}
                  </td>
                  <td style={styles.td}>
                    <fetcher.Form method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="intent" value="unmark" />
                      <input type="hidden" name="orderId" value={ro.orderId} />
                      <button type="submit" style={styles.btnDanger}>
                        Remove Rush
                      </button>
                    </fetcher.Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </s-section>

      {/* ── Available Orders to Mark ── */}
      <s-section
        heading={`Mark Order as Rush (${availableOrders.length} available)`}
      >
        {availableOrders.length === 0 ? (
          <div style={styles.emptyState}>
            No orders available. Place a test order first.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                {["Order", "Email", "Status", "Date", "Action"].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {availableOrders.map((log) => (
                <tr key={log.id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: 600 }}>
                    {log.orderName}
                  </td>
                  <td style={styles.td}>{log.customerEmail || "—"}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.badge,
                        background:
                          log.status === "synced" ? "#e3f1df" : "#fdf3d3",
                        color: log.status === "synced" ? "#008060" : "#b98900",
                      }}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {new Date(log.createdAt).toLocaleDateString()}
                  </td>
                  <td style={styles.td}>
                    <fetcher.Form method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="intent" value="mark" />
                      <input type="hidden" name="orderId" value={log.orderId} />
                      <input
                        type="hidden"
                        name="orderName"
                        value={log.orderName}
                      />
                      <button type="submit" style={styles.btnPrimary}>
                        Mark as Rush 🔥
                      </button>
                    </fetcher.Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </s-section>
    </s-page>
  );
}

const styles = {
  emptyState: {
    padding: "32px",
    textAlign: "center",
    color: "#6b7177",
    fontSize: "14px",
    background: "#f6f6f7",
    borderRadius: "8px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  thead: {
    background: "#f6f6f7",
  },
  th: {
    padding: "10px 12px",
    textAlign: "left",
    fontWeight: 600,
    color: "#6b7177",
    borderBottom: "2px solid #e1e3e5",
  },
  tr: {
    borderBottom: "1px solid #f1f1f1",
  },
  td: {
    padding: "10px 12px",
    verticalAlign: "middle",
    color: "#202223",
  },
  badge: {
    padding: "3px 8px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 600,
  },
  btnPrimary: {
    padding: "6px 12px",
    background: "#000",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
  },
  btnDanger: {
    padding: "6px 12px",
    background: "#fff0ed",
    color: "#d72c0d",
    border: "1px solid #d72c0d",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
  },
};
