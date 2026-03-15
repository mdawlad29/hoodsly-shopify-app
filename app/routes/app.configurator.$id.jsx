import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { useFetcher, useLoaderData } from "react-router";

// Zero @shopify/polaris imports needed.
// Layout/page/card/modal/banner/badge use Shopify s-* web components (globally available).
// Form inputs use native HTML elements with inline styles.

const FIELD_TYPES = [
  { label: "Dropdown", value: "dropdown" },
  { label: "Radio", value: "radio" },
  { label: "Text Input", value: "text" },
  { label: "Info Block", value: "info" },
];

// ─── Loader ───────────────────────────────────────────────────────────────────

export async function loader({ request, params }) {
  const { admin } = await authenticate.admin(request);
  const productId = `gid://shopify/Product/${params.id}`;

  const response = await admin.graphql(
    `
    query getProduct($id: ID!) {
      product(id: $id) {
        id
        title
        metafield(namespace: "hoodsly", key: "configurator_definition") {
          value
        }
      }
    }
  `,
    { variables: { id: productId } },
  );

  const data = await response.json();
  const product = data.data.product;
  const definition = product.metafield
    ? JSON.parse(product.metafield.value)
    : { fields: [] };

  return { product, definition };
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function action({ request, params }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const definition = JSON.parse(formData.get("definition"));
  const productId = `gid://shopify/Product/${params.id}`;

  await admin.graphql(
    `
    mutation setMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id key namespace value }
        userErrors { field message }
      }
    }
  `,
    {
      variables: {
        metafields: [
          {
            ownerId: productId,
            namespace: "hoodsly",
            key: "configurator_definition",
            type: "json",
            value: JSON.stringify(definition),
          },
        ],
      },
    },
  );

  return { success: true };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConfiguratorBuilder() {
  const { product, definition } = useLoaderData();
  const fetcher = useFetcher();

  const [fields, setFields] = useState(definition.fields || []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [saved, setSaved] = useState(false);
  const [fieldError, setFieldError] = useState("");

  useEffect(() => {
    if (fetcher.data?.success) {
      setSaved(true);
    }
  }, [fetcher.data]);

  // ── Field form state ──────────────────────────────────────────────────────

  const [fieldForm, setFieldForm] = useState({
    id: "",
    type: "dropdown",
    label: "",
    required: false,
    order: 1,
    options: [],
    conditions: [],
  });

  const openAddModal = () => {
    setEditingField(null);
    setFieldError("");
    setFieldForm({
      id: crypto.randomUUID(),
      type: "dropdown",
      label: "",
      required: false,
      order: fields.length + 1,
      options: [],
      conditions: [],
    });
    setModalOpen(true);
  };

  const openEditModal = (field) => {
    setEditingField(field.id);
    setFieldError("");
    setFieldForm({ ...field });
    setModalOpen(true);
  };

  const saveField = () => {
    if (!fieldForm.label.trim()) {
      setFieldError("Field label is required.");
      return;
    }
    setFieldError("");
    if (editingField) {
      setFields((prev) =>
        prev.map((f) => (f.id === editingField ? fieldForm : f)),
      );
    } else {
      setFields((prev) => [...prev, fieldForm]);
    }
    setModalOpen(false);
  };

  const deleteField = (id) => {
    if (editingField === id) setModalOpen(false);
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const saveDefinition = () => {
    const payload = { fields: [...fields].sort((a, b) => a.order - b.order) };
    setSaved(false);
    fetcher.submit({ definition: JSON.stringify(payload) }, { method: "post" });
  };

  // ── Option state ─────────────────────────────────────────────────────────

  const [newOption, setNewOption] = useState({
    label: "",
    value: "",
    priceAdder: 0,
  });

  const addOption = () => {
    if (!newOption.label.trim()) return;
    setFieldForm((prev) => ({
      ...prev,
      options: [...prev.options, { ...newOption }],
    }));
    setNewOption({ label: "", value: "", priceAdder: 0 });
  };

  // ── Condition state ──────────────────────────────────────────────────────

  const [newCondition, setNewCondition] = useState({
    fieldId: "",
    operator: "equals",
    value: "",
  });

  const addCondition = () => {
    if (!newCondition.fieldId || !newCondition.value) return;
    setFieldForm((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { ...newCondition }],
    }));
    setNewCondition({ fieldId: "", operator: "equals", value: "" });
  };

  const fieldIdOptions = fields
    .filter((f) => f.id !== editingField)
    .map((f) => ({ label: f.label || f.id, value: f.id }));

  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <s-page title={`Configurator: ${product.title}`}>
      {/* ui-title-bar wires JS actions correctly in Shopify embedded apps */}
      <ui-title-bar title={`Configurator: ${product.title}`}>
        <button variant="primary" onClick={saveDefinition}>
          Save Definition
        </button>
        <button onClick={() => (window.location.href = "/app")}>
          Products
        </button>
      </ui-title-bar>

      <s-layout>
        <s-layout-section>
          {/* ── Success banner ── */}
          {saved && (
            <s-banner tone="success" onDismiss={() => setSaved(false)}>
              Configurator saved successfully!
            </s-banner>
          )}

          <s-card>
            {/* Header */}
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>Fields ({fields.length})</span>
              <button onClick={openAddModal}>Add Field</button>
            </div>

            {/* Empty state */}
            {sortedFields.length === 0 && (
              <div style={styles.emptyState}>
                No fields yet. Click "Add Field" to get started.
              </div>
            )}

            {/* Fields list */}
            {sortedFields.length > 0 && (
              <ul style={styles.list}>
                {sortedFields.map((field) => (
                  <li key={field.id} style={styles.listItem}>
                    {/* Info */}
                    <div style={styles.fieldInfo}>
                      <span style={styles.fieldLabel}>{field.label}</span>
                      <div style={styles.badgeRow}>
                        <s-badge>{field.type}</s-badge>
                        {field.required && (
                          <s-badge tone="attention">Required</s-badge>
                        )}
                        {field.conditions.length > 0 && (
                          <s-badge tone="info">
                            {field.conditions.length} condition(s)
                          </s-badge>
                        )}
                        {field.options.length > 0 && (
                          <span style={styles.optionCount}>
                            {field.options.length} options
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={styles.actions}>
                      <button onClick={() => openEditModal(field)}>Edit</button>
                      <button onClick={() => deleteField(field.id)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </s-card>
        </s-layout-section>
      </s-layout>

      {/* ── Modal ── */}
      <s-modal
        open={modalOpen || undefined}
        onHide={() => setModalOpen(false)}
        heading={editingField ? "Edit Field" : "Add Field"}
      >
        {/* ── Basic field settings ── */}
        <s-box padding="400">
          {fieldError && (
            <s-banner tone="critical" style={{ marginBottom: "12px" }}>
              {fieldError}
            </s-banner>
          )}

          <div style={styles.grid2}>
            {/* Label */}
            <div>
              <label style={styles.label}>
                Field Label <span style={{ color: "#d72c0d" }}>*</span>
              </label>
              <input
                style={styles.input(!!fieldError && !fieldForm.label.trim())}
                value={fieldForm.label}
                onChange={(e) => {
                  setFieldError("");
                  setFieldForm((p) => ({ ...p, label: e.target.value }));
                }}
                autoComplete="off"
                placeholder="e.g. Color option"
              />
              {fieldError && !fieldForm.label.trim() && (
                <span style={styles.errorText}>{fieldError}</span>
              )}
            </div>

            {/* Type */}
            <div>
              <label style={styles.label}>Field Type</label>
              <select
                style={styles.input()}
                value={fieldForm.type}
                onChange={(e) =>
                  setFieldForm((p) => ({ ...p, type: e.target.value }))
                }
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Order */}
            <div>
              <label style={styles.label}>Display Order</label>
              <input
                style={styles.input()}
                type="number"
                min="1"
                value={fieldForm.order}
                onChange={(e) =>
                  setFieldForm((p) => ({
                    ...p,
                    order: Number(e.target.value) || 1,
                  }))
                }
              />
            </div>

            {/* Required */}
            <div style={styles.checkboxRow}>
              <input
                type="checkbox"
                id="field-required"
                checked={fieldForm.required}
                onChange={(e) =>
                  setFieldForm((p) => ({ ...p, required: e.target.checked }))
                }
              />
              <label htmlFor="field-required" style={{ cursor: "pointer" }}>
                Required field
              </label>
            </div>
          </div>
        </s-box>

        {/* ── Options (dropdown / radio only) ── */}
        {(fieldForm.type === "dropdown" || fieldForm.type === "radio") && (
          <s-box padding="400">
            <p style={styles.sectionHeading}>Options</p>

            {/* Existing options */}
            {fieldForm.options.length > 0 && (
              <div style={styles.itemList}>
                {fieldForm.options.map((opt, i) => (
                  <div key={i} style={styles.itemRow}>
                    <span style={{ fontSize: "13px" }}>
                      <strong>{opt.label}</strong>
                      <span style={{ color: "#6b7177" }}> ({opt.value})</span>
                      {opt.priceAdder > 0 && (
                        <span style={{ color: "#2e6b4e" }}>
                          {" "}
                          +${opt.priceAdder}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() =>
                        setFieldForm((p) => ({
                          ...p,
                          options: p.options.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add option row */}
            <div style={styles.grid4}>
              <div>
                <label style={styles.label}>Label</label>
                <input
                  style={styles.input()}
                  value={newOption.label}
                  onChange={(e) =>
                    setNewOption((p) => ({
                      ...p,
                      label: e.target.value,
                      value: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                    }))
                  }
                  placeholder="e.g. Red"
                  autoComplete="off"
                />
              </div>
              <div>
                <label style={styles.label}>Value (slug)</label>
                <input
                  style={styles.input()}
                  value={newOption.value}
                  onChange={(e) =>
                    setNewOption((p) => ({ ...p, value: e.target.value }))
                  }
                  placeholder="e.g. red"
                  autoComplete="off"
                />
              </div>
              <div>
                <label style={styles.label}>Price Adder ($)</label>
                <input
                  style={styles.input()}
                  type="number"
                  min="0"
                  step="0.01"
                  value={newOption.priceAdder}
                  onChange={(e) =>
                    setNewOption((p) => ({
                      ...p,
                      priceAdder: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button onClick={addOption} style={{ width: "100%" }}>
                  Add
                </button>
              </div>
            </div>
          </s-box>
        )}

        {/* ── Conditional visibility ── */}
        <s-box padding="400">
          <p style={styles.sectionHeading}>Conditional Visibility</p>

          {/* Existing conditions */}
          {fieldForm.conditions.length > 0 && (
            <div style={styles.itemList}>
              {fieldForm.conditions.map((cond, i) => (
                <div key={i} style={styles.itemRow}>
                  <span style={{ fontSize: "13px" }}>
                    Show when <strong>{cond.fieldId}</strong> {cond.operator}{" "}
                    <strong>{cond.value}</strong>
                  </span>
                  <button
                    onClick={() =>
                      setFieldForm((p) => ({
                        ...p,
                        conditions: p.conditions.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add condition row */}
          <div style={styles.grid4}>
            <div>
              <label style={styles.label}>Field</label>
              {fieldIdOptions.length > 0 ? (
                <select
                  style={styles.input()}
                  value={newCondition.fieldId}
                  onChange={(e) =>
                    setNewCondition((p) => ({ ...p, fieldId: e.target.value }))
                  }
                >
                  <option value="">— select —</option>
                  {fieldIdOptions.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  style={styles.input()}
                  value={newCondition.fieldId}
                  onChange={(e) =>
                    setNewCondition((p) => ({ ...p, fieldId: e.target.value }))
                  }
                  placeholder="field_id"
                  autoComplete="off"
                />
              )}
            </div>

            <div>
              <label style={styles.label}>Operator</label>
              <select
                style={styles.input()}
                value={newCondition.operator}
                onChange={(e) =>
                  setNewCondition((p) => ({ ...p, operator: e.target.value }))
                }
              >
                <option value="equals">Equals</option>
                <option value="not_equals">Not Equals</option>
              </select>
            </div>

            <div>
              <label style={styles.label}>Value</label>
              <input
                style={styles.input()}
                value={newCondition.value}
                onChange={(e) =>
                  setNewCondition((p) => ({ ...p, value: e.target.value }))
                }
                autoComplete="off"
                placeholder="e.g. red"
              />
            </div>

            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button onClick={addCondition} style={{ width: "100%" }}>
                Add
              </button>
            </div>
          </div>
        </s-box>

        {/* Modal footer */}
        <div
          slot="actions"
          style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}
        >
          <button onClick={() => setModalOpen(false)}>Cancel</button>
          <button variant="primary" onClick={saveField}>
            Save
          </button>
        </div>
      </s-modal>
    </s-page>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: "16px",
  },
  emptyState: {
    padding: "32px 16px",
    textAlign: "center",
    color: "#6b7177",
    fontSize: "14px",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderTop: "1px solid #e1e3e5",
  },
  fieldInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  fieldLabel: {
    fontWeight: 600,
    fontSize: "14px",
  },
  badgeRow: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  optionCount: {
    fontSize: "12px",
    color: "#6b7177",
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexShrink: 0,
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    marginBottom: "4px",
    color: "#202223",
  },
  input: (hasError = false) => ({
    width: "100%",
    boxSizing: "border-box",
    padding: "6px 10px",
    fontSize: "14px",
    border: `1px solid ${hasError ? "#d72c0d" : "#babfc3"}`,
    borderRadius: "6px",
    outline: "none",
    background: "#fff",
    color: "#202223",
  }),
  errorText: {
    color: "#d72c0d",
    fontSize: "12px",
    marginTop: "4px",
    display: "block",
  },
  sectionHeading: {
    margin: "0 0 12px",
    fontWeight: 600,
    fontSize: "14px",
    color: "#202223",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },
  grid4: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 120px 80px",
    gap: "10px",
    alignItems: "flex-start",
    marginTop: "12px",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    paddingTop: "22px",
    fontSize: "14px",
  },
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "12px",
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    background: "#f6f6f7",
    borderRadius: "6px",
  },
};
