// @ts-check

/**
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 */

/**
 * @param {CartTransformRunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  const operations = [];

  for (const line of input.cart.lines) {
    const configMeta = line.merchandise?.product?.metafield;
    if (!configMeta?.value) continue;

    let config;
    try {
      config = JSON.parse(configMeta.value);
      if (typeof config === "string") config = JSON.parse(config);
    } catch {
      continue;
    }

    if (!config?.fields) continue;

    const currentAmount = parseFloat(line.cost.amountPerQuantity.amount);
  }

  return { operations };
}
