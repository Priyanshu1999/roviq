import '@testing-library/jest-dom/vitest';
import { addressSchema } from '@roviq/common-types';
import { useAppForm } from '@roviq/ui';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import instituteSettingsMessages from '../../../../../../../../../messages/en/instituteSettings.json';
import { renderWithProviders } from '../../../../../../../../__test-utils__/render-with-providers';
import { AddressForm } from '../address-form';

const messages = { instituteSettings: instituteSettingsMessages };

const formSchema = z.object({ address: addressSchema });

type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

const DEFAULT_VALUES: FormInput = {
  address: {
    line1: '',
    line2: '',
    line3: '',
    city: '',
    district: '',
    state: '',
    postalCode: '',
    country: 'IN',
    coordinates: { lat: undefined, lng: undefined },
  },
};

interface HarnessProps {
  onSubmit?: (values: FormOutput) => void;
  defaultValues?: Partial<FormInput>;
  // The kit's `useAppForm` returns `AppFieldExtendedReactFormApi<…>` whose
  // 12-generic signature can't be re-stated cleanly here. Tests don't depend
  // on the form's typed surface; the `unknown` boundary is intentional and
  // mirrors the runtime contract that `<AddressForm form={form} />` accepts.
  children: (form: unknown) => ReactNode;
}

function Harness({ onSubmit, defaultValues, children }: HarnessProps) {
  const form = useAppForm({
    defaultValues: { ...DEFAULT_VALUES, ...defaultValues } as FormInput,
    validators: { onChange: formSchema, onSubmit: formSchema },
    onSubmit: ({ value }) => {
      onSubmit?.(formSchema.parse(value));
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
      {children(form)}
      <button type="submit">Submit harness</button>
    </form>
  );
}

describe('AddressForm', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders all address inputs (line1, postal code, city, district, lat, lng)', () => {
    renderWithProviders(<Harness>{(form) => <AddressForm form={form} />}</Harness>, { messages });

    expect(screen.getByLabelText(/address line 1/i)).toBeInTheDocument();
    // PIN code label wraps a help-popover button (also aria-labelled with
    // "PIN code"), so multiple matches exist; assert the input is one of them.
    const pinMatches = screen.getAllByLabelText(/pin code/i);
    expect(pinMatches.some((el) => el.tagName === 'INPUT')).toBe(true);
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^district$/i)).toBeInTheDocument();
    // Latitude has a help popover that re-uses the same accessible name; only
    // assert at least one match (input + button) exists.
    expect(screen.getAllByLabelText(/latitude/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/^longitude$/i)).toBeInTheDocument();
  });

  it('blocks submit and shows line1 required error when blank', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <Harness onSubmit={onSubmit}>{(form) => <AddressForm form={form} />}</Harness>,
      { messages },
    );

    await userEvent.click(screen.getByRole('button', { name: /submit harness/i }));

    // addressSchema produces "Address line 1 is required." for empty line1
    await waitFor(() => {
      expect(screen.getByText(/address line 1 is required/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('passes when line1 filled and lat/lng left empty (NaN-safe regression)', async () => {
    const onSubmit = vi.fn();
    // Seed all other required fields (city/district/state/postalCode) so the
    // test isolates the behavior under test: lat/lng left empty must NOT leak
    // "expected number, received NaN" into the form, and submit must proceed.
    renderWithProviders(
      <Harness
        onSubmit={onSubmit}
        defaultValues={{
          address: {
            ...DEFAULT_VALUES.address,
            city: 'Gurgaon',
            district: 'Gurgaon',
            // Use the canonical IndianState UPPER_SNAKE value — AddressForm
            // resets `address.state` to `''` if the current value is not in
            // `INDIAN_STATE_VALUES`, so a human-readable label like "Haryana"
            // would be wiped before submit.
            state: 'HARYANA',
            postalCode: '122001',
          },
        }}
      >
        {(form) => <AddressForm form={form} />}
      </Harness>,
      { messages },
    );

    await userEvent.type(screen.getByLabelText(/address line 1/i), '12 MG Road');
    await userEvent.click(screen.getByRole('button', { name: /submit harness/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    // Critical: no "expected number, received NaN" error leaked into the
    // form when latitude/longitude inputs were left blank.
    expect(screen.queryByText(/expected number/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('auto-fills city/district/state from a successful PIN lookup', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          Status: 'Success',
          Message: 'OK',
          PostOffice: [
            {
              Name: 'Connaught Place',
              District: 'Central Delhi',
              State: 'Delhi',
              Country: 'India',
            },
          ],
        },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<Harness>{(form) => <AddressForm form={form} />}</Harness>, { messages });

    const pinMatches = screen.getAllByLabelText(/pin code/i);
    const pin = pinMatches.find((el): el is HTMLInputElement => el.tagName === 'INPUT');
    if (!pin) throw new Error('PIN code input not found');
    await userEvent.type(pin, '110001');
    await userEvent.tab();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const cityInput = screen.getByLabelText(/city/i) as HTMLInputElement;
    await waitFor(() => {
      expect(cityInput.value).toBe('Connaught Place');
    });

    const districtInput = screen.getByLabelText(/^district$/i) as HTMLInputElement;
    expect(districtInput.value).toBe('Central Delhi');
  });
});
