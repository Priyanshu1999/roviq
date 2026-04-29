import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from '../page-header';

describe('PageHeader', () => {
  it('renders the title text', () => {
    render(<PageHeader title="Students" />);
    expect(screen.getByTestId('page-header-title')).toHaveTextContent('Students');
  });

  it('renders the description when provided', () => {
    render(<PageHeader title="Students" description="Manage enrolled students" />);
    expect(screen.getByTestId('page-header-description')).toHaveTextContent(
      'Manage enrolled students',
    );
  });

  it('skips the description element entirely when not provided', () => {
    render(<PageHeader title="Students" />);
    expect(screen.queryByTestId('page-header-description')).not.toBeInTheDocument();
  });

  it('renders the actions slot', () => {
    render(<PageHeader title="Students" actions={<button type="button">Add student</button>} />);
    const actions = screen.getByTestId('page-header-actions');
    expect(actions).toBeInTheDocument();
    expect(actions).toContainElement(screen.getByRole('button', { name: 'Add student' }));
  });

  it('skips the actions div entirely when not provided', () => {
    render(<PageHeader title="Students" />);
    expect(screen.queryByTestId('page-header-actions')).not.toBeInTheDocument();
  });
});
