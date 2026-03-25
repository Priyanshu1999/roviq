/**
 * Extract dimension names from JsonLogic rules (ROV-163).
 *
 * Walks the JsonLogic tree and collects all `var` references into a
 * deduplicated string array. Used to populate `group_rules.rule_dimensions`
 * for targeted cache invalidation.
 *
 * @ucast doesn't provide this — it's JsonLogic-specific metadata extraction.
 */

/**
 * Extract all `var` dimension names from a JsonLogic rule.
 *
 * @param rule - JsonLogic rule object
 * @returns Deduplicated array of variable names
 *
 * @example
 * extractDimensions({ "and": [
 *   { "==": [{ "var": "gender" }, "female"] },
 *   { "==": [{ "var": "standard_id" }, "..."] },
 * ]})
 * // → ['gender', 'standard_id']
 */
export function extractDimensions(rule: Record<string, unknown>): string[] {
  const dimensions = new Set<string>();

  function walk(node: unknown): void {
    if (node === null || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    const obj = node as Record<string, unknown>;

    // Check if this is a var reference — destructure to satisfy both
    // TS noPropertyAccessFromIndexSignature and Biome useLiteralKeys
    const { var: varValue } = obj;
    if (typeof varValue === 'string') {
      dimensions.add(varValue);
      return;
    }

    // Recurse into operator values
    for (const value of Object.values(obj)) {
      walk(value);
    }
  }

  walk(rule);
  return [...dimensions];
}
