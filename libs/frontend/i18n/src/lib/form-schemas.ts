import { z } from 'zod';

/**
 * Wrap a Zod schema into a TanStack Form validator function.
 *
 * Works around the upstream typing gap between Zod 4's Standard Schema
 * implementation and `@tanstack/react-form`'s `FormValidateOrFn<TFormData>`:
 * schemas with `.preprocess()`, `.default()`, or `.coerce()` produce an
 * `input` type that TypeScript can't structurally match against the form's
 * `TFormData`, even though runtime behaviour is correct.
 *
 * See:
 *   - https://github.com/colinhacks/zod/issues/4938
 *   - https://github.com/TanStack/form/issues/1957
 *
 * Usage:
 * ```ts
 * const form = useAppForm({
 *   defaultValues: {...},
 *   validators: { onChange: zodValidator(schema), onSubmit: zodValidator(schema) },
 * });
 * ```
 *
 * Returns an object shaped for TanStack's field-level error map when
 * validation fails, or `undefined` when the value parses cleanly.
 */
export function zodValidator<TSchema extends z.ZodType>(schema: TSchema) {
  return ({ value }: { value: unknown }) => {
    const result = schema.safeParse(value);
    if (result.success) return undefined;
    const fields: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.');
      const existing = fields[key];
      if (existing) existing.push(issue.message);
      else fields[key] = [issue.message];
    }
    return { fields };
  };
}

export const optionalInt = z.preprocess(
  (val) => (typeof val === 'number' && Number.isNaN(val) ? undefined : val),
  z.number().int().min(0).optional(),
);

/**
 * Coerce empty / whitespace-only strings to `undefined` BEFORE the inner
 * validator runs. Required for optional HTML inputs (`type="date"`, phone,
 * email) because the backend's class-validator decorators reject `""`
 * outright while the form library happily emits empty strings for untouched
 * fields.
 */
export function emptyStringToUndefined<T extends z.ZodType>(inner: T) {
  return z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), inner);
}

/**
 * 10-digit Indian mobile number starting with 6, 7, 8, or 9.
 * Pass an i18n-translated message; the schema is used as `.optional()` by callers.
 */
export function phoneSchema(message: string) {
  return z.string().regex(/^[6-9]\d{9}$/, message);
}

/**
 * ISO date in `YYYY-MM-DD` form (the wire format produced by `<input type="date">`).
 */
export function dateSchema(message: string) {
  return z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message);
}
