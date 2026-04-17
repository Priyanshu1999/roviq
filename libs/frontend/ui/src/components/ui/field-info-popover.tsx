import { Button } from '@roviq/ui/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@roviq/ui/components/ui/popover';
import { cn } from '@roviq/ui/lib/utils';
import { CircleHelp } from 'lucide-react';
import type * as React from 'react';

type FieldInfoPopoverProps = {
  title: string;
  children: React.ReactNode;
  side?: React.ComponentProps<typeof PopoverContent>['side'];
  align?: React.ComponentProps<typeof PopoverContent>['align'];
  iconClassName?: string;
  contentClassName?: string;
  'data-testid'?: string;
};

function FieldInfoPopover({
  title,
  children,
  side = 'top',
  align = 'start',
  iconClassName,
  contentClassName,
  'data-testid': testId,
}: FieldInfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="More info"
          data-testid={testId ?? 'field-info-trigger'}
          data-slot="field-info-trigger"
        >
          <CircleHelp
            className={cn('size-3.5 text-muted-foreground', iconClassName)}
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className={cn('max-w-xs text-sm', contentClassName)}
        data-slot="field-info-content"
      >
        <p className="mb-1 font-medium">{title}</p>
        <div className="space-y-1 text-muted-foreground [&>p]:leading-snug">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

export { FieldInfoPopover, type FieldInfoPopoverProps };
