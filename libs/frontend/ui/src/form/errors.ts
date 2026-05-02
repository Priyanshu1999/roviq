export interface FieldErrorEntry {
  message: string;
}

type FieldWithMeta = {
  state: { meta: { isTouched: boolean; errors: ReadonlyArray<unknown> } };
};

/**
 * Extract human-readable error messages from a TanStack Form field, but only
 * once the field has been touched. Returns `[]` while the field is pristine
 * so users don't see validation errors before they interact.
 *
 * Handles three error shapes that can appear in `field.state.meta.errors`:
 *   - `string`             — plain message
 *   - `{ message: string}` — Zod issue or library error
 *   - `null` / `undefined` — empty slots
 *
 * The result is shaped for direct use with the `<FieldError errors={…}>`
 * primitive from `@roviq/ui`, which dedupes by `message` and renders a
 * `<ul>` for >1 entry.
 */
export function fieldErrorMessages(field: FieldWithMeta): FieldErrorEntry[] {
  if (!field.state.meta.isTouched) return [];
  const out: FieldErrorEntry[] = [];
  for (const err of field.state.meta.errors) {
    if (err == null) continue;
    if (typeof err === 'string') {
      if (err.length > 0) out.push({ message: err });
      continue;
    }
    if (typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
      if (err.message.length > 0) out.push({ message: err.message });
    }
  }
  return out;
}
