import '@testing-library/jest-dom/vitest';
import { zodValidator } from '@roviq/i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { fieldErrorMessages } from '../errors';
import { FieldArray } from '../field-array';
import { useAppForm } from '../use-app-form';

// ─── Test harness ─────────────────────────────────────────────────────────
// Each test defines a small form via `useAppForm` and exercises one field
// component. We deliberately do NOT render a global provider — the form kit
// is self-contained (createFormHook ships its own context providers).

function SmokeForm({ onSubmit }: { onSubmit: (v: { name: string }) => void }) {
  const form = useAppForm({
    defaultValues: { name: '' },
    onSubmit: ({ value }) => onSubmit(value),
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
      <form.AppField name="name">
        {(field) => <field.TextField label="Name" testId="name-input" />}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton testId="submit-btn">Save</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}

describe('useAppForm (smoke)', () => {
  it('renders a field bound to form state and submits captured values', async () => {
    const onSubmit = vi.fn();
    render(<SmokeForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByTestId('name-input'), 'Kavya');
    await userEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Kavya' });
    });
  });
});

// ─── zodValidator ─────────────────────────────────────────────────────────

describe('zodValidator', () => {
  const schema = z.object({
    name: z.string().min(2, 'Too short'),
    age: z.number().min(0, 'Must be non-negative'),
  });

  it('returns undefined on valid input', () => {
    const validate = zodValidator(schema);
    const result = validate({ value: { name: 'Aisha', age: 7 } });
    expect(result).toBeUndefined();
  });

  it('returns a field-keyed error map on invalid input', () => {
    const validate = zodValidator(schema);
    const result = validate({ value: { name: 'A', age: -1 } });
    expect(result).toEqual({
      fields: {
        name: ['Too short'],
        age: ['Must be non-negative'],
      },
    });
  });

  it('aggregates multiple messages on the same field path', () => {
    const multi = z.object({
      code: z
        .string()
        .min(3, 'Too short')
        .regex(/^[A-Z]+$/, 'Upper-case only'),
    });
    const validate = zodValidator(multi);
    const result = validate({ value: { code: 'ab' } });
    expect(result?.fields.code).toEqual(['Too short', 'Upper-case only']);
  });

  it('nests dotted paths for nested schemas (input layer)', () => {
    const nested = z.object({ user: z.object({ email: z.string().email('Bad email') }) });
    const validate = zodValidator(nested);
    const result = validate({ value: { user: { email: 'nope' } } });
    expect(result?.fields['user.email']).toEqual(['Bad email']);
  });

  it('survives `.default()` / `.preprocess()` modifiers that break bare-schema assignment', () => {
    // Repro of the upstream typing gap; `.default([])` on an array field
    // widens the schema's input to `T[] | undefined` which fails structural
    // match against `FormValidateOrFn<TFormData>`. `zodValidator` bypasses
    // the type-level assignment and validates at runtime only.
    const withDefaults = z.object({
      tags: z.array(z.string()).default([]),
      label: z.preprocess(
        (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
        z.string().min(1, 'Required').optional(),
      ),
    });
    const validate = zodValidator(withDefaults);
    expect(validate({ value: { tags: [], label: '' } })).toBeUndefined();
    expect(validate({ value: { tags: ['a'], label: 'hello' } })).toBeUndefined();
  });
});

// ─── fieldErrorMessages ───────────────────────────────────────────────────

describe('fieldErrorMessages', () => {
  const makeField = (errors: ReadonlyArray<unknown>, isTouched = true) =>
    ({
      state: { meta: { errors, isTouched } },
    }) as unknown as Parameters<typeof fieldErrorMessages>[0];

  it('returns [] when the field is untouched', () => {
    expect(fieldErrorMessages(makeField([{ message: 'err' }], false))).toEqual([]);
  });

  it('extracts string messages verbatim', () => {
    expect(fieldErrorMessages(makeField(['plain message']))).toEqual([
      { message: 'plain message' },
    ]);
  });

  it('extracts { message } objects', () => {
    expect(fieldErrorMessages(makeField([{ message: 'zod issue' }]))).toEqual([
      { message: 'zod issue' },
    ]);
  });

  it('skips null / undefined / unknown-shaped entries', () => {
    expect(
      fieldErrorMessages(makeField([null, undefined, { no: 'message' }, { message: 'real' }])),
    ).toEqual([{ message: 'real' }]);
  });

  it('drops empty-string messages', () => {
    expect(fieldErrorMessages(makeField(['', { message: '' }, { message: 'kept' }]))).toEqual([
      { message: 'kept' },
    ]);
  });
});

// ─── Field components (shape + wiring) ────────────────────────────────────

function FieldHarness<T>({
  defaultValue,
  render,
}: {
  defaultValue: T;
  render: (form: ReturnType<typeof useAppForm<{ value: T }, never>>) => React.ReactNode;
}) {
  const form = useAppForm({
    defaultValues: { value: defaultValue },
    onSubmit: () => {},
  });
  return <form noValidate>{render(form)}</form>;
}

describe('TextField', () => {
  it('forwards testId and label and propagates typed input into form state', async () => {
    const onChange = vi.fn<(v: string) => void>();
    render(
      <FieldHarness
        defaultValue=""
        render={(form) => (
          <>
            <form.AppField
              name="value"
              listeners={{ onChange: ({ value }) => onChange(value as string) }}
            >
              {(field) => (
                <field.TextField label="Greeting" testId="greeting-input" placeholder="say hi" />
              )}
            </form.AppField>
          </>
        )}
      />,
    );

    const input = screen.getByTestId('greeting-input') as HTMLInputElement;
    expect(input).toHaveAttribute('placeholder', 'say hi');
    expect(screen.getByText('Greeting')).toBeInTheDocument();

    await userEvent.type(input, 'hi');
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('hi'));
  });
});

