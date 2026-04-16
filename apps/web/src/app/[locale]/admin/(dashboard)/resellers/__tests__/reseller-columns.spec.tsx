import '@testing-library/jest-dom/vitest';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createResellerColumns } from '../reseller-columns';
import type { ResellerNode } from '../types';

// Minimal translator: echoes dotted keys back so the test can assert which
// i18n slot rendered. Matches the `(key) => string` signature createResellerColumns expects.
const t = (key: string) => key;
const formatDate = (d: Date) => d.toISOString();

function makeReseller(overrides: Partial<ResellerNode> = {}): ResellerNode {
  return {
    id: 'r1',
    name: 'Acme Partners',
    slug: 'acme-partners',
    tier: 'FULL_MANAGEMENT',
    status: 'ACTIVE',
    isSystem: false,
    isActive: true,
    customDomain: null,
    suspendedAt: null,
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    instituteCount: 3,
    teamSize: 5,
    branding: null,
    ...overrides,
  };
}

function TestTable({ rows }: { rows: ResellerNode[] }) {
  const columns = createResellerColumns(t, formatDate);
  const table = useReactTable({ columns, data: rows, getCoreRowModel: getCoreRowModel() });
  return (
    <table>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

describe('createResellerColumns', () => {
  it('renders the reseller name and a name-cell testid keyed by id', () => {
    render(<TestTable rows={[makeReseller({ id: 'abc-123', name: 'Acme Partners' })]} />);
    expect(screen.getByTestId('reseller-name-cell-abc-123')).toBeInTheDocument();
    expect(screen.getByText('Acme Partners')).toBeInTheDocument();
  });

  it('does NOT render the system badge for ordinary resellers', () => {
    render(<TestTable rows={[makeReseller({ isSystem: false })]} />);
    expect(screen.queryByText('detail.systemBadge')).not.toBeInTheDocument();
  });

  it('renders a lock icon + system badge for isSystem resellers', () => {
    render(<TestTable rows={[makeReseller({ isSystem: true, name: 'Roviq Direct' })]} />);
    // Badge text and the icon's aria-label both derive from detail.systemBadge.
    expect(screen.getAllByText('detail.systemBadge').length).toBeGreaterThan(0);
  });

  it('renders the tier label from i18n', () => {
    render(<TestTable rows={[makeReseller({ tier: 'READ_ONLY' })]} />);
    expect(screen.getByText('tiers.READ_ONLY')).toBeInTheDocument();
  });

  it('renders the status label from i18n', () => {
    render(<TestTable rows={[makeReseller({ status: 'SUSPENDED' })]} />);
    expect(screen.getByText('statuses.SUSPENDED')).toBeInTheDocument();
  });

  it('shows em-dash when customDomain is null', () => {
    render(<TestTable rows={[makeReseller({ customDomain: null })]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows the custom domain string when present', () => {
    render(<TestTable rows={[makeReseller({ customDomain: 'portal.acme.com' })]} />);
    expect(screen.getByText('portal.acme.com')).toBeInTheDocument();
  });

  it('formats institute and team counts as tabular numbers', () => {
    render(<TestTable rows={[makeReseller({ instituteCount: 42, teamSize: 8 })]} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });
});
