import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useLoaderData } from "react-router";

export async function loader({ request }) {
  await authenticate.admin(request);
  const url = new URL(request.url);
  const start = url.searchParams.get("start") || "";
  const end = url.searchParams.get("end") || "";
  const status = url.searchParams.get("status") || "";

  const where = {};
  if (status) where.status = status;
  if (start || end) {
    where.createdAt = {};
    if (start) where.createdAt.gte = new Date(start);
    if (end) where.createdAt.lte = new Date(end + "T23:59:59");
  }

  const logs = await db.syncLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Parse payload to get order total
  const orders = logs.map((log) => {
    let payload = {};
    try {
      payload = JSON.parse(log.payload);
    } catch {
      // ignore
    }
    return {
      id: log.id,
      orderId: log.orderId,
      orderName: log.orderName,
      customerEmail: log.customerEmail,
      status: log.status,
      orderTotal: payload.orderTotal || "0.00",
      createdAt: log.createdAt,
    };
  });

  const totalRevenue = orders.reduce(
    (sum, o) => sum + parseFloat(o.orderTotal || 0),
    0,
  );
  const avgOrderValue = orders.length ? totalRevenue / orders.length : 0;

  return { orders, totalRevenue, avgOrderValue };
}

export default function OrderReport() {
  const { orders, totalRevenue, avgOrderValue } = useLoaderData();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState("");

  const applyFilter = () => {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (status) params.set("status", status);
    window.location.search = params.toString();
  };

  const exportCSV = () => {
    const headers = ["Order", "Email", "Total", "Status", "Date"];
    const rows = orders.map((o) => [
      o.orderName,
      o.customerEmail,
      o.orderTotal,
      o.status,
      new Date(o.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "order-report.csv";
    a.click();
  };

  const statusColor = {
    synced: "#008060",
    pending: "#b98900",
    failed: "#d82c0d",
    permanently_failed: "#d82c0d",
  };

  return (
    <s-page heading="Order Report">
      <s-section heading="Filters">
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div>
            <label
              htmlFor="start-date"
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: 600,
                fontSize: "13px",
              }}
            >
              Start Date
            </label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              style={{
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>
          <div>
            <label
              htmlFor="end-date"
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: 600,
                fontSize: "13px",
              }}
            >
              End Date
            </label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              style={{
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>
          <div>
            <label
              htmlFor="sync-status"
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: 600,
                fontSize: "13px",
              }}
            >
              Sync Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            >
              <option value="">All</option>
              <option value="synced">Synced</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="permanently_failed">Permanently Failed</option>
            </select>
          </div>
          <button
            onClick={applyFilter}
            style={{
              padding: "8px 16px",
              background: "#000",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Apply
          </button>
          <button
            onClick={exportCSV}
            style={{
              padding: "8px 16px",
              background: "#008060",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Export CSV
          </button>
        </div>
      </s-section>

      <s-section heading="Summary">
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {[
            ["Total Orders", orders.length],
            ["Total Revenue", `$${totalRevenue.toFixed(2)}`],
            ["Avg Order Value", `$${avgOrderValue.toFixed(2)}`],
          ].map(([label, val]) => (
            <div
              key={label}
              style={{
                flex: 1,
                minWidth: "140px",
                padding: "16px",
                background: "#f6f6f7",
                borderRadius: "8px",
                textAlign: "center",
                border: "1px solid #e1e3e5",
              }}
            >
              <div
                style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}
              >
                {label}
              </div>
              <div style={{ fontSize: "24px", fontWeight: "700" }}>{val}</div>
            </div>
          ))}
        </div>
      </s-section>

      <s-section heading={`Orders (${orders.length})`}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "14px",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "2px solid #e1e3e5",
                background: "#f6f6f7",
              }}
            >
              {["Order", "Email", "Total", "Sync Status", "Date"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    color: "#666",
                  }}
                >
                  No orders found. Place a test order to see data here.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} style={{ borderBottom: "1px solid #e1e3e5" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                    {o.orderName}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {o.customerEmail || "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    ${parseFloat(o.orderTotal || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: statusColor[o.status] + "20",
                        color: statusColor[o.status] || "#666",
                      }}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </s-section>
    </s-page>
  );
}
