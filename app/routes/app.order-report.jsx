import { useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const tag = url.searchParams.get("tag") || "";
  const startDate = url.searchParams.get("start") || "";
  const endDate = url.searchParams.get("end") || "";

  const query = `query getOrders($query: String) {
    orders(first: 100, query: $query) {
      edges {
        node {
          id name email totalPriceSet { shopMoney { amount } }
          createdAt
          customer { tags }
        }
      }
    }
  }`;

  let queryStr = "status:any";
  if (tag) queryStr += ` tag:${tag}`;
  if (startDate) queryStr += ` created_at:>=${startDate}`;
  if (endDate) queryStr += ` created_at:<=${endDate}`;

  const res = await admin.graphql(query, { variables: { query: queryStr } });
  const data = await res.json();
  const orders = data.data.orders.edges.map((e) => e.node);

  const totalRevenue = orders.reduce(
    (sum, o) => sum + parseFloat(o.totalPriceSet.shopMoney.amount),
    0,
  );
  const avgOrderValue = orders.length ? totalRevenue / orders.length : 0;

  return { orders, totalRevenue, avgOrderValue };
}

export default function OrderReport() {
  const { orders, totalRevenue, avgOrderValue } = useLoaderData();
  const [tag, setTag] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const applyFilter = () => {
    const params = new URLSearchParams();
    if (tag) params.set("tag", tag);
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    window.location.search = params.toString();
  };

  const exportCSV = () => {
    const headers = ["Order", "Email", "Total", "Date"];
    const rows = orders.map((o) => [
      o.name,
      o.email,
      o.totalPriceSet.shopMoney.amount,
      new Date(o.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orders.csv";
    a.click();
  };

  const stats = [
    { label: "Total Orders", value: orders.length },
    { label: "Total Revenue", value: `$${totalRevenue.toFixed(2)}` },
    { label: "Avg Order Value", value: `$${avgOrderValue.toFixed(2)}` },
  ];

  return (
    <s-page title="Order Report">
      <ui-title-bar title="Order Report">
        <button variant="primary" onClick={exportCSV}>
          Export CSV
        </button>
      </ui-title-bar>

      <s-layout>
        {/* ── Filter bar ── */}
        <s-layout-section>
          <s-card>
            <div style={styles.filterBar}>
              <div style={{ flex: 1 }}>
                <label style={styles.label} htmlFor="tag">
                  Customer Tag
                </label>
                <input
                  style={styles.input}
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="e.g. wholesale"
                  autoComplete="off"
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={styles.label} htmlFor="start">
                  Start Date
                </label>
                <input
                  style={styles.input}
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={styles.label} htmlFor="end">
                  End Date
                </label>
                <input
                  style={styles.input}
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>

              <div style={{ alignSelf: "flex-end" }}>
                <button onClick={applyFilter}>Apply</button>
              </div>
            </div>
          </s-card>
        </s-layout-section>

        {/* ── Stat cards ── */}
        <s-layout-section>
          <div style={styles.statGrid}>
            {stats.map(({ label, value }) => (
              <s-card key={label}>
                <div style={styles.statCard}>
                  <span style={styles.statLabel}>{label}</span>
                  <span style={styles.statValue}>{value}</span>
                </div>
              </s-card>
            ))}
          </div>
        </s-layout-section>

        {/* ── Orders table ── */}
        <s-layout-section>
          <s-card>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {["Order", "Email", "Total", "Date"].map((h) => (
                      <th key={h} style={styles.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={styles.emptyCell}>
                        No orders found.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id} style={styles.tr}>
                        <td style={styles.td}>{o.name}</td>
                        <td style={styles.td}>{o.email}</td>
                        <td style={{ ...styles.td, textAlign: "right" }}>
                          $
                          {parseFloat(o.totalPriceSet.shopMoney.amount).toFixed(
                            2,
                          )}
                        </td>
                        <td style={styles.td}>
                          {new Date(o.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {orders.length > 0 && (
              <div style={styles.footer}>{orders.length} orders</div>
            )}
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

const styles = {
  filterBar: {
    display: "flex",
    gap: "12px",
    padding: "16px",
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    marginBottom: "4px",
    color: "#202223",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "6px 10px",
    fontSize: "14px",
    border: "1px solid #babfc3",
    borderRadius: "6px",
    outline: "none",
    background: "#fff",
    color: "#202223",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
  },
  statCard: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  statLabel: {
    fontSize: "13px",
    color: "#6b7177",
  },
  statValue: {
    fontSize: "22px",
    fontWeight: 600,
    color: "#202223",
  },
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
};
