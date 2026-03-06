import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotFoundPage } from '../not-found-page';

afterEach(cleanup);

describe('NotFoundPage', () => {
  it('renders default title and description', () => {
    render(<NotFoundPage />);
    expect(screen.getByText('404')).toBeDefined();
    expect(screen.getByText('The page you are looking for does not exist.')).toBeDefined();
  });

  it('renders custom title and description', () => {
    render(<NotFoundPage title="Not Found" description="Custom message" />);
    expect(screen.getByText('Not Found')).toBeDefined();
    expect(screen.getByText('Custom message')).toBeDefined();
  });

  it('renders action button when onAction is provided', () => {
    const onAction = vi.fn();
    render(<NotFoundPage onAction={onAction} />);
    expect(screen.getByRole('button', { name: 'Go to dashboard' })).toBeDefined();
  });

  it('does not render button when onAction is omitted', () => {
    render(<NotFoundPage />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('calls onAction when button is clicked', () => {
    const onAction = vi.fn();
    render(<NotFoundPage onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to dashboard' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('renders custom action label', () => {
    render(<NotFoundPage onAction={() => {}} actionLabel="Go home" />);
    expect(screen.getByRole('button', { name: 'Go home' })).toBeDefined();
  });
});
