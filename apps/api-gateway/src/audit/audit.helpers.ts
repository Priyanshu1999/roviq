/**
 * Audit interceptor helpers — action type extraction, entity type extraction, diff computation.
 */

type ActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'RESTORE'
  | 'ASSIGN'
  | 'REVOKE'
  | 'SUSPEND'
  | 'ACTIVATE';

/** Ordered longest-first so "suspend" matches before "su" (if any prefix collision existed) */
const ACTION_PREFIXES: [string, ActionType][] = [
  ['activate', 'ACTIVATE'],
  ['suspend', 'SUSPEND'],
  ['restore', 'RESTORE'],
  ['create', 'CREATE'],
  ['update', 'UPDATE'],
  ['delete', 'DELETE'],
  ['assign', 'ASSIGN'],
  ['revoke', 'REVOKE'],
];

/**
 * Extract the action type from a mutation name.
 *
 * @example extractActionType('createStudent') → 'CREATE'
 * @example extractActionType('suspendInstitute') → 'SUSPEND'
 * @example extractActionType('activateUser') → 'ACTIVATE'
 * @example extractActionType('customMutation') → 'UPDATE' (fallback)
 */
export function extractActionType(mutationName: string): ActionType {
  for (const [prefix, type] of ACTION_PREFIXES) {
    if (mutationName.startsWith(prefix)) {
      return type;
    }
  }
  return 'UPDATE';
}

/** Scope prefixes stripped from mutation names before extracting entity type */
const SCOPE_PREFIXES = ['admin', 'reseller', 'institute'];

/**
 * Extract the entity type from a mutation name, stripping action and scope prefixes.
 *
 * @example extractEntityType('createStudent') → 'Student'
 * @example extractEntityType('adminCreateInstitute') → 'Institute'
 * @example extractEntityType('resellerSuspendInstitute') → 'Institute'
 * @example extractEntityType('customMutation') → 'CustomMutation' (no recognized prefix)
 */
export function extractEntityType(mutationName: string): string {
  let name = mutationName;

  // Strip scope prefix first (admin/reseller/institute)
  for (const scopePrefix of SCOPE_PREFIXES) {
    if (name.startsWith(scopePrefix) && name.length > scopePrefix.length) {
      const rest = name.slice(scopePrefix.length);
      // Only strip if next char is uppercase (e.g., "adminCreate..." but not "administrator")
      if (rest[0] === rest[0]?.toUpperCase()) {
        name = rest[0].toLowerCase() + rest.slice(1);
        break;
      }
    }
  }

  // Strip action prefix
  for (const [prefix] of ACTION_PREFIXES) {
    if (name.startsWith(prefix) && name.length > prefix.length) {
      return name.slice(prefix.length);
    }
  }

  // No recognized action prefix — capitalize first letter and return as-is
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Compute a shallow diff between before and after states.
 * Only includes fields that changed. Returns null if nothing changed.
 *
 * @example computeDiff({ name: 'Raj', email: 'a@b.com' }, { name: 'Rajesh', email: 'a@b.com' })
 *   → { name: { old: 'Raj', new: 'Rajesh' } }
 */
export function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { old: unknown; new: unknown }> | null {
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const oldVal = before[key];
    const newVal = after[key];

    // Shallow comparison — JSON.stringify for objects/arrays
    if (!shallowEqual(oldVal, newVal)) {
      diff[key] = { old: oldVal ?? null, new: newVal ?? null };
    }
  }

  return Object.keys(diff).length > 0 ? diff : null;
}

/**
 * Build a full snapshot for DELETE operations.
 * Every field maps to { old: value, new: null }.
 */
export function snapshotForDelete(
  entity: Record<string, unknown>,
): Record<string, { old: unknown; new: unknown }> {
  const snapshot: Record<string, { old: unknown; new: unknown }> = {};
  for (const [key, value] of Object.entries(entity)) {
    snapshot[key] = { old: value, new: null };
  }
  return snapshot;
}

/**
 * Mask sensitive fields in a changes object.
 * Replaces values with '[REDACTED]' for fields listed in maskedFields.
 */
export function maskChanges(
  changes: Record<string, { old: unknown; new: unknown }>,
  maskedFields: string[],
): Record<string, { old: unknown; new: unknown }> {
  if (maskedFields.length === 0) return changes;

  const masked = { ...changes };
  for (const field of maskedFields) {
    if (field in masked) {
      masked[field] = { old: '[REDACTED]', new: '[REDACTED]' };
    }
  }
  return masked;
}

/**
 * Key-order-independent comparison of two values.
 * For objects, sorts keys before comparing to avoid false positives
 * when { a: 1, b: 2 } is compared against { b: 2, a: 1 }.
 */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') {
    return stableStringify(a) === stableStringify(b);
  }
  return false;
}

/** JSON.stringify with sorted keys for deterministic comparison */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val as Record<string, unknown>)
        .sort()
        .reduce(
          (sorted, k) => {
            sorted[k] = (val as Record<string, unknown>)[k];
            return sorted;
          },
          {} as Record<string, unknown>,
        );
    }
    return val;
  });
}
