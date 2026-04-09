import '@testing-library/jest-dom/vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mutateMock = vi.fn();

// Mock @roviq/graphql so EditYearSheet's useMutation returns our spy.
vi.mock('@roviq/graphql', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@roviq/graphql');
  return {
    ...actual,
    useMutation: () => [mutateMock, { loading: false }],
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import academicYearsMessages from '../../../../../../../messages/en/academicYears.json';
import commonMessages from '../../../../../../../messages/en/common.json';
import { renderWithProviders } from '../../../../../../__test-utils__/render-with-providers';
import { EditYearSheet } from '../edit-year-sheet';
import type { AcademicYear } from '../use-academic-years';

const messages = { academicYears: academicYearsMessages, common: commonMessages };

const buildYear = (overrides: Partial<AcademicYear> = {}): AcademicYear => ({
  id: 'year-1',
  label: '2026-27',
  startDate: '2026-04-01',
  endDate: '2027-03-31',
  isActive: false,
  status: 'PLANNING',
  termStructure: [],
  boardExamDates: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
  ...overrides,
});

describe('EditYearSheet', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mutateMock.mockReset();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns null when no year provided', () => {
    const { container } = renderWithProviders(
      <EditYearSheet year={null} open={true} onOpenChange={() => {}} />,
      { messages },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders title, description and pre-filled label/start/end inputs', () => {
    renderWithProviders(<EditYearSheet year={buildYear()} open={true} onOpenChange={() => {}} />, {
      messages,
    });

    expect(screen.getAllByText(/edit academic year/i).length).toBeGreaterThan(0);
    const labelInput = screen.getByLabelText(/academic year label/i) as HTMLInputElement;
    expect(labelInput.value).toBe('2026-27');
  });

  it('shows read-only banner and hides Save button for ARCHIVED years', () => {
    renderWithProviders(
      <EditYearSheet
        year={buildYear({ status: 'ARCHIVED' })}
        open={true}
        onOpenChange={() => {}}
      />,
      { messages },
    );
    expect(screen.getByText(/archived and cannot be edited/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
  });

  it('blocks submission with required-field error when label is cleared', async () => {
    renderWithProviders(<EditYearSheet year={buildYear()} open={true} onOpenChange={() => {}} />, {
      messages,
    });

    const labelInput = screen.getByLabelText(/academic year label/i);
    await userEvent.clear(labelInput);
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/please enter a label/i)).toBeInTheDocument();
    });
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('calls update mutation with id + input on valid submit', async () => {
    mutateMock.mockResolvedValue({});
    const onOpenChange = vi.fn();
    renderWithProviders(
      <EditYearSheet year={buildYear()} open={true} onOpenChange={onOpenChange} />,
      { messages },
    );

    const labelInput = screen.getByLabelText(/academic year label/i);
    await userEvent.clear(labelInput);
    await userEvent.type(labelInput, '2027-28');

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledTimes(1);
    });
    const call = mutateMock.mock.calls[0]?.[0] as {
      variables: { id: string; input: { label: string } };
    };
    expect(call.variables.id).toBe('year-1');
    expect(call.variables.input.label).toBe('2027-28');
  });
});
