import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageErrorBoundary } from '../error-boundary';

function Throws({ message }: { message: string }) {
  throw new Error(message);
}

describe('PageErrorBoundary', () => {
  beforeEach(() => {
    // Suppress React's noisy error output for thrown components
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error', () => {
    render(
      <PageErrorBoundary>
        <div>healthy</div>
      </PageErrorBoundary>,
    );
    expect(screen.getByText('healthy')).toBeInTheDocument();
  });

  it('renders fallback with error message when child throws', () => {
    render(
      <PageErrorBoundary>
        <Throws message="something exploded" />
      </PageErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('something exploded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('uses custom labels when provided', () => {
    render(
      <PageErrorBoundary
        labels={{ title: 'त्रुटि', tryAgain: 'पुनः प्रयास', fallbackMessage: 'कुछ गलत' }}
      >
        <Throws message="" />
      </PageErrorBoundary>,
    );
    expect(screen.getByText('त्रुटि')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'पुनः प्रयास' })).toBeInTheDocument();
  });

  it('clicking the reset button does not throw (it re-attempts the children)', async () => {
    render(
      <PageErrorBoundary>
        <Throws message="boom" />
      </PageErrorBoundary>,
    );
    const button = screen.getByRole('button', { name: 'Try again' });
    // The child still throws after reset, so the fallback persists — but the
    // click itself must not propagate an unhandled error to the test runner.
    await expect(userEvent.click(button)).resolves.toBeUndefined();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
