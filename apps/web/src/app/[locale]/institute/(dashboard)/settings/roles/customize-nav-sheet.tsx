'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ALL_NAV_SLUGS, MAX_PRIMARY_NAV_SLUGS, type NavSlug } from '@roviq/common-types';
import { gql, useMutation } from '@roviq/graphql';
import {
  Badge,
  Button,
  Checkbox,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Spinner,
} from '@roviq/ui';
import { GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type {
  UpdateRolePrimaryNavMutation,
  UpdateRolePrimaryNavMutationVariables,
} from './customize-nav-sheet.generated';

export const UPDATE_ROLE_PRIMARY_NAV_MUTATION = gql`
  mutation UpdateRolePrimaryNav($input: UpdateRolePrimaryNavInput!) {
    updateRolePrimaryNav(input: $input) {
      id
      primaryNavSlugs
    }
  }
`;

interface CustomizeNavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleId: string;
  roleName: string;
  initialSlugs: readonly string[];
  /** Refetch the parent list after save. */
  onSaved?: () => void;
}

interface SortableRowProps {
  slug: NavSlug;
  label: string;
  position: number | null;
  selected: boolean;
  onToggle: () => void;
}

function SortableRow({ slug, label, position, selected, onToggle }: SortableRowProps) {
  const t = useTranslations('settings.roles');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slug,
    // Disable dragging for unselected rows — only selected slugs participate
    // in ordering.
    disabled: !selected,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border bg-background p-3"
    >
      <span
        className="flex w-8 shrink-0 items-center justify-center text-sm font-medium tabular-nums"
        data-testid={selected ? `slug-position-${slug}` : undefined}
      >
        <span className="sr-only">
          {position !== null ? t('positionAria', { position }) : t('positionUnselectedAria')}
        </span>
        <span aria-hidden="true">{position !== null ? position : '—'}</span>
      </span>

      <Checkbox
        id={`slug-${slug}`}
        checked={selected}
        onCheckedChange={onToggle}
        data-testid={`slug-checkbox-${slug}`}
        aria-label={label}
      />

      <label htmlFor={`slug-${slug}`} className="flex-1 cursor-pointer text-sm">
        {label}
      </label>

      {selected && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label={t('dragHandleAria', { label })}
          data-testid={`slug-drag-${slug}`}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

export function CustomizeNavSheet({
  open,
  onOpenChange,
  roleId,
  roleName,
  initialSlugs,
  onSaved,
}: CustomizeNavSheetProps) {
  const t = useTranslations('settings.roles');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');

  // Filter to known slugs only — older roles may have legacy slugs that no
  // longer exist in NAV_SLUGS. Render in selection order so positions are
  // stable.
  const initialSelected = useMemo<NavSlug[]>(
    () =>
      initialSlugs.filter((s): s is NavSlug => (ALL_NAV_SLUGS as readonly string[]).includes(s)),
    [initialSlugs],
  );

  const [selected, setSelected] = useState<NavSlug[]>(initialSelected);

  // Reset whenever the sheet re-opens for a different role / fresh data.
  useEffect(() => {
    if (open) setSelected(initialSelected);
  }, [open, initialSelected]);

  const [save, { loading }] = useMutation<
    UpdateRolePrimaryNavMutation,
    UpdateRolePrimaryNavMutationVariables
  >(UPDATE_ROLE_PRIMARY_NAV_MUTATION);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Build the row order: selected slugs first (in their chosen order), then
  // the remaining unselected slugs in their canonical NAV_SLUGS order. This
  // gives the user a stable mental model — picking promotes a row to the top
  // of the picker so the position number is immediately visible.
  const orderedRows = useMemo<NavSlug[]>(() => {
    const selectedSet = new Set<NavSlug>(selected);
    const rest = ALL_NAV_SLUGS.filter((s) => !selectedSet.has(s));
    return [...selected, ...rest];
  }, [selected]);

  function toggle(slug: NavSlug) {
    setSelected((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((s) => s !== slug);
      }
      if (prev.length >= MAX_PRIMARY_NAV_SLUGS) {
        toast.error(t('maxFour', { max: MAX_PRIMARY_NAV_SLUGS }));
        return prev;
      }
      return [...prev, slug];
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSelected((prev) => {
      const oldIndex = prev.indexOf(active.id as NavSlug);
      const newIndex = prev.indexOf(over.id as NavSlug);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  async function handleSave() {
    try {
      await save({
        variables: { input: { roleId, slugs: selected } },
      });
      toast.success(t('success'));
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('saveFailed');
      toast.error(message);
    }
  }

  // Translate a slug to a human label using the existing `nav.*` keys. Some
  // slugs intentionally have no nav.* equivalent (e.g. the slug catalogue
  // exposes more destinations than the sidebar — that's by design). For those
  // we fall back to the slug verbatim so the user still sees something
  // recognisable.
  function labelForSlug(slug: NavSlug): string {
    try {
      // next-intl throws on missing keys in dev. Guard with try/catch.
      return tNav(slug as Parameters<typeof tNav>[0]);
    } catch {
      return slug;
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-testid="customize-sheet"
        className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        aria-busy={loading}
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{t('customizeSheetTitle', { roleName })}</SheetTitle>
          <SheetDescription>{t('customizeSheetDescription')}</SheetDescription>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="secondary" data-testid="customize-selected-count">
              {t('selectedCount', { count: selected.length, max: MAX_PRIMARY_NAV_SLUGS })}
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={selected} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {orderedRows.map((slug) => {
                  const idx = selected.indexOf(slug);
                  return (
                    <SortableRow
                      key={slug}
                      slug={slug}
                      label={labelForSlug(slug)}
                      position={idx === -1 ? null : idx + 1}
                      selected={idx !== -1}
                      onToggle={() => toggle(slug)}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>

          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">{t('skippedNote')}</p>
        </div>

        <SheetFooter className="sticky bottom-0 border-t bg-background px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            data-testid="customize-cancel"
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={loading}
            aria-busy={loading}
            data-testid="customize-save"
          >
            {loading && <Spinner className="me-2 size-4" aria-hidden="true" />}
            {loading ? tCommon('saving') : t('save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
