import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AuditDiffRenderer } from '../audit-diff-renderer';

describe('AuditDiffRenderer', () => {
  it('shows "no changes" message when changes are null', () => {
    render(<AuditDiffRenderer changes={null} actionType="UPDATE" />);
    expect(screen.getByText('No changes recorded')).toBeInTheDocument();
  });

  it('shows "no changes" when changes object is empty', () => {
    render(<AuditDiffRenderer changes={{}} actionType="UPDATE" />);
    expect(screen.getByText('No changes recorded')).toBeInTheDocument();
  });

  it('uses custom labels when provided', () => {
    render(
      <AuditDiffRenderer
        changes={null}
        actionType="UPDATE"
        labels={{ noChanges: 'कोई परिवर्तन नहीं' }}
      />,
    );
    expect(screen.getByText('कोई परिवर्तन नहीं')).toBeInTheDocument();
  });

  it('renders UPDATE diff with old and new values', () => {
    render(
      <AuditDiffRenderer
        changes={{ name: { old: 'Rajesh', new: 'Suresh' } }}
        actionType="UPDATE"
      />,
    );
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('Rajesh')).toBeInTheDocument();
    expect(screen.getByText('Suresh')).toBeInTheDocument();
    expect(screen.getByText('→')).toBeInTheDocument();
  });

  it('renders CREATE without old value column', () => {
    render(
      <AuditDiffRenderer changes={{ name: { old: null, new: 'Rajesh' } }} actionType="CREATE" />,
    );
    expect(screen.getByText('Rajesh')).toBeInTheDocument();
    expect(screen.queryByText('→')).not.toBeInTheDocument();
  });

  it('shows REDACTED badge for masked values', () => {
    render(
      <AuditDiffRenderer
        changes={{ password: { old: '[REDACTED]', new: '[REDACTED]' } }}
        actionType="UPDATE"
      />,
    );
    expect(screen.getAllByText('[REDACTED]').length).toBeGreaterThan(0);
  });

  it('formats null values as em-dash', () => {
    render(
      <AuditDiffRenderer changes={{ note: { old: null, new: 'hello' } }} actionType="UPDATE" />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('DELETE action is collapsible by default', async () => {
    render(
      <AuditDiffRenderer
        changes={{ name: { old: 'Rajesh', new: null }, age: { old: 12, new: null } }}
        actionType="DELETE"
      />,
    );
    expect(screen.getByText('2 fields deleted')).toBeInTheDocument();
    expect(screen.queryByText('Rajesh')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Rajesh')).toBeInTheDocument();
  });

  it('uses singular "field deleted" for one entry', () => {
    render(
      <AuditDiffRenderer changes={{ name: { old: 'Rajesh', new: null } }} actionType="DELETE" />,
    );
    expect(screen.getByText('1 field deleted')).toBeInTheDocument();
  });
});
