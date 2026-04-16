'use client';

import type { AnyFieldApi } from '@tanstack/react-form';
import type { ReactNode } from 'react';

// The TanStack `useAppForm()` return type (`AppFieldExtendedReactFormApi`)
// has many contravariant slots (`pushFieldValue`, `setFieldValue`, …) that
// collapse to `never` under any narrower duck-type, rejecting structural
// matching against concrete form types. The kit boundary therefore accepts
// `form: any` and trusts the consumer to pass a real `useAppForm` result.
// Runtime safety comes from TanStack's internal `form.Field` wiring.
// biome-ignore lint/suspicious/noExplicitAny: kit boundary is intentionally loose; see docs/forms.md "Known limitations".
type AnyForm = any;

/**
 * Render-prop helpers surfaced by `FieldArray`. Thin wrappers over the
 * equivalent `arrayField.*` methods so consumers don't reach into
 * `arrayField.state.value` / `arrayField.pushValue` directly.
 */
export interface FieldArrayHelpers<TItem> {
  /** The current array; cast to the consumer's item type. */
  rows: ReadonlyArray<TItem>;
  push: (item: TItem) => void;
  remove: (index: number) => void;
  move: (from: number, to: number) => void;
  swap: (a: number, b: number) => void;
  replace: (index: number, item: TItem) => void;
  insert: (index: number, item: TItem) => void;
  clear: () => void;
  /** Underlying TanStack field API — use for meta errors on the array itself. */
  field: AnyFieldApi;
}

export interface FieldArrayProps<TItem> {
  /** The form instance returned from `useAppForm()`. */
  form: AnyForm;
  /** Field path on the form schema (e.g. `contacts`, `terms`, `shifts.timings`). */
  name: string;
  /** Render-prop receiving `{ rows, push, remove, move, swap, replace, insert, clear, field }`. */
  children: (helpers: FieldArrayHelpers<TItem>) => ReactNode;
}

/**
 * Stable render-prop wrapper for array-of-objects form fields (contacts,
 * phones, terms, shifts, documents). Thin layer over TanStack Form's
 * `<form.Field mode="array">` that presents a consistent `{ rows, push,
 * remove, move, swap }` API across the codebase so array builders all read
 * the same way.
 *
 * Does not add runtime behaviour. Its only job is API uniformity — and the
 * escape hatch for loose typing on the `form` prop, which would otherwise
 * force every caller to re-declare TanStack's 12-generic form signature.
 *
 * Usage:
 * ```tsx
 * <FieldArray<ContactRow> form={form} name="contacts">
 *   {({ rows, push, remove }) => (
 *     <>
 *       {rows.map((_, index) => (
 *         <div key={index}>
 *           <form.AppField name={`contacts[${index}].label` as const}>
 *             {(field) => <field.TextField label="Label" />}
 *           </form.AppField>
 *           <Button onClick={() => remove(index)}>Remove</Button>
 *         </div>
 *       ))}
 *       <Button onClick={() => push({ label: '', value: '' })}>Add</Button>
 *     </>
 *   )}
 * </FieldArray>
 * ```
 */
export function FieldArray<TItem>({ form, name, children }: FieldArrayProps<TItem>) {
  return (
    <form.Field name={name} mode="array">
      {(field: AnyFieldApi) => {
        const rows = (field.state.value ?? []) as ReadonlyArray<TItem>;
        const helpers: FieldArrayHelpers<TItem> = {
          rows,
          push: (item) => field.pushValue(item),
          remove: (index) => field.removeValue(index),
          move: (from, to) => field.moveValue(from, to),
          swap: (a, b) => field.swapValues(a, b),
          replace: (index, item) => field.replaceValue(index, item),
          insert: (index, item) => field.insertValue(index, item),
          clear: () => field.setValue([] as TItem[]),
          field,
        };
        return <>{children(helpers)}</>;
      }}
    </form.Field>
  );
}
