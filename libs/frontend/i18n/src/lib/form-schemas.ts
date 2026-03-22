import { z } from 'zod';

/**
 * Optional non-negative integer field for HTML number inputs with `valueAsNumber`.
 *
 * HTML number inputs produce `NaN` when left empty (with `valueAsNumber: true`).
 * This schema converts NaN to undefined so optional number fields work correctly.
 */
export const optionalInt = z.preprocess(
  (val) => (typeof val === 'number' && Number.isNaN(val) ? undefined : val),
  z.number().int().min(0).optional(),
);
