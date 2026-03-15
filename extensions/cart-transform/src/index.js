export function run(input) {
  const operations = [];

  for (const line of input.cart.lines) {
    // attributes (plural)
    const properties = line.attributes || [];

    const configMeta = line.merchandise?.product?.metafield;
    if (!configMeta?.value) continue;

    let config;
    try {
      config = JSON.parse(configMeta.value);
    } catch {
      continue;
    }

    if (!config?.fields) continue;

    // Calculate total price adder
    let totalAdder = 0;
    for (const field of config.fields) {
      const prop = properties.find((p) => p.key === field.label);
      if (!prop) continue;

      const option = field.options?.find(
        (o) => o.label === prop.value || o.value === prop.value,
      );
      if (option?.priceAdder && option.priceAdder > 0) {
        totalAdder += option.priceAdder * 100; // cents
      }
    }

    if (totalAdder > 0) {
      const currentPriceCents = Math.round(
        parseFloat(line.cost.amountPerQuantity.amount) * 100,
      );
      const newPrice = (currentPriceCents + totalAdder) / 100;

      operations.push({
        expand: {
          cartLineId: line.id,
          expandedCartItems: [
            {
              merchandiseId: line.merchandise.id,
              quantity: line.quantity,
              price: {
                adjustment: {
                  fixedPricePerUnit: {
                    amount: newPrice.toFixed(2),
                  },
                },
              },
            },
          ],
        },
      });
    }
  }

  return { operations };
}
