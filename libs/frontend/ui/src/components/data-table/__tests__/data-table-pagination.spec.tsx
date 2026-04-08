import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTablePagination } from '../data-table-pagination';

describe('DataTablePagination', () => {
  it('shows current count without total when totalCount is undefined', () => {
    render(
      <DataTablePagination
        hasNextPage={false}
        isLoadingMore={false}
        onLoadMore={() => {}}
        currentCount={20}
      />,
    );
    expect(screen.getByText(/Showing 20/)).toBeInTheDocument();
    expect(screen.queryByText(/of/)).not.toBeInTheDocument();
  });

  it('shows "Showing X of Y" when totalCount is provided', () => {
    render(
      <DataTablePagination
        hasNextPage={false}
        isLoadingMore={false}
        onLoadMore={() => {}}
        currentCount={20}
        totalCount={150}
      />,
    );
    expect(screen.getByText(/Showing 20/)).toBeInTheDocument();
    expect(screen.getByText(/of 150/)).toBeInTheDocument();
  });

  it('handles totalCount of zero (not falsy-skipped)', () => {
    render(
      <DataTablePagination
        hasNextPage={false}
        isLoadingMore={false}
        onLoadMore={() => {}}
        currentCount={0}
        totalCount={0}
      />,
    );
    expect(screen.getByText(/of 0/)).toBeInTheDocument();
  });

  it('hides load more button when hasNextPage is false', () => {
    render(
      <DataTablePagination
        hasNextPage={false}
        isLoadingMore={false}
        onLoadMore={() => {}}
        currentCount={20}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows load more button when hasNextPage is true', () => {
    render(
      <DataTablePagination
        hasNextPage={true}
        isLoadingMore={false}
        onLoadMore={() => {}}
        currentCount={20}
      />,
    );
    expect(screen.getByRole('button', { name: /Load more/i })).toBeInTheDocument();
  });

  it('calls onLoadMore when load more button is clicked', async () => {
    const onLoadMore = vi.fn();
    render(
      <DataTablePagination
        hasNextPage={true}
        isLoadingMore={false}
        onLoadMore={onLoadMore}
        currentCount={20}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Load more/i }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('disables load more button while loading', () => {
    render(
      <DataTablePagination
        hasNextPage={true}
        isLoadingMore={true}
        onLoadMore={() => {}}
        currentCount={20}
      />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('uses custom labels when provided', () => {
    render(
      <DataTablePagination
        hasNextPage={true}
        isLoadingMore={false}
        onLoadMore={() => {}}
        currentCount={20}
        totalCount={150}
        labels={{ showing: 'दिखा रहा', of: 'का', loadMore: 'और लोड करें' }}
      />,
    );
    expect(screen.getByText(/दिखा रहा 20/)).toBeInTheDocument();
    expect(screen.getByText(/का 150/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'और लोड करें' })).toBeInTheDocument();
  });
});
