import '@testing-library/jest-dom/vitest';
import type { ColumnDef } from '@tanstack/react-table';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ResponsiveDataTable } from '../responsive-data-table';

afterEach(cleanup);

interface TestRow {
  id: number;
  name: string;
}

const columns: ColumnDef<TestRow, unknown>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
];

const data: TestRow[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

describe('ResponsiveDataTable', () => {
  it('renders the wrapper with the responsive testid', () => {
    render(<ResponsiveDataTable columns={columns} data={data} />);
    expect(screen.getByTestId('responsive-data-table')).toBeInTheDocument();
  });

  it('renders only the desktop table when mobileCard is not provided', () => {
    render(<ResponsiveDataTable columns={columns} data={data} />);

    // Table content is in the DOM (rendered by the underlying DataTable)
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();

    // No mobile container at all
    expect(screen.queryByTestId('responsive-data-table-mobile')).not.toBeInTheDocument();
  });

  it('renders both the table and the mobile card list when mobileCard is provided', () => {
    render(
      <ResponsiveDataTable
        columns={columns}
        data={data}
        mobileCard={(row) => <div>card-{row.name}</div>}
      />,
    );

    // Mobile container present
    const mobileContainer = screen.getByTestId('responsive-data-table-mobile');
    expect(mobileContainer).toBeInTheDocument();
    // Tailwind classes toggle visibility — both renderings stay in DOM
    expect(mobileContainer.className).toContain('sm:hidden');

    // Each row has a card with a stable testid
    expect(screen.getByTestId('responsive-data-table-card-0')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-data-table-card-1')).toBeInTheDocument();

    // Card content from the render prop is present
    expect(screen.getByText('card-Alice')).toBeInTheDocument();
    expect(screen.getByText('card-Bob')).toBeInTheDocument();

    // Desktop table content also still in the DOM (hidden via CSS)
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders empty fallback inside mobile when no rows and mobileCard provided', () => {
    render(
      <ResponsiveDataTable
        columns={columns}
        data={[]}
        emptyMessage="Nothing here"
        mobileCard={(row: TestRow) => <div>card-{row.name}</div>}
      />,
    );

    const mobileContainer = screen.getByTestId('responsive-data-table-mobile');
    expect(mobileContainer).toBeInTheDocument();
    // Mobile fallback message
    expect(mobileContainer.textContent).toContain('Nothing here');
    // No row cards rendered
    expect(screen.queryByTestId('responsive-data-table-card-0')).not.toBeInTheDocument();
  });
});
