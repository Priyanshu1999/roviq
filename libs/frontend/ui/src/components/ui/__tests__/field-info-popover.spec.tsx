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

    // Popover content renders in a portal — wait for the async mount.
    expect(await screen.findByText('UDISE+ Code')).toBeInTheDocument();
    expect(
      screen.getByText('11-digit code issued by the Ministry of Education.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Find yours at udiseplus.gov.in.')).toBeInTheDocument();
  });

  it('also opens on hover after the intent delay', async () => {
    const user = userEvent.setup();
    render(
      <FieldInfoPopover title="UDISE+ Code" data-testid="udise-info">
        Hover body.
      </FieldInfoPopover>,
    );

    await user.hover(screen.getByTestId('udise-info'));

    // 300ms open delay — findBy* polls up to 1s by default so this resolves.
    expect(await screen.findByText('Hover body.')).toBeInTheDocument();
  });

  it('uses a fallback testid when none is provided', () => {
    render(<FieldInfoPopover title="Example">Body.</FieldInfoPopover>);
    expect(screen.getByTestId('field-info-trigger')).toBeInTheDocument();
  });

  it('forwards iconClassName to the trigger icon and contentClassName to the popover body', async () => {
    const user = userEvent.setup();
    render(
      <FieldInfoPopover
        title="Example"
        data-testid="example-info"
        iconClassName="custom-icon-cls"
        contentClassName="custom-content-cls"
      >
        Body.
      </FieldInfoPopover>,
    );

    const icon = screen.getByTestId('example-info').querySelector('svg');
    expect(icon).toHaveClass('custom-icon-cls');

    await user.click(screen.getByTestId('example-info'));
    const content = await screen.findByText('Body.');
    // Body text sits inside PopoverContent — walk up to it to assert the class.
    expect(content.closest('[data-slot="field-info-content"]')).toHaveClass('custom-content-cls');
  });
});
