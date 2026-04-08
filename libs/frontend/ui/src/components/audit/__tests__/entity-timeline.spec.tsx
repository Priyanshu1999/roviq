import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EntityTimeline, type EntityTimelineEvent } from '../entity-timeline';

const t = (key: string) => key;
const formatDate = (date: Date | number, _fmt: string) => new Date(date).toISOString();

const baseProps = {
  entityType: 'Student',
  entityId: 'student-1',
  t,
  formatDate,
  hasNextPage: false,
  onLoadMore: vi.fn(),
  canRead: true,
};

const buildEvent = (overrides: Partial<EntityTimelineEvent> = {}): EntityTimelineEvent => ({
  id: 'evt-1',
  action: 'updateStudent',
  actionType: 'UPDATE',
  entityType: 'Student',
  createdAt: '2026-04-01T10:00:00.000Z',
  actorName: 'Asha Patel',
  changes: { name: { old: 'A', new: 'B' } },
  metadata: null,
  ...overrides,
});

describe('EntityTimeline', () => {
  it('renders nothing when canRead is false (graceful degradation)', () => {
    const { container } = render(
      <EntityTimeline
        {...baseProps}
        canRead={false}
        loading={false}
        data={{ events: [buildEvent()], totalCount: 1 }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows skeleton (and not the empty state) when loading with no data', () => {
    render(<EntityTimeline {...baseProps} loading={true} data={undefined} />);
    // Loading state should NOT render the empty-state copy
    expect(screen.queryByText('entityTimeline.noHistory')).not.toBeInTheDocument();
    // …nor any actor or action text from real events
    expect(screen.queryByText('updateStudent')).not.toBeInTheDocument();
  });

  it('shows empty state when there are no events', () => {
    render(<EntityTimeline {...baseProps} loading={false} data={{ events: [], totalCount: 0 }} />);
    expect(screen.getByText('entityTimeline.noHistory')).toBeInTheDocument();
  });

  it('renders an event with action name and actor', () => {
    render(
      <EntityTimeline
        {...baseProps}
        loading={false}
        data={{ events: [buildEvent()], totalCount: 1 }}
      />,
    );
    expect(screen.getByText('updateStudent')).toBeInTheDocument();
    expect(screen.getByText('Asha Patel')).toBeInTheDocument();
  });

  it('shows load more button when hasNextPage is true and triggers callback', async () => {
    const onLoadMore = vi.fn().mockResolvedValue(undefined);
    render(
      <EntityTimeline
        {...baseProps}
        hasNextPage={true}
        onLoadMore={onLoadMore}
        loading={false}
        data={{ events: [buildEvent()], totalCount: 5 }}
      />,
    );
    const button = screen.getByRole('button', { name: /loadMore/i });
    await userEvent.click(button);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('hides load more button when there is no next page', () => {
    render(
      <EntityTimeline
        {...baseProps}
        hasNextPage={false}
        loading={false}
        data={{ events: [buildEvent()], totalCount: 1 }}
      />,
    );
    expect(screen.queryByRole('button', { name: /loadMore/i })).not.toBeInTheDocument();
  });
});
