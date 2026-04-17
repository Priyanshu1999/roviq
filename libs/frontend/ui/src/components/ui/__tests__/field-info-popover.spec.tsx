import '@testing-library/jest-dom/vitest';
import { FieldInfoPopover } from '@roviq/ui/components/ui/field-info-popover';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

describe('FieldInfoPopover', () => {
  it('renders a trigger button, hidden body, and title tooltip until opened', () => {
    render(
      <FieldInfoPopover title="UDISE+ Code" data-testid="udise-info">
        11-digit government school identifier.
      </FieldInfoPopover>,
    );
    const trigger = screen.getByTestId('udise-info');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-label', 'More info');
    expect(screen.queryByText('11-digit government school identifier.')).not.toBeInTheDocument();
  });

  it('opens the popover with title heading and body content on click', async () => {
    const user = userEvent.setup();
    render(
      <FieldInfoPopover title="UDISE+ Code" data-testid="udise-info">
        <p>11-digit code issued by the Ministry of Education.</p>
        <p>Find yours at udiseplus.gov.in.</p>
      </FieldInfoPopover>,
    );

    await user.click(screen.getByTestId('udise-info'));

    expect(screen.getAllByText('UDISE+ Code').length).toBeGreaterThan(0);
    expect(
      screen.getByText('11-digit code issued by the Ministry of Education.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Find yours at udiseplus.gov.in.')).toBeInTheDocument();
  });

  it('uses a fallback testid when none is provided', () => {
    render(<FieldInfoPopover title="Example">Body.</FieldInfoPopover>);
    expect(screen.getByTestId('field-info-trigger')).toBeInTheDocument();
  });
});
