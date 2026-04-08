import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CapacityBar } from '../capacity-bar';

describe('CapacityBar', () => {
  it('renders current/capacity numbers', () => {
    render(<CapacityBar current={20} capacity={40} showTooltip={false} />);
    expect(screen.getByText('20/40')).toBeInTheDocument();
  });

  it('exposes current/capacity via accessible progressbar attributes', () => {
    render(<CapacityBar current={20} capacity={40} showTooltip={false} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '20');
    expect(bar).toHaveAttribute('aria-valuemax', '40');
  });

  it('reports state=ok when below 80% capacity', () => {
    render(<CapacityBar current={10} capacity={40} showTooltip={false} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-state', 'ok');
  });

  it('reports state=warn between 80% and 100% capacity', () => {
    render(<CapacityBar current={36} capacity={40} showTooltip={false} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-state', 'warn');
  });

  it('reports state=over when over 100% capacity', () => {
    render(<CapacityBar current={45} capacity={40} showTooltip={false} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-state', 'over');
  });

  it('reports state=over when over hardMax even if below capacity', () => {
    render(<CapacityBar current={46} capacity={50} hardMax={45} showTooltip={false} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-state', 'over');
  });

  it('caps fill width at 100% even when over capacity', () => {
    render(<CapacityBar current={80} capacity={40} showTooltip={false} />);
    const fill = screen.getByTestId('capacity-bar-fill');
    expect(fill.style.width).toBe('100%');
  });

  it('handles zero capacity gracefully without dividing by zero', () => {
    render(<CapacityBar current={0} capacity={0} showTooltip={false} />);
    expect(screen.getByText('0/0')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-state', 'ok');
  });
});
