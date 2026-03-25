/**
 * JsonLogic → @ucast/core AST parser (ROV-163).
 *
 * Converts JsonLogic JSONB rules (stored on group_rules.rule) into
 * @ucast/core's FieldCondition and CompoundCondition AST nodes.
 * These are the SAME AST types that CASL uses internally (ROV-166).
 *
 * @ucast/sql then converts the AST to parameterized SQL — we do NOT
 * generate SQL here.
 */
import { CompoundCondition, type Condition, FieldCondition } from '@ucast/core';

/** JsonLogic variable reference: {"var": "field_name"} */
interface VarRef {
  var: string;
}

function isVarRef(node: unknown): node is VarRef {
  return (
    node !== null &&
    typeof node === 'object' &&
    'var' in (node as object) &&
    typeof (node as VarRef).var === 'string'
  );
}

/**
 * Operator mapping: JsonLogic operator → @ucast/core operator name.
 * @ucast/sql already has interpreters for all these operator names.
 */
const COMPARISON_OPS: Record<string, string> = {
  '==': 'eq',
  '!=': 'ne',
  '>': 'gt',
  '>=': 'gte',
  '<': 'lt',
  '<=': 'lte',
};

/**
 * Convert a JsonLogic rule tree into @ucast/core Condition AST.
 * This AST can then be passed to @ucast/sql's interpret() to generate SQL.
 *
 * @param rule - JsonLogic rule object from group_rules.rule
 * @returns @ucast/core Condition AST node
 * @throws Error if the rule contains unsupported operators
 *
 * @example
 * jsonLogicToUcast({ "==": [{ "var": "gender" }, "female"] })
 * // → FieldCondition('eq', 'gender', 'female')
 *
 * jsonLogicToUcast({ "and": [{ "==": [...] }, { "in": [...] }] })
 * // → CompoundCondition('and', [FieldCondition(...), FieldCondition(...)])
 */
export function jsonLogicToUcast(rule: Record<string, unknown>): Condition {
  const keys = Object.keys(rule);
  if (keys.length !== 1) {
    throw new Error(
      `Invalid JsonLogic node: expected exactly one operator key, got ${keys.length}`,
    );
  }

  const operator = keys[0];
  const operands = rule[operator];

  // ── Logical: and, or ───────────────────────────────────
  if (operator === 'and' || operator === 'or') {
    if (!Array.isArray(operands)) {
      throw new Error(`"${operator}" operator requires an array of conditions`);
    }
    const children = operands.map((sub) => jsonLogicToUcast(sub as Record<string, unknown>));
    return new CompoundCondition(operator, children);
  }

  // ── Negation: ! ────────────────────────────────────────
  // MUST unwrap array wrapping: {"!": [{"==": [...]}]} — operand might be [obj]
  if (operator === '!') {
    const inner = Array.isArray(operands) ? operands[0] : operands;
    return new CompoundCondition('not', [jsonLogicToUcast(inner as Record<string, unknown>)]);
  }

  // ── Truthy: !! (double-not) — boolean field check ──────
  // {"!!": [{"var": "is_cwsn"}]} → FieldCondition('eq', 'is_cwsn', true)
  if (operator === '!!') {
    const inner = Array.isArray(operands) ? operands[0] : operands;
    if (!isVarRef(inner)) {
      throw new Error('"!!" operator requires a {"var": "..."} operand');
    }
    return new FieldCondition('eq', inner.var, true);
  }

  // ── Comparison: ==, !=, >, >=, <, <= ───────────────────
  if (operator in COMPARISON_OPS) {
    if (!Array.isArray(operands) || operands.length !== 2) {
      throw new Error(`"${operator}" operator requires exactly 2 operands`);
    }
    const [left, right] = operands as [unknown, unknown];
    if (!isVarRef(left)) {
      throw new Error(
        `Left operand of "${operator}" must be a variable reference ({"var": "..."})`,
      );
    }

    // Special case: null comparison → use @ucast/sql's 'exists' operator
    // which generates "field IS NULL" / "field IS NOT NULL" instead of "field = $1" with null
    if (right === null) {
      return new FieldCondition('exists', left.var, operator === '!=');
    }

    return new FieldCondition(COMPARISON_OPS[operator], left.var, right);
  }

  // ── Array membership: in ───────────────────────────────
  if (operator === 'in') {
    if (!Array.isArray(operands) || operands.length !== 2) {
      throw new Error('"in" operator requires exactly 2 operands: [var, array]');
    }
    const [left, right] = operands as [unknown, unknown];
    if (!isVarRef(left)) {
      throw new Error('Left operand of "in" must be a variable reference ({"var": "..."})');
    }
    if (!Array.isArray(right)) {
      throw new Error('Right operand of "in" must be an array');
    }
    return new FieldCondition('in', left.var, right);
  }

  throw new Error(`Unsupported JsonLogic operator: "${operator}"`);
}
