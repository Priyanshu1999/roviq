import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorPage } from '../error-page';

afterEach(cleanup);

describe('ErrorPage', () => {
  it('renders default title and description', () => {
    render(<ErrorPage reset={() => {}} />);
    expect(screen.getByText('Something went wrong')).toBeDefined();
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeDefined();
  });

  it('renders custom title, description, and action label', () => {
    render(
      <ErrorPage
        title="Server Error"
        description="The server is down."
        actionLabel="Retry"
        reset={() => {}}
      />,
    );
    expect(screen.getByText('Server Error')).toBeDefined();
    expect(screen.getByText('The server is down.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('calls reset when button is clicked', () => {
    const reset = vi.fn();
    render(<ErrorPage reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
