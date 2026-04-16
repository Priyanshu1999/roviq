import '@testing-library/jest-dom/vitest';
import { FieldInfoPopover } from '@roviq/ui/components/ui/field-info-popover';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

describe('FieldInfoPopover', () => {
  it('renders a trigger button with title as aria-label and is hidden until opened', () => {
    render(
      <FieldInfoPopover title="UDISE+ Code">
        11-digit government school identifier.
      </FieldInfoPopover>,
    );
    const trigger = screen.getByRole('button', { name: 'UDISE+ Code' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('type', 'button');
    expect(screen.queryByText('11-digit government school identifier.')).not.toBeInTheDocument();
  });

  it('opens the popover with title and body content on click', async () => {
    const user = userEvent.setup();
    render(
      <FieldInfoPopover title="UDISE+ Code">
        <p>11-digit code issued by the Ministry of Education.</p>
        <p>Find yours at udiseplus.gov.in.</p>
      </FieldInfoPopover>,
    );

    await user.click(screen.getByRole('button', { name: 'UDISE+ Code' }));

    expect(screen.getAllByText('UDISE+ Code').length).toBeGreaterThan(0);
    expect(
      screen.getByText('11-digit code issued by the Ministry of Education.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Find yours at udiseplus.gov.in.')).toBeInTheDocument();
  });

  it('forwards data-testid to the trigger for Playwright/RTL lookups', () => {
    render(
      <FieldInfoPopover title="Example" data-testid="udise-info">
        Body.
      </FieldInfoPopover>,
    );
    expect(screen.getByTestId('udise-info')).toBeInTheDocument();
  });
});
