# Forms

Every form in Roviq uses the `@roviq/ui` form kit, which wraps `@tanstack/react-form` with typed field components, the Roviq `Field`/`FieldLabel`/`FieldError` shells, and schema helpers in `@roviq/i18n`.

No other form library is supported. `react-hook-form` was fully retired in the TanStack-form migration (see [superpowers/specs/2026-04-16-tanstack-form-migration-design.md](superpowers/specs/2026-04-16-tanstack-form-migration-design.md)).

## Quick start

```tsx
'use client';

import { buildI18nTextSchema, emptyStringToUndefined, phoneSchema } from '@roviq/i18n';
import { FieldGroup, FieldLegend, FieldSet, I18nField, useAppForm } from '@roviq/ui';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { z } from 'zod';

function buildSchema(t: ReturnType<typeof useTranslations>) {
  return z.object({
    firstName: buildI18nTextSchema(t('errors.firstNameRequired')),
    phone: emptyStringToUndefined(phoneSchema(t('errors.phoneInvalid')).optional()),
    age: z.number().int().min(0).optional(),
  });
}

export function CreateStudentForm() {
  const t = useTranslations('students');
  const schema = useMemo(() => buildSchema(t), [t]);
  const form = useAppForm({
    defaultValues: { firstName: { en: '' }, phone: '', age: undefined },
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      // call mutation with parsed
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <FieldSet>
        <FieldLegend>{t('sections.personal')}</FieldLegend>
        <FieldGroup>
          <I18nField form={form} name="firstName" label={t('fields.firstName')} testId="student-first-name" />
          <form.AppField name="phone">
            {(field) => <field.PhoneField label={t('fields.phone')} testId="student-phone-input" />}
          </form.AppField>
          <form.AppField name="age">
            {(field) => <field.NumberField label={t('fields.age')} min={0} testId="student-age-input" />}
          </form.AppField>
        </FieldGroup>
      </FieldSet>
      <form.AppForm>
        <form.SubmitButton testId="student-submit-btn" submittingLabel={t('submitting')}>
          {t('submit')}
        </form.SubmitButton>
      </form.AppForm>
    </form>
  );
}
```

## Form factory

`useAppForm({ defaultValues, validators, onSubmit })` — the single entry point. Returns a typed form with:

- `form.AppField` — render-prop binding for the 10 registered field components
- `form.AppForm` — wrapper that provides form context to `form.SubmitButton`
- `form.Field` — unregistered render-prop for custom UI or `mode="array"`
- `form.Subscribe` — selective subscription for cross-field reactivity
- `form.store` — underlying TanStack store; pair with `useStore` from `@tanstack/react-form` for cascading dropdowns
- `form.setFieldValue`, `form.setFieldMeta`, `form.reset`, `form.handleSubmit` — imperative API

## Field components

Call inside `<form.AppField name="fieldPath">{(field) => <field.X … />}</form.AppField>`.

| Component | Emits | Notes |
|---|---|---|
| `TextField` | `string \| undefined` | `type` in text/email/url/tel/password, `autoComplete`, `inputMode`, `maxLength` |
| `TextareaField` | `string \| undefined` | `rows`, `maxLength` |
| `NumberField` | `number \| undefined` | Empty input → `undefined`; pair with `optionalInt` or plain `z.number()` |
| `DateField` | `string \| undefined` (`YYYY-MM-DD`) | Native `<input type="date">`; pair with `dateSchema()` + `emptyStringToUndefined()` for optional |
| `SelectField<TValue>` | `TValue \| undefined` | `options: Array<{ value, label, disabled? }>`; `optional: false` for required selects; `onValueChange` hook for cascading |
| `CheckboxField` / `SwitchField` | `boolean \| undefined` | Renders horizontally with `<FieldContent>` for description |
| `PhoneField` | `string \| undefined` (raw 10 digits) | `+91` visual prefix per [GZUFW]; pair with `phoneSchema()` |
| `MoneyField` | `number \| undefined` (rupees) | `₹` prefix + Indian-formatted preview in description per [HVJED]; convert to paise BIGINT in `onSubmit` |
| `I18nField` | `{ [locale]: string }` | Standalone (not under `form.AppField`); takes `form` prop; spawns one row per supported locale |

**All field components accept**: `label`, `description?`, `testId?`, `errorTestId?`, `disabled?`. `TextField` also accepts `required?` and `placeholder?`.

## Field arrays

Use the `FieldArray` wrapper for builders (contacts, term structure, shift timings, document lists):

```tsx
import { FieldArray } from '@roviq/ui';

<FieldArray form={form} name="contacts">
  {({ rows, push, remove }) => (
    <>
      {rows.map((_, index) => (
        <div key={index} className="flex gap-2">
          <form.AppField name={`contacts[${index}].label` as const}>
            {(field) => <field.TextField label={t('label')} />}
          </form.AppField>
          <form.AppField name={`contacts[${index}].value` as const}>
            {(field) => <field.TextField label={t('value')} />}
          </form.AppField>
          <Button type="button" onClick={() => remove(index)}>Remove</Button>
        </div>
      ))}
      <Button type="button" onClick={() => push({ label: '', value: '' })}>Add</Button>
    </>
  )}
</FieldArray>
```

