import '@testing-library/jest-dom/vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createPlanMock = vi.fn();
const updatePlanMock = vi.fn();

vi.mock('../use-plans', () => ({
  useCreatePlan: () => [createPlanMock, { loading: false }],
  useUpdatePlan: () => [updatePlanMock, { loading: false }],
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import billingMessages from '../../../../../../../../messages/en/billing.json';
import commonMessages from '../../../../../../../../messages/en/common.json';
import { renderWithProviders } from '../../../../../../../__test-utils__/render-with-providers';
import { PlanFormDialog } from '../plan-form-dialog';

const messages = { billing: billingMessages, common: commonMessages };

describe('PlanFormDialog', () => {
  beforeEach(() => {
    window.localStorage.clear();
    createPlanMock.mockReset();
    updatePlanMock.mockReset();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders create-mode title and key sections when opened', () => {
    renderWithProviders(<PlanFormDialog open={true} onOpenChange={() => {}} plan={null} />, {
      messages,
    });

    expect(screen.getByRole('heading', { name: /create plan/i })).toBeInTheDocument();
    expect(screen.getByText(/basic information/i)).toBeInTheDocument();
  });

  it('opens without crashing or "Maximum update depth exceeded" (regression)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = renderWithProviders(
      <PlanFormDialog open={false} onOpenChange={() => {}} plan={null} />,
      { messages },
    );

    // Open the dialog — this is what previously triggered the loop.
    rerender(<PlanFormDialog open={true} onOpenChange={() => {}} plan={null} />);

    // waitFor polls until the form's effects have settled; any
    // "Maximum update depth exceeded" error is logged synchronously by React
    // during an infinite render loop, so if the assertion holds across the
    // poll window we know no loop occurred.
    await waitFor(() => {
      const updateLoopCalls = consoleErrorSpy.mock.calls.filter((call) =>
        String(call[0] ?? '').includes('Maximum update depth exceeded'),
      );
      expect(updateLoopCalls).toHaveLength(0);
      // Also assert the dialog is fully mounted so we know effects have run.
      expect(screen.getByRole('heading', { name: /create plan/i })).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('reopening the dialog does not trigger the update-depth loop', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = renderWithProviders(
      <PlanFormDialog open={true} onOpenChange={() => {}} plan={null} />,
      { messages },
    );
    rerender(<PlanFormDialog open={false} onOpenChange={() => {}} plan={null} />);
    rerender(<PlanFormDialog open={true} onOpenChange={() => {}} plan={null} />);

    await waitFor(() => {
      const updateLoopCalls = consoleErrorSpy.mock.calls.filter((call) =>
        String(call[0] ?? '').includes('Maximum update depth exceeded'),
      );
      expect(updateLoopCalls).toHaveLength(0);
      expect(screen.getByRole('heading', { name: /create plan/i })).toBeInTheDocument();
    });
    consoleErrorSpy.mockRestore();
  });

  it('shows validation errors and does not call createPlan when blank', async () => {
    renderWithProviders(<PlanFormDialog open={true} onOpenChange={() => {}} plan={null} />, {
      messages,
    });

    // Submit button: "Create Plan" appears in the heading too, so prefer the
    // form's submit button. The dialog form ends with a Save/Submit button.
    const submitButtons = screen
      .getAllByRole('button', { name: /create plan/i })
      .filter((b) => (b as HTMLButtonElement).type === 'submit');
    expect(submitButtons.length).toBeGreaterThan(0);
    const submit = submitButtons[0];
    if (!submit) throw new Error('submit button missing');
    await userEvent.click(submit);

    // Validation should mark the EN name input as invalid (a11y) and block
    // the mutation. We don't pin the exact wording because the I18nInput
    // surfaces it via FieldError nested under each locale, and the exact
    // message belongs to the production i18nTextSchema.
    await waitFor(() => {
      const nameInputs = screen.getAllByPlaceholderText(/e\.g\. pro plan/i);
      const anyInvalid = nameInputs.some((el) => el.getAttribute('aria-invalid') === 'true');
      expect(anyInvalid).toBe(true);
    });
    expect(createPlanMock).not.toHaveBeenCalled();
  });
});
