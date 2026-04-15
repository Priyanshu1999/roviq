import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field, FieldDescription, FieldError, FieldLabel } from '../field';

// ── FieldError ────────────────────────────────────────────────────────────────

describe('FieldError', () => {
  it('renders nothing when no errors array and no children', () => {
    const { container } = render(<FieldError />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when errors array is empty', () => {
    const { container } = render(<FieldError errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a single error message as plain text', () => {
    render(<FieldError errors={[{ message: 'Name is required' }]} />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Name is required');
  });

  it('renders multiple distinct errors as a list', () => {
    render(<FieldError errors={[{ message: 'Too short' }, { message: 'Invalid characters' }]} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Too short');
    expect(items[1]).toHaveTextContent('Invalid characters');
  });

  it('deduplicates errors with the same message', () => {
    render(
      <FieldError
        errors={[{ message: 'Required' }, { message: 'Required' }, { message: 'Too short' }]}
      />,
    );
    // After dedup: 2 unique messages → list
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
  });

  it('renders a single error as plain text (not a list) after deduplication', () => {
    render(<FieldError errors={[{ message: 'Required' }, { message: 'Required' }]} />);
    // 2 identical → dedup → 1 → plain text, no list
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders children instead of errors when both are provided', () => {
    render(
      <FieldError errors={[{ message: 'from errors' }]}>
        <span>from children</span>
      </FieldError>,
    );
    expect(screen.getByText('from children')).toBeInTheDocument();
    expect(screen.queryByText('from errors')).not.toBeInTheDocument();
  });

  it('renders children even when errors array is empty', () => {
    render(
      <FieldError errors={[]}>
        <span>child error</span>
      </FieldError>,
    );
    expect(screen.getByText('child error')).toBeInTheDocument();
  });

  it('skips undefined entries in the errors array', () => {
    render(<FieldError errors={[undefined, { message: 'Valid error' }, undefined]} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Valid error');
  });

  it('has role=alert and data-slot=field-error', () => {
    render(<FieldError errors={[{ message: 'Oops' }]} />);
    const el = screen.getByRole('alert');
    expect(el).toHaveAttribute('data-slot', 'field-error');
  });
});

// ── Field ─────────────────────────────────────────────────────────────────────

describe('Field', () => {
  it('renders with role=group and data-slot=field', () => {
    render(
      <Field>
        <span>content</span>
      </Field>,
    );
    const group = screen.getByRole('group');
    expect(group).toHaveAttribute('data-slot', 'field');
  });

  it('defaults to vertical orientation', () => {
    render(
      <Field>
        <span>content</span>
      </Field>,
    );
    expect(screen.getByRole('group')).toHaveAttribute('data-orientation', 'vertical');
  });

  it('applies the requested orientation', () => {
    render(
      <Field orientation="horizontal">
        <span>content</span>
      </Field>,
    );
    expect(screen.getByRole('group')).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('passes through additional props', () => {
    render(
      <Field data-testid="my-field">
        <span>content</span>
      </Field>,
    );
    expect(screen.getByTestId('my-field')).toBeInTheDocument();
  });
});

// ── FieldLabel ────────────────────────────────────────────────────────────────

describe('FieldLabel', () => {
  it('renders its text content', () => {
    render(<FieldLabel>Full Name</FieldLabel>);
    expect(screen.getByText('Full Name')).toBeInTheDocument();
  });

  it('has data-slot=field-label', () => {
    render(<FieldLabel>Label</FieldLabel>);
    expect(screen.getByText('Label')).toHaveAttribute('data-slot', 'field-label');
  });
});

// ── FieldDescription ──────────────────────────────────────────────────────────

describe('FieldDescription', () => {
  it('renders its text content', () => {
    render(<FieldDescription>Enter your full legal name</FieldDescription>);
    expect(screen.getByText('Enter your full legal name')).toBeInTheDocument();
  });

  it('renders as a paragraph with data-slot=field-description', () => {
    render(<FieldDescription>hint text</FieldDescription>);
    const el = screen.getByText('hint text');
    expect(el.tagName).toBe('P');
    expect(el).toHaveAttribute('data-slot', 'field-description');
  });
});
