import '@testing-library/jest-dom/vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createGroupMock = vi.fn();

vi.mock('../../use-institute-groups', () => ({
  useCreateInstituteGroup: () => [createGroupMock, { loading: false }],
}));

const pushMock = vi.fn();
vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useRouter: () => ({ push: pushMock, back: vi.fn(), replace: vi.fn() }),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import instituteGroupsMessages from '../../../../../../../../messages/en/instituteGroups.json';
import instituteSettingsMessages from '../../../../../../../../messages/en/instituteSettings.json';
import { renderWithProviders } from '../../../../../../../__test-utils__/render-with-providers';
import NewInstituteGroupPage from '../page';

const messages = {
  instituteGroups: instituteGroupsMessages,
  instituteSettings: instituteSettingsMessages,
};

describe('NewInstituteGroupPage (admin)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    createGroupMock.mockReset();
    pushMock.mockReset();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders heading and the basic-information section', () => {
    renderWithProviders(<NewInstituteGroupPage />, { messages });

    expect(screen.getAllByText(/create.*group/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/group name/i)).toBeInTheDocument();
    expect(
      screen
        .getAllByLabelText(/short code/i)
        .find((el) => el.tagName === 'INPUT') as HTMLInputElement,
    ).toBeInTheDocument();
    expect(screen.getByText(/basic information/i)).toBeInTheDocument();
  });

  it('renders at least one FieldInfoPopover trigger — regression guard for contextual help', async () => {
    renderWithProviders(<NewInstituteGroupPage />, { messages });
    const triggers = document.querySelectorAll('[data-slot="field-info-trigger"]');
    expect(triggers.length).toBeGreaterThan(0);

    await userEvent.click(triggers[0] as HTMLElement);
    await waitFor(() => {
      expect(document.querySelector('[data-slot="field-info-content"]')).not.toBeNull();
    });
  });

  it('blocks submit and shows validation errors when required fields are blank', async () => {
    renderWithProviders(<NewInstituteGroupPage />, { messages });

    const submit = screen
      .getAllByRole('button', { name: /create group/i })
      .find((b) => (b as HTMLButtonElement).type === 'submit');
    if (!submit) throw new Error('submit button missing');
    await userEvent.click(submit);

    await waitFor(() => {
      const nameInput = screen.getByLabelText(/group name/i);
      expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    });
    expect(createGroupMock).not.toHaveBeenCalled();
  });

  it('does not leak NaN errors when address coordinates are blank (regression)', async () => {
    createGroupMock.mockResolvedValue({});
    renderWithProviders(<NewInstituteGroupPage />, { messages });

    await userEvent.type(screen.getByLabelText(/group name/i), 'Acme Trust');
    await userEvent.type(
      screen
        .getAllByLabelText(/short code/i)
        .find((el) => el.tagName === 'INPUT') as HTMLInputElement,
      'acme-trust',
    );

    const submit = screen
      .getAllByRole('button', { name: /create group/i })
      .find((b) => (b as HTMLButtonElement).type === 'submit');
    if (!submit) throw new Error('submit button missing');
    await userEvent.click(submit);

    // Critical: empty lat/lng inputs (RHF valueAsNumber → NaN) must be
    // pre-processed to undefined so the form can submit. We assert no
    // raw "expected number" / "NaN" Zod error leaked into the FieldError.
    await waitFor(() => {
      expect(screen.queryByText(/expected number/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/received NaN/i)).not.toBeInTheDocument();
    });
  });
});
