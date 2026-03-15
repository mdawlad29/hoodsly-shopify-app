import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useFetcher, useLoaderData } from "react-router";

export async function loader({ request }) {
  await authenticate.admin(request);
  const rushOrders = await db.rushOrder.findMany({
    orderBy: { markedAt: "desc" },
  });
  return { rushOrders };
}

export async function action({ request }) {
  const formData = await request.formData();
  const orderId = formData.get("orderId");
  const orderName = formData.get("orderName");
  const intent = formData.get("intent");

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

// ─── Component ──────

export default function RushOrders() {
  const { rushOrders } = useLoaderData();
  const fetcher = useFetcher();

  return (
    <s-page title="Rush Manufacturing Queue">
      <ui-title-bar title="Rush Manufacturing Queue" />

      <s-layout>
        <s-layout-section>
          {/* Info banner */}
          <s-banner tone="info">
            Orders marked as Rush Manufacturing are prioritized at the top.
          </s-banner>

          <s-card>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {["Order", "Marked At", "Priority", "Action"].map((h) => (
                      <th key={h} style={styles.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rushOrders.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={styles.emptyCell}>
                        No rush orders yet.
                      </td>
                    </tr>
                  ) : (
                    rushOrders.map((ro, i) => (
                      <tr key={ro.orderId} style={styles.tr}>
                        {/* Order name */}
                        <td style={styles.td}>{ro.orderName}</td>

                        {/* Marked at */}
                        <td style={styles.td}>
                          {new Date(ro.markedAt).toLocaleString()}
                        </td>

                        {/* Priority badge */}
                        <td style={styles.td}>
                          <s-badge tone={i === 0 ? "success" : "attention"}>
                            {i === 0 ? "TOP PRIORITY" : `#${i + 1}`}
                          </s-badge>
                        </td>

                        {/* Remove action */}
                        <td style={styles.td}>
                          <fetcher.Form method="post">
                            <input
                              type="hidden"
                              name="orderId"
                              value={ro.orderId}
                            />
                            <input type="hidden" name="intent" value="unmark" />
                            <button type="submit" style={styles.btnDanger}>
                              Remove
                            </button>
                          </fetcher.Form>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {rushOrders.length > 0 && (
              <div style={styles.footer}>{rushOrders.length} orders</div>
            )}
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

// ─── Styles ────

const styles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  th: {
    padding: "10px 16px",
    textAlign: "left",
    fontWeight: 600,
    color: "#6b7177",
    borderBottom: "1px solid #e1e3e5",
    whiteSpace: "nowrap",
    background: "#f6f6f7",
  },
  tr: {
    borderBottom: "1px solid #f1f1f1",
  },
  td: {
    padding: "10px 16px",
    verticalAlign: "middle",
    color: "#202223",
  },
  emptyCell: {
    padding: "32px",
    textAlign: "center",
    color: "#6b7177",
  },
  footer: {
    padding: "10px 16px",
    borderTop: "1px solid #e1e3e5",
    fontSize: "13px",
    color: "#6b7177",
    textAlign: "right",
  },
  btnDanger: {
    padding: "4px 10px",
    fontSize: "12px",
    border: "1px solid #d72c0d",
    borderRadius: "5px",
    background: "#fff0ed",
    cursor: "pointer",
    color: "#d72c0d",
    fontWeight: 500,
  },
};
