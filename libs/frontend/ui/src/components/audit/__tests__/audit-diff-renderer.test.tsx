import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AuditDiffRenderer } from '../audit-diff-renderer';

afterEach(cleanup);

describe('AuditDiffRenderer', () => {
  it('renders UPDATE diff with old and new values', () => {
    render(
      <AuditDiffRenderer
        actionType="UPDATE"
        changes={{
          name: { old: 'Raj', new: 'Rajesh' },
          email: { old: 'raj@test.com', new: 'rajesh@test.com' },
        }}
      />,
    );

    expect(screen.getByText('name')).toBeDefined();
    expect(screen.getByText('Raj')).toBeDefined();
    expect(screen.getByText('Rajesh')).toBeDefined();
    expect(screen.getByText('email')).toBeDefined();
    // Arrow separator for UPDATE
    expect(screen.getAllByText('→').length).toBeGreaterThanOrEqual(1);
  });

  it('renders CREATE with only new values (all green)', () => {
    render(
      <AuditDiffRenderer
        actionType="CREATE"
        changes={{
          name: { old: null, new: 'New Student' },
          grade: { old: null, new: '10th' },
        }}
      />,
    );

    expect(screen.getByText('New Student')).toBeDefined();
    expect(screen.getByText('10th')).toBeDefined();
    // No arrow for CREATE
    expect(screen.queryByText('→')).toBeNull();
  });

  it('renders DELETE as collapsible, expands on click', () => {
    render(
      <AuditDiffRenderer
        actionType="DELETE"
        changes={{
          name: { old: 'Deleted Student', new: null },
          email: { old: 'del@test.com', new: null },
        }}
      />,
    );

    // Initially collapsed — shows field count
    expect(screen.getByText('2 fields deleted')).toBeDefined();
    // Values not visible yet
    expect(screen.queryByText('Deleted Student')).toBeNull();

    // Click to expand
    fireEvent.click(screen.getByText('2 fields deleted'));

    // Now values visible
    expect(screen.getByText('Deleted Student')).toBeDefined();
    expect(screen.getByText('del@test.com')).toBeDefined();
  });

  it('handles [REDACTED] values with plain badge', () => {
    render(
      <AuditDiffRenderer
        actionType="UPDATE"
        changes={{
          name: { old: 'Raj', new: 'Rajesh' },
          password: { old: '[REDACTED]', new: '[REDACTED]' },
        }}
      />,
    );

    // [REDACTED] shown as badge text
    const redactedElements = screen.getAllByText('[REDACTED]');
    expect(redactedElements.length).toBe(2); // old + new
    // Real value still shown for non-masked field
    expect(screen.getByText('Raj')).toBeDefined();
  });

  it('renders null changes as empty state', () => {
    render(<AuditDiffRenderer actionType="UPDATE" changes={null} />);
    expect(screen.getByText('No changes recorded')).toBeDefined();
  });

  it('renders empty changes object as empty state', () => {
    render(<AuditDiffRenderer actionType="UPDATE" changes={{}} />);
    expect(screen.getByText('No changes recorded')).toBeDefined();
  });

  it('handles null values as em-dash', () => {
    render(
      <AuditDiffRenderer actionType="UPDATE" changes={{ field: { old: null, new: 'value' } }} />,
    );
    expect(screen.getByText('—')).toBeDefined();
  });

  it('handles nested objects (formatted JSON)', () => {
    render(
      <AuditDiffRenderer
        actionType="CREATE"
        changes={{
          address: { old: null, new: { city: 'Delhi', state: 'DL' } },
        }}
      />,
    );

    // Nested object rendered as JSON
    const container = screen.getByText(/Delhi/);
    expect(container).toBeDefined();
  });

  it('handles arrays as comma-separated values', () => {
    render(
      <AuditDiffRenderer
        actionType="CREATE"
        changes={{
          tags: { old: null, new: ['math', 'science', 'english'] },
        }}
      />,
    );

    expect(screen.getByText('math, science, english')).toBeDefined();
  });
});
