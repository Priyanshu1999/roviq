import '@testing-library/jest-dom/vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createInstituteMock = vi.fn();

vi.mock('../../use-institutes', () => ({
  useCreateInstitute: () => [createInstituteMock, { loading: false }],
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

import { renderWithProviders } from '../../../../../../../__test-utils__/render-with-providers';
import CreateInstitutePage from '../page';

describe('CreateInstitutePage (admin)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    createInstituteMock.mockReset();
    pushMock.mockReset();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders the page heading and the i18n name input', () => {
    renderWithProviders(<CreateInstitutePage />);

    // Title is "Create Institute" and appears in both the H1 and the card.
    expect(screen.getAllByText(/create institute/i).length).toBeGreaterThan(0);
    // I18nInput renders one input per locale. The "name.en" placeholder
    // comes from adminInstitutes.create.namePlaceholder.
    expect(
      screen
        .getAllByPlaceholderText(/.+/)
        .some((el) => (el as HTMLInputElement).name === 'name.en'),
    ).toBe(true);
  });

  it('blocks submission and surfaces errors when the i18n name is blank', async () => {
    renderWithProviders(<CreateInstitutePage />);

    const submit = screen
      .getAllByRole('button', { name: /create institute/i })
      .find((b) => (b as HTMLButtonElement).type === 'submit');
    if (!submit) throw new Error('submit button not found');
    await userEvent.click(submit);

    // After a blank submit the createInstitute mutation must NOT be called,
    // and at least one input across the form must be flagged invalid.
    await waitFor(() => {
      expect(createInstituteMock).not.toHaveBeenCalled();
      const anyInvalid = screen
        .getAllByRole('textbox')
        .some((el) => el.getAttribute('aria-invalid') === 'true');
      expect(anyInvalid).toBe(true);
    });
  });

  it('does not leak NaN errors for blank lat/lng coordinates (regression)', async () => {
    createInstituteMock.mockResolvedValue({ data: { createInstitute: { id: 'inst-1' } } });
    renderWithProviders(<CreateInstitutePage />);

    const submit = screen
      .getAllByRole('button', { name: /create institute/i })
      .find((b) => (b as HTMLButtonElement).type === 'submit');
    if (!submit) throw new Error('submit button not found');
    await userEvent.click(submit);

    // Even with the form invalid (we don't fill in name), it must NEVER
    // surface a raw Zod "expected number, received NaN" error from the
    // empty coordinate inputs.
    await waitFor(() => {
      expect(screen.queryByText(/expected number/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/received NaN/i)).not.toBeInTheDocument();
    });
  });
});
