import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query getProducts {
      products(first: 50) {
        edges {
          node {
            id
            title
            handle
            status
            featuredImage {
              url
              altText
            }
            variants(first: 1) {
              edges {
                node {
                  price
                }
              }
            }
            metafield(namespace: "hoodsly", key: "configurator_definition") {
              value
            }
          }
        }
      }
    }
  `);

  const data = await response.json();
  const products = data.data.products.edges.map((e) => {
    const node = e.node;
    const numericId = node.id.replace("gid://shopify/Product/", "");
    return {
      id: numericId,
      gid: node.id,
      title: node.title,
      handle: node.handle,
      status: node.status,
      price: node.variants.edges[0]?.node.price || "0.00",
      image: node.featuredImage?.url || null,
      imageAlt: node.featuredImage?.altText || node.title,
      hasConfigurator: !!node.metafield?.value,
    };
  });

  return { products };
}

export default function ProductsPage() {
  const { products } = useLoaderData();
  const navigate = useNavigate();

  return (
    <s-page heading="Product Configurator">
      <s-section heading={`Products (${products.length})`}>
        <p style={{ marginBottom: "16px", color: "#666", fontSize: "14px" }}>
          Create and manage custom configurator fields for any product.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {products.length === 0 ? (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "#666",
                background: "#f6f6f7",
                borderRadius: "8px",
              }}
            >
              No products found. Create a product first.
            </div>
          ) : (
            products.map((product) => (
              <div
                key={product.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  padding: "16px",
                  background: "#fff",
                  border: "1px solid #e1e3e5",
                  borderRadius: "8px",
                }}
              >
                {/* Product Image */}
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    flexShrink: 0,
                    background: "#f6f6f7",
                    borderRadius: "6px",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.imageAlt}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: "24px" }}>📦</span>
                  )}
                </div>

                {/* Product Info */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "15px",
                      marginBottom: "4px",
                    }}
                  >
                    {product.title}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: "13px", color: "#666" }}>
                      ${parseFloat(product.price).toFixed(2)}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "12px",
                        background:
                          product.status === "ACTIVE" ? "#e3f1df" : "#fdf3d3",
                        color:
                          product.status === "ACTIVE" ? "#008060" : "#b98900",
                      }}
                    >
                      {product.status}
                    </span>
                    {product.hasConfigurator && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: "#e8f4fd",
                          color: "#0070f3",
                        }}
                      >
                        ✓ Configurator set
                      </span>
                    )}
                  </div>
                </div>

                {/* Configure Button */}
                <button
                  onClick={() => {
                    navigate(`/app/configurator/${product.id}`);
                  }}
                  // href={}
                  style={{
                    padding: "8px 16px",
                    background: "#000",
                    color: "#fff",
                    borderRadius: "6px",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                >
                  {product.hasConfigurator
                    ? "Edit Configurator"
                    : "Add Configurator"}
                </button>
              </div>
            ))
          )}
        </div>
      </s-section>
    </s-page>
  );
}