describe('NumberField', () => {
  it('emits number for numeric input and undefined for empty', async () => {
    const changes: Array<number | undefined> = [];
    render(
      <FieldHarness
        defaultValue={undefined as number | undefined}
        render={(form) => (
          <form.AppField
            name="value"
            listeners={{
              onChange: ({ value }) => changes.push(value as number | undefined),
            }}
          >
            {(field) => <field.NumberField label="Age" testId="age-input" />}
          </form.AppField>
        )}
      />,
    );

    const input = screen.getByTestId('age-input') as HTMLInputElement;
    await userEvent.type(input, '42');
    await waitFor(() => expect(changes.at(-1)).toBe(42));

    await userEvent.clear(input);
    await waitFor(() => expect(changes.at(-1)).toBeUndefined());
  });
});

describe('DateField', () => {
  it('renders an <input type="date"> bound to YYYY-MM-DD', async () => {
    render(
      <FieldHarness
        defaultValue=""
        render={(form) => (
          <form.AppField name="value">
            {(field) => <field.DateField label="DOB" testId="dob-input" />}
          </form.AppField>
        )}
      />,
    );
    const input = screen.getByTestId('dob-input') as HTMLInputElement;
    expect(input.type).toBe('date');

    await userEvent.type(input, '2016-05-04');
    expect(input.value).toBe('2016-05-04');
  });
});

describe('CheckboxField', () => {
  it('toggles boolean state', async () => {
    const changes: Array<boolean | undefined> = [];
    render(
      <FieldHarness
        defaultValue={false as boolean | undefined}
        render={(form) => (
          <form.AppField
            name="value"
            listeners={{
              onChange: ({ value }) => changes.push(value as boolean | undefined),
            }}
          >
            {(field) => <field.CheckboxField label="Active" testId="active-checkbox" />}
          </form.AppField>
        )}
      />,
    );
    await userEvent.click(screen.getByTestId('active-checkbox'));
    await waitFor(() => expect(changes.at(-1)).toBe(true));
  });
});

describe('PhoneField', () => {
  it('strips non-digit input and caps at 10 characters', async () => {
    const changes: Array<string | undefined> = [];
    render(
      <FieldHarness
        defaultValue=""
        render={(form) => (
          <form.AppField
            name="value"
            listeners={{
              onChange: ({ value }) => changes.push(value as string | undefined),
            }}
          >
            {(field) => <field.PhoneField label="Phone" testId="phone-input" />}
          </form.AppField>
        )}
      />,
    );

    const input = screen.getByTestId('phone-input') as HTMLInputElement;
    await userEvent.type(input, '98ab76543210');
    // 10 digits kept: 9876543210
    await waitFor(() => expect(changes.at(-1)).toBe('9876543210'));
    // Visible +91 prefix
    expect(screen.getByText('+91')).toBeInTheDocument();
  });
});

// ─── FieldArray ──────────────────────────────────────────────────────────

describe('FieldArray', () => {
  function ContactsForm() {
    const form = useAppForm({
      defaultValues: { contacts: [] as Array<{ label: string }> },
      onSubmit: () => {},
    });
    return (
      <FieldArray<{ label: string }> form={form} name="contacts">
        {({ rows, push, remove }) => (
          <>
            <button
              type="button"
              data-testid="add-contact"
              onClick={() => push({ label: `row-${rows.length}` })}
            >
              Add
            </button>
            {rows.map((row, index) => (
              <div key={index} data-testid={`row-${index}`}>
                {row.label}
                <button type="button" data-testid={`remove-${index}`} onClick={() => remove(index)}>
                  Remove
                </button>
              </div>
            ))}
          </>
        )}
      </FieldArray>
    );
  }

  it('push() appends a new row and remove() drops it', async () => {
    render(<ContactsForm />);

    expect(screen.queryByTestId('row-0')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('add-contact'));
    expect(await screen.findByTestId('row-0')).toHaveTextContent('row-0');

    await userEvent.click(screen.getByTestId('add-contact'));
    expect(await screen.findByTestId('row-1')).toHaveTextContent('row-1');

    await userEvent.click(screen.getByTestId('remove-0'));
    await waitFor(() => expect(screen.queryByTestId('row-1')).not.toBeInTheDocument());
    expect(screen.getByTestId('row-0')).toHaveTextContent('row-1');
  });
});

// ─── SubmitButton ────────────────────────────────────────────────────────

describe('SubmitButton', () => {
  it('disables during submission and shows the submitting label', async () => {
    let resolveSubmit: (() => void) | undefined;
    function SlowForm() {
      const form = useAppForm({
        defaultValues: { v: '' },
        onSubmit: () =>
          new Promise<void>((resolve) => {
            resolveSubmit = resolve;
          }),
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
          <form.AppForm>
            <form.SubmitButton testId="submit-btn" submittingLabel="Saving…">
              Save
            </form.SubmitButton>
          </form.AppForm>
        </form>
      );
    }

    render(<SlowForm />);
    const btn = screen.getByTestId('submit-btn');
    expect(btn).toHaveTextContent('Save');
    expect(btn).not.toBeDisabled();

    await userEvent.click(btn);
    await waitFor(() => expect(btn).toBeDisabled());
    expect(btn).toHaveTextContent('Saving…');

    resolveSubmit?.();
    await waitFor(() => expect(btn).not.toBeDisabled());
    expect(btn).toHaveTextContent('Save');
  });
});