The wrapper adds no runtime behaviour over raw `<form.Field mode="array">` — its only job is to present a stable `{ rows, push, remove, move, swap }` API so array-builder components read the same way across the codebase.

## Cross-field reactivity (cascading selects)

Render-prop trees cannot read sibling field state directly. Use `useStore` on `form.store` to subscribe:

```tsx
import { useStore } from '@tanstack/react-form';

const academicYearId = useStore(form.store, (s) => (s.values as MyForm).academicYearId);

<form.AppField name="academicYearId">
  {(field) => (
    <field.SelectField
      options={yearOptions}
      optional={false}
      onValueChange={() => {
        form.setFieldValue('standardId', '');
        form.setFieldValue('sectionId', '');
      }}
    />
  )}
</form.AppField>
<form.AppField name="standardId">
  {(field) => (
    <field.SelectField
      options={standardOptions}
      disabled={!academicYearId}
      optional={false}
    />
  )}
</form.AppField>
```

## Schema helpers (`@roviq/i18n/form-schemas`)

- `buildI18nTextSchema(requiredMessage)` — `z.object({ en, hi, … })` with `en` required
- `emptyStringToUndefined(inner)` — coerces blank / whitespace strings to `undefined` BEFORE the inner validator; required for optional HTML inputs (`date`, `tel`, `email`) because class-validator rejects empty strings
- `phoneSchema(message)` — 10-digit IN mobile regex `[6-9]\d{9}`
- `dateSchema(message)` — `YYYY-MM-DD` regex
- `optionalInt` — NaN → undefined, `z.number().int().min(0).optional()`
- `zodValidator(schema)` — wrap a Zod schema into a plain validator function. **Required** when the schema uses `.default()`, `.preprocess()`, or `.coerce()` and fails to assign to `FormValidateOrFn<TFormData>` (upstream issue: [colinhacks/zod#4938](https://github.com/colinhacks/zod/issues/4938), [TanStack/form#1957](https://github.com/TanStack/form/issues/1957)). Usage:
  ```ts
  validators: { onChange: zodValidator(schema), onSubmit: zodValidator(schema) }
  ```

## Draft auto-save (`useFormDraft`)

`apps/web/src/hooks/use-form-draft.ts` implements [HUPGP]: save form values to `localStorage` on every blur + 30s interval, restore via banner:

```tsx
const form = useAppForm({ … });
const { hasDraft, restoreDraft, discardDraft, clearDraft } = useFormDraft({
  key: `student-profile:${student.id}`, // suffix only — prefix is `roviq:draft:`
  form,
  enabled: !mutationLoading,
});

// on successful submit
clearDraft();
```

Drafts live under `roviq:draft:<key>` with `{ values, savedAt }` envelope.

## Submit button

Must be wrapped in `<form.AppForm>`:

```tsx
<form.AppForm>
  <form.SubmitButton
    testId="kebab-id"
    disabled={extraCondition}           // e.g. !isDirty on edit forms
    submittingLabel={t('saving')}
  >
    {t('save')}
  </form.SubmitButton>
</form.AppForm>
```

Internally subscribes to `isSubmitting` + `canSubmit` via `form.Subscribe` so the surrounding form does not re-render per keystroke.

## Testing

Component tests render the whole page / dialog and exercise the form via `@testing-library/react`. The kit forwards every `data-testid`, so E2E selectors stay stable across migrations.

Kit components have their own unit tests under `libs/frontend/ui/src/form/__tests__/` — see them for the expected behaviour of each field in isolation.

## Known limitations

1. **Kit-boundary `form: any`.** `I18nField`, `useFormDraft`, and the settings builder components type their `form` prop as `any`. TanStack's `AppFieldExtendedReactFormApi<…>` has many contravariant slots that collapse to `never` under narrower duck-types, rejecting structural matching. Runtime is safe; IntelliSense regresses at these boundaries. Tracked for follow-up when TanStack relaxes the variance.
2. **`zodValidator` required for `.default()` / `.preprocess()` schemas.** Some consumers still pass `{ onChange: schema }` directly and work at runtime; switch to `zodValidator(schema)` if `tsc --build` flags them. Upstream issue: [colinhacks/zod#4938](https://github.com/colinhacks/zod/issues/4938).
3. **No typed field-name autocomplete inside `I18nField` / `FieldArray`.** The `name` prop is a plain `string`. Typos surface as blank fields at runtime. Mitigate with a test that asserts the correct field is populated after submit.

## Rules

- **[CLFYD]** Always compose via `Field`/`FieldGroup`/`FieldSet` from `@roviq/ui`. Never render `<input>` or `<Label>` directly inside a form page.
- **[TSTID]** Every field, action button, and error element needs `data-testid` in kebab-case.
- **[HUPGP]** Multi-step forms and all edit forms use `useFormDraft`.
- **[NWKRD]** If the kit doesn't cover a field type you need, add the component to the kit — don't inline a one-off.
