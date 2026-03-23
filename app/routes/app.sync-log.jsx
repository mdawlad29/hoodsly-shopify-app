import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { attemptSync } from "../services/hoodslyHub.server";
import { useFetcher, useLoaderData } from "react-router";

// ─── Loader ───────

export async function loader({ request }) {
  await authenticate.admin(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const search = url.searchParams.get("search") || "";

  const logs = await db.syncLog.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { orderName: { contains: search } },
              { customerEmail: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return { logs };
}

// ─── Action ───────

export async function action({ request }) {
  await authenticate.admin(request);
  const formData = await request.formData();
  const logId = formData.get("logId");

  console.log("formData", formData);
  console.log("logId", logId);

  await db.syncLog.update({
    where: { id: logId },
    data: { status: "pending", attempts: 0, errorMessage: null },
  });

  attemptSync(logId, null); // non-blocking

  return { success: true };
}

// ─── Status badge helper ─────

const STATUS_TONE = {
  synced: "success",
  pending: "attention",
  failed: "warning",
  permanently_failed: "critical",
};

function StatusBadge({ status }) {
  return (
    <s-badge tone={STATUS_TONE[status] || "default"}>
      {status.replace(/_/g, " ")}
    </s-badge>
  );
}

export default function SyncLog() {
  const { logs } = useLoaderData();
  const fetcher = useFetcher();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const handleFilter = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    window.location.search = params.toString();
  }, [search, status]);

  return (
    <s-page title="HoodslyHub Sync Log">
      <ui-title-bar title="HoodslyHub Sync Log" />

      <s-layout>
        <s-layout-section>
          {/* Success banner */}
          {fetcher.data?.success && (
            <s-banner tone="success">Retry triggered successfully!</s-banner>
          )}

          <s-card>
            {/* ── Filter bar ── */}
            <div style={styles.filterBar}>
              <div style={{ flex: 1 }}>
                <label style={styles.label} htmlFor="search">
                  Search
                </label>
                <input
                  style={styles.input}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFilter()}
                  placeholder="Order name or email..."
                  autoComplete="off"
                />
              </div>

              <div style={{ width: "180px" }}>
                <label style={styles.label} htmlFor="status">
                  Status
                </label>
                <select
                  style={styles.input}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="synced">Synced</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="permanently_failed">Permanently Failed</option>
                </select>
              </div>

              <div style={{ alignSelf: "flex-end" }}>
                <button onClick={handleFilter}>Filter</button>
              </div>
            </div>

            {/* ── Table ── */}
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {[
                      "Order",
                      "Email",
                      "Status",
                      "Attempts",
                      "Last Attempt",
                      "Error",
                      "Action",
                    ].map((h) => (
                      <th key={h} style={styles.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={styles.emptyCell}>
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} style={styles.tr}>
                        <td style={styles.td}>{log.orderName}</td>
                        <td style={styles.td}>{log.customerEmail}</td>
                        <td style={styles.td}>
                          <StatusBadge status={log.status} />
                        </td>
                        <td style={{ ...styles.td, textAlign: "center" }}>
                          {log.attempts}
                        </td>
                        <td style={styles.td}>
                          {log.lastAttemptAt
                            ? new Date(log.lastAttemptAt).toLocaleString()
                            : "—"}
                        </td>
                        <td style={{ ...styles.td, ...styles.errorCell }}>
                          {log.errorMessage || "—"}
                        </td>
                        <td style={styles.td}>
                          {(log.status === "failed" ||
                            log.status === "permanently_failed") && (
                            <fetcher.Form method="post">
                              <input
                                type="hidden"
                                name="logId"
                                value={log.id}
                              />
                              <button
                                type="submit"
                                style={
                                  log.status === "permanently_failed"
                                    ? styles.btnDanger
                                    : styles.btnDefault
                                }
                              >
                                Retry
                              </button>
                            </fetcher.Form>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={styles.footer}>{logs.length} records</div>
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

// ─── Styles ─────────

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
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  th: {
    padding: "10px 12px",
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
    padding: "10px 12px",
    verticalAlign: "middle",
    color: "#202223",
  },
  errorCell: {
    maxWidth: "240px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#6b7177",
    fontSize: "12px",
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
  btnDefault: {
    padding: "4px 10px",
    fontSize: "12px",
    border: "1px solid #babfc3",
    borderRadius: "5px",
    background: "#fff",
    cursor: "pointer",
    color: "#202223",
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
