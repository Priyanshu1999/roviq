import { Popover, PopoverContent, PopoverTrigger } from '@roviq/ui/components/ui/popover';
import { cn } from '@roviq/ui/lib/utils';
import { Info } from 'lucide-react';
import * as React from 'react';

type FieldInfoPopoverProps = {
  title: string;
  children: React.ReactNode;
  side?: React.ComponentProps<typeof PopoverContent>['side'];
  align?: React.ComponentProps<typeof PopoverContent>['align'];
  iconClassName?: string;
  contentClassName?: string;
  'data-testid'?: string;
};

/** Standard hover-open delay — feels intentional without being slow. */
const HOVER_OPEN_DELAY_MS = 250;
/**
 * Generous close delay so the cursor has time to cross the icon-to-popover
 * gap without the body flickering shut. Any mouseenter on the popover body
 * cancels this timer, so the popover stays open as long as the cursor is
 * anywhere inside the trigger+content region.
 */
const HOVER_CLOSE_DELAY_MS = 300;

/**
 * Contextual field-help affordance. Opens on hover (after a short intent
 * delay) OR click — click is important for touch/keyboard users and for
 * mouse users who want the popover to stay open while they read. Click
 * also bypasses the hover delay for power users. Outside-click closes.
 */
function FieldInfoPopover({
  title,
  children,
  side = 'top',
  align = 'start',
  iconClassName,
  contentClassName,
  'data-testid': testId,
}: FieldInfoPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleOpen = React.useCallback(() => {
    cancelTimer();
    timerRef.current = setTimeout(() => setOpen(true), HOVER_OPEN_DELAY_MS);
  }, [cancelTimer]);

  const scheduleClose = React.useCallback(() => {
    cancelTimer();
    timerRef.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  }, [cancelTimer]);

  React.useEffect(() => cancelTimer, [cancelTimer]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label="More info"
        data-testid={testId ?? 'field-info-trigger'}
        data-slot="field-info-trigger"
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        className={cn(
          'inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full',
          'text-muted-foreground/70 transition-colors',
          'hover:text-foreground focus-visible:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1',
        )}
      >
        <Info className={cn('size-3.5', iconClassName)} strokeWidth={2} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={2}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={cancelTimer}
        onMouseLeave={scheduleClose}
        className={cn(
          'w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-border/60 p-0 text-sm shadow-lg',
          contentClassName,
        )}
        data-slot="field-info-content"
      >
        <div className="flex items-start gap-2.5 border-b border-border/60 px-3.5 py-2.5">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="font-medium leading-snug text-foreground">{title}</p>
        </div>
        <div
          className={cn(
            'px-3.5 py-2.5 text-[13px] leading-relaxed text-muted-foreground',
            '[&>p]:m-0 [&>p+p]:mt-2',
            '[&>ul]:m-0 [&>ul]:mt-1.5 [&>ul]:space-y-1 [&>ul]:ps-4',
            '[&>ol]:m-0 [&>ol]:mt-1.5 [&>ol]:space-y-1 [&>ol]:ps-4',
            '[&_em]:not-italic [&_em]:text-foreground/80',
          )}
        >
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { FieldInfoPopover, type FieldInfoPopoverProps };
