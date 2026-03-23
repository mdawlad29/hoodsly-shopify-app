import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { Navigate, useFetcher, useLoaderData } from "react-router";

const FIELD_TYPES = [
  { label: "Dropdown", value: "dropdown" },
  { label: "Radio", value: "radio" },
  { label: "Text Input", value: "text" },
  { label: "Info Block", value: "info" },
];

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

// ── Empty field template ──
const emptyField = (order) => ({
  id: `field_${Date.now()}`,
  type: "dropdown",
  label: "",
  required: false,
  order,
  options: [],
  conditions: [],
});

export default function ConfiguratorBuilder() {
  const { product, definition } = useLoaderData();
  const fetcher = useFetcher();

  const [fields, setFields] = useState(definition.fields || []);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [newOption, setNewOption] = useState({
    label: "",
    value: "",
    priceAdder: 0,
  });
  const [newCondition, setNewCondition] = useState({
    fieldId: "",
    operator: "equals",
    value: "",
  });
  const [addingNew, setAddingNew] = useState(false);

  useEffect(() => {
    if (fetcher.data?.success) setSaved(true);
  }, [fetcher.data]);

  const startEdit = (field) => {
    setEditingId(field.id);
    setEditForm({
      ...field,
      options: [...field.options],
      conditions: [...field.conditions],
    });
    setAddingNew(false);
    setNewOption({ label: "", value: "", priceAdder: 0 });
    setNewCondition({ fieldId: "", operator: "equals", value: "" });
  };

  const startAdd = () => {
    const f = emptyField(fields.length + 1);
    setEditingId(f.id);
    setEditForm(f);
    setAddingNew(true);
    setNewOption({ label: "", value: "", priceAdder: 0 });
    setNewCondition({ fieldId: "", operator: "equals", value: "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setAddingNew(false);
  };

  const saveEdit = () => {
    if (!editForm.label.trim()) {
      alert("Field label is required.");
      return;
    }
    if (addingNew) {
      setFields((prev) => [...prev, { ...editForm }]);
    } else {
      setFields((prev) =>
        prev.map((f) => (f.id === editingId ? { ...editForm } : f)),
      );
    }
    setEditingId(null);
    setEditForm(null);
    setAddingNew(false);
  };

  const deleteField = (id) => {
    if (editingId === id) cancelEdit();
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const addOption = () => {
    if (!newOption.label.trim()) return;
    setEditForm((p) => ({ ...p, options: [...p.options, { ...newOption }] }));
    setNewOption({ label: "", value: "", priceAdder: 0 });
  };

  const removeOption = (i) => {
    setEditForm((p) => ({
      ...p,
      options: p.options.filter((_, j) => j !== i),
    }));
  };

  const addCondition = () => {
    if (!newCondition.fieldId || !newCondition.value) return;
    setEditForm((p) => ({
      ...p,
      conditions: [...p.conditions, { ...newCondition }],
    }));
    setNewCondition({ fieldId: "", operator: "equals", value: "" });
  };

  const removeCondition = (i) => {
    setEditForm((p) => ({
      ...p,
      conditions: p.conditions.filter((_, j) => j !== i),
    }));
  };

  const saveDefinition = () => {
    const payload = { fields: [...fields].sort((a, b) => a.order - b.order) };
    setSaved(false);
    const fd = new FormData();
    fd.append("definition", JSON.stringify(payload));
    fetcher.submit(fd, { method: "post" });
  };

  const otherFields = fields.filter((f) => f.id !== editingId);
  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  return (
    <s-page heading={`Configurator: ${product.title}`}>
      <ui-title-bar title={`Configurator: ${product.title}`} />

      <s-layout>
        <s-layout-section>
          {saved && (
            <s-banner tone="success" style={{ marginBottom: "16px" }}>
              ✓ Configurator saved successfully!
            </s-banner>
          )}

          {/* ── Toolbar ── */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button onClick={startAdd} style={btn.primary}>
              + Add Field
            </button>
            <button onClick={saveDefinition} style={btn.success}>
              💾 Save Definition
            </button>
          </div>

          {/* ── Add new field form ── */}
          {addingNew && editForm && (
            <div style={styles.editBox}>
              <div style={styles.editHeader}>
                <strong>New Field</strong>
                <button onClick={cancelEdit} style={btn.small}>
                  Cancel
                </button>
              </div>
              <FieldEditForm
                editForm={editForm}
                setEditForm={setEditForm}
                otherFields={otherFields}
                newOption={newOption}
                setNewOption={setNewOption}
                addOption={addOption}
                removeOption={removeOption}
                newCondition={newCondition}
                setNewCondition={setNewCondition}
                addCondition={addCondition}
                removeCondition={removeCondition}
              />
              <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                <button onClick={saveEdit} style={btn.success}>
                  Save Field
                </button>
                <button onClick={cancelEdit} style={btn.default}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Fields list ── */}
          {sortedFields.length === 0 && !addingNew && (
            <div style={styles.empty}>
              {`No fields yet. Click "+ Add Field" to get started.`}
            </div>
          )}

          {sortedFields.map((field) => (
            <div key={field.id} style={styles.fieldCard}>
              {/* Field row */}
              <div style={styles.fieldRow}>
                <div>
                  <span style={styles.fieldLabel}>
                    {field.label || <em style={{ color: "#999" }}>Untitled</em>}
                  </span>
                  <div style={styles.badgeRow}>
                    <span style={badge.default}>{field.type}</span>
                    {field.required && <span style={badge.warn}>Required</span>}
                    {field.conditions.length > 0 && (
                      <span style={badge.info}>
                        {field.conditions.length} condition(s)
                      </span>
                    )}
                    {field.options.length > 0 && (
                      <span style={badge.gray}>
                        {field.options.length} options
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {editingId === field.id ? (
                    <>
                      <button onClick={saveEdit} style={btn.success}>
                        Save
                      </button>
                      <button onClick={cancelEdit} style={btn.default}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(field)}
                        style={btn.default}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteField(field.id)}
                        style={btn.danger}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Inline edit form */}
              {editingId === field.id && editForm && !addingNew && (
                <div style={styles.inlineEdit}>
                  <FieldEditForm
                    editForm={editForm}
                    setEditForm={setEditForm}
                    otherFields={otherFields}
                    newOption={newOption}
                    setNewOption={setNewOption}
                    addOption={addOption}
                    removeOption={removeOption}
                    newCondition={newCondition}
                    setNewCondition={setNewCondition}
                    addCondition={addCondition}
                    removeCondition={removeCondition}
                  />
                </div>
              )}
            </div>
          ))}
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

// ── Reusable field edit form ──
function FieldEditForm({
  editForm,
  setEditForm,
  otherFields,
  newOption,
  setNewOption,
  addOption,
  removeOption,
  newCondition,
  setNewCondition,
  addCondition,
  removeCondition,
}) {
  return (
    <div>
      {/* Basic info */}
      <div style={styles.grid2}>
        <div>
          <label htmlFor="field-label" style={styles.label}>
            Field Label *
          </label>
          <input
            style={styles.input}
            value={editForm.label}
            onChange={(e) =>
              setEditForm((p) => ({ ...p, label: e.target.value }))
            }
            placeholder="e.g. Color Options"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="field-type" style={styles.label}>
            Field Type
          </label>
          <select
            style={styles.input}
            value={editForm.type}
            onChange={(e) =>
              setEditForm((p) => ({ ...p, type: e.target.value }))
            }
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="display" style={styles.label}>
            Display Order
          </label>
          <input
            style={styles.input}
            type="number"
            min="1"
            value={editForm.order}
            onChange={(e) =>
              setEditForm((p) => ({ ...p, order: Number(e.target.value) || 1 }))
            }
          />
        </div>
        <div style={styles.checkRow}>
          <input
            type="checkbox"
            id="req-check"
            checked={editForm.required}
            onChange={(e) =>
              setEditForm((p) => ({ ...p, required: e.target.checked }))
            }
          />
          <label htmlFor="req-check">Required field</label>
        </div>
      </div>

      {/* Options */}
      {(editForm.type === "dropdown" || editForm.type === "radio") && (
        <div style={{ marginTop: "16px" }}>
          <p style={styles.sectionTitle}>Options</p>
          {editForm.options.map((opt, i) => (
            <div key={i} style={styles.optRow}>
              <span>
                {opt.label} ({opt.value}){" "}
                {opt.priceAdder > 0 && (
                  <span style={{ color: "#008060" }}>+${opt.priceAdder}</span>
                )}
              </span>
              <button onClick={() => removeOption(i)} style={btn.smallDanger}>
                ✕
              </button>
            </div>
          ))}
          <div style={styles.grid4}>
            <div>
              <label htmlFor="label" style={styles.label}>
                Label
              </label>
              <input
                style={styles.input}
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
              <label htmlFor="value" style={styles.label}>
                Value
              </label>
              <input
                style={styles.input}
                value={newOption.value}
                onChange={(e) =>
                  setNewOption((p) => ({ ...p, value: e.target.value }))
                }
                placeholder="e.g. red"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="price" style={styles.label}>
                Price Adder ($)
              </label>
              <input
                style={styles.input}
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
              <button
                onClick={addOption}
                style={{ ...btn.primary, width: "100%" }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conditions */}
      <div style={{ marginTop: "16px" }}>
        <p style={styles.sectionTitle}>Conditional Visibility</p>
        {editForm.conditions.map((cond, i) => (
          <div key={i} style={styles.optRow}>
            <span>
              Show when <strong>{cond.fieldId}</strong> {cond.operator}{" "}
              <strong>{cond.value}</strong>
            </span>
            <button onClick={() => removeCondition(i)} style={btn.smallDanger}>
              ✕
            </button>
          </div>
        ))}
        <div style={styles.grid4}>
          <div>
            <label htmlFor="field" style={styles.label}>
              Field
            </label>
            {otherFields.length > 0 ? (
              <select
                style={styles.input}
                value={newCondition.fieldId}
                onChange={(e) =>
                  setNewCondition((p) => ({ ...p, fieldId: e.target.value }))
                }
              >
                <option value="">— select —</option>
                {otherFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label || f.id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                style={styles.input}
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
            <label htmlFor="operator" style={styles.label}>
              Operator
            </label>
            <select
              style={styles.input}
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
            <label htmlFor="value" style={styles.label}>
              Value
            </label>
            <input
              style={styles.input}
              value={newCondition.value}
              onChange={(e) =>
                setNewCondition((p) => ({ ...p, value: e.target.value }))
              }
              placeholder="e.g. custom"
              autoComplete="off"
            />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={addCondition}
              style={{ ...btn.primary, width: "100%" }}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──
const styles = {
  editBox: {
    background: "#f0f7ff",
    border: "1px solid #4a6cf7",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "16px",
  },
  editHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  empty: {
    padding: "32px",
    textAlign: "center",
    color: "#6b7177",
    background: "#f6f6f7",
    borderRadius: "8px",
  },
  fieldCard: {
    border: "1px solid #e1e3e5",
    borderRadius: "8px",
    marginBottom: "8px",
    overflow: "hidden",
  },
  fieldRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    background: "#fff",
  },
  fieldLabel: {
    fontWeight: 600,
    fontSize: "14px",
    display: "block",
    marginBottom: "4px",
  },
  badgeRow: { display: "flex", gap: "6px", flexWrap: "wrap" },
  inlineEdit: {
    padding: "16px",
    background: "#fafbfc",
    borderTop: "1px solid #e1e3e5",
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
  sectionTitle: {
    margin: "0 0 8px",
    fontWeight: 600,
    fontSize: "13px",
    color: "#202223",
  },
  optRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 10px",
    background: "#f6f6f7",
    borderRadius: "4px",
    marginBottom: "6px",
    fontSize: "13px",
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  grid4: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 120px 80px",
    gap: "8px",
    alignItems: "flex-start",
    marginTop: "8px",
  },
  checkRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    paddingTop: "22px",
    fontSize: "14px",
  },
};

const btn = {
  primary: {
    padding: "7px 14px",
    background: "#000",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
  },
  success: {
    padding: "7px 14px",
    background: "#008060",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
  },
  default: {
    padding: "7px 14px",
    background: "#fff",
    color: "#202223",
    border: "1px solid #babfc3",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "13px",
  },
  danger: {
    padding: "7px 14px",
    background: "#fff0ed",
    color: "#d72c0d",
    border: "1px solid #d72c0d",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "13px",
  },
  small: {
    padding: "4px 10px",
    background: "#fff",
    color: "#202223",
    border: "1px solid #babfc3",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
  },
  smallDanger: {
    padding: "3px 8px",
    background: "none",
    color: "#d72c0d",
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
  },
};

const badge = {
  default: {
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 600,
    background: "#f1f1f1",
    color: "#555",
  },
  warn: {
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 600,
    background: "#fdf3d3",
    color: "#b98900",
  },
  info: {
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 600,
    background: "#e8f4fd",
    color: "#0070f3",
  },
  gray: {
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    color: "#6b7177",
  },
};
