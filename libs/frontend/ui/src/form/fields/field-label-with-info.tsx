'use client';

import { FieldLabel } from '@roviq/ui/components/ui/field';
import type { ReactNode } from 'react';

export interface FieldLabelWithInfoProps {
  htmlFor: string;
  children: ReactNode;
  /**
   * Optional slot rendered inline after the label text — typically a
   * `<FieldInfoPopover>` but kept as `ReactNode` so callers can swap in a
   * custom popover, hover-card, drawer trigger, or any other affordance
   * without an API change here.
   */
  info?: ReactNode;
}

/**
 * Thin wrapper around `<FieldLabel>` that appends an arbitrary `info` slot
 * after the label text. Used by every shared field component so the `info`
 * prop is uniformly available without repeating the render-next-to-label
 * markup at each call site.
 */
export function FieldLabelWithInfo({ htmlFor, children, info }: FieldLabelWithInfoProps) {
  if (!info) {
    return <FieldLabel htmlFor={htmlFor}>{children}</FieldLabel>;
  }
  // Render info as a sibling of the label (not nested inside) so queries like
  // `getByLabelText(...)` / the platform accessible-name algorithm treat the
  // label as belonging solely to the input it points at.
  return (
    <span className="flex items-center gap-2">
      <FieldLabel htmlFor={htmlFor}>{children}</FieldLabel>
      {info}
    </span>
  );
}
