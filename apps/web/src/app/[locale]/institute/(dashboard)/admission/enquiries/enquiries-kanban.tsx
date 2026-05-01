'use client';

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { extractGraphQLError } from '@roviq/graphql';
import { useFormatDate } from '@roviq/i18n';
import { Badge, Card, CardContent, ScrollArea } from '@roviq/ui';
import { testIds } from '@roviq/ui/testing/testid-registry';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import {
  ENQUIRY_KANBAN_COLUMNS,
  ENQUIRY_STATUS_CLASS,
  ENQUIRY_STATUS_ICON,
  type EnquiryStatusKey,
} from '../admission-constants';
import { type EnquiryNode, useUpdateEnquiry } from '../use-admission';

/**
 * Kanban board for the enquiries page. Dragging a card across columns fires
 * `updateEnquiry` with the new status. The card's underlying position
 * reverts if the mutation fails (via a refetch from the parent list hook).
 *
 * Accessibility:
 *   - Every draggable card exposes `role="button"` + keyboard support via
 *     `KeyboardSensor` with `sortableKeyboardCoordinates`.
 *   - Each card has testid `enquiry-card-{id}` and each column has
 *     testid `kanban-column-{STATUS}` for Playwright.
 */
export interface EnquiriesKanbanProps {
  enquiries: EnquiryNode[];
  onCardClick?: (enquiry: EnquiryNode) => void;
}

export function EnquiriesKanban({ enquiries, onCardClick }: EnquiriesKanbanProps) {
  const [updateEnquiry] = useUpdateEnquiry();
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    // Require a small drag distance before starting so clicking a card
    // (e.g., to open a detail view) still registers as a click.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Partition enquiries into columns keyed by status. We also expose a
  // "snapshot" of the positions so optimistic updates can be reconciled
  // on mutation failure without re-reading Apollo cache directly.
  const grouped = React.useMemo(() => {
    const map = new Map<EnquiryStatusKey, EnquiryNode[]>();
    for (const col of ENQUIRY_KANBAN_COLUMNS) map.set(col, []);
    for (const e of enquiries) {
      const key = (e.status as EnquiryStatusKey) ?? 'NEW';
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(e);
    }
    return map;
  }, [enquiries]);

  const activeEnquiry = enquiries.find((e) => e.id === activeId) ?? null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const targetStatus = String(over.id) as EnquiryStatusKey;
    const enquiry = enquiries.find((e) => e.id === active.id);
    if (!enquiry) return;
    if (enquiry.status === targetStatus) return;
    try {
      await updateEnquiry({
        variables: {
          id: enquiry.id,
          input: { status: targetStatus },
        },
      });
    } catch (err) {
      const message = extractGraphQLError(err, '');
      toast.error(message || 'Could not move enquiry.');
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="w-full">
        <div className="flex gap-3 p-2" data-testid={testIds.instituteAdmissionEnquiries.kanban}>
          {ENQUIRY_KANBAN_COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              items={grouped.get(status) ?? []}
              onCardClick={onCardClick}
            />
          ))}
        </div>
      </ScrollArea>
      <DragOverlay>
        {activeEnquiry ? <KanbanCard enquiry={activeEnquiry} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  items,
  onCardClick,
}: {
  status: EnquiryStatusKey;
  items: EnquiryNode[];
  onCardClick?: (enquiry: EnquiryNode) => void;
}) {
  const t = useTranslations('admission');
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const Icon = ENQUIRY_STATUS_ICON[status];
  return (
    <div
      ref={setNodeRef}
      data-testid={`kanban-column-${status}`}
      className={`flex min-h-[70vh] w-[280px] shrink-0 flex-col rounded-md border bg-muted/40 ${
        isOver ? 'ring-2 ring-primary' : ''
      }`}
    >
      <header className="flex items-center justify-between gap-2 border-b p-3">
        <div className="flex items-center gap-2">
          <Icon aria-hidden="true" className="size-4" />
          <span className="text-sm font-medium">{t(`enquiryStatuses.${status}`)}</span>
        </div>
        <Badge variant="outline">{items.length}</Badge>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {items.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">—</p>
        )}
        {items.map((e) => (
          <KanbanCard key={e.id} enquiry={e} onClick={() => onCardClick?.(e)} />
        ))}
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────

function KanbanCard({
  enquiry,
  onClick,
  dragging,
}: {
  enquiry: EnquiryNode;
  onClick?: () => void;
  dragging?: boolean;
}) {
  const t = useTranslations('admission');
  const { format } = useFormatDate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: enquiry.id,
  });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
  };
  const status = enquiry.status as EnquiryStatusKey;
  const StatusIcon = ENQUIRY_STATUS_ICON[status] ?? ENQUIRY_STATUS_ICON.NEW;
  const followUp = enquiry.followUpDate ? new Date(enquiry.followUpDate) : null;
  const isOverdue = followUp && followUp.getTime() < Date.now();

  return (
    <Card
      ref={setNodeRef}
      style={style}
      data-testid={`enquiry-card-${enquiry.id}`}
      {...attributes}
      {...listeners}
      // Accessibility: dnd-kit adds role="button" via attributes; we add a
      // click handler that triggers only if the press wasn't a drag.
      onClick={() => {
        if (!dragging && !isDragging) onClick?.();
      }}
      className="cursor-grab active:cursor-grabbing shadow-sm"
    >
      <CardContent className="space-y-2 p-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{enquiry.studentName}</p>
            <p className="truncate text-xs text-muted-foreground">{enquiry.classRequested}</p>
          </div>
          <Badge
            variant="secondary"
            className={`inline-flex items-center gap-1 ${ENQUIRY_STATUS_CLASS[status] ?? ''}`}
          >
            <StatusIcon className="size-3" />
            {t(`enquiryStatuses.${status}`, { default: enquiry.status })}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {enquiry.parentName} · +91 {enquiry.parentPhone}
        </p>
        {followUp && (
          <p
            className={`text-xs ${
              isOverdue ? 'font-medium text-rose-700 dark:text-rose-400' : 'text-muted-foreground'
            }`}
          >
            {isOverdue && (
              <span className="me-1" aria-hidden="true">
                ⚠
              </span>
            )}
            {t('enquiries.columns.followUpDate')}: {format(followUp, 'dd MMM')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
