/**
 * Academic status state machine (ROV-154, PRD Part 3 §1.1).
 *
 * Validates transitions at the application level. Invalid transitions
 * throw a GraphQL-friendly error with code INVALID_STATUS_TRANSITION (422).
 *
 * Terminal states: transferred_out (requires TC issued), graduated → passout, expelled.
 */
import { UnprocessableEntityException } from '@nestjs/common';

/** All valid academic statuses for a student profile */
export type AcademicStatus =
  | 'enrolled'
  | 'promoted'
  | 'detained'
  | 'graduated'
  | 'transferred_out'
  | 'dropped_out'
  | 'withdrawn'
  | 'suspended'
  | 'expelled'
  | 're_enrolled'
  | 'passout';

/**
 * Map of valid transitions: `from` → set of allowed `to` statuses.
 *
 * - `enrolled` → promoted, detained, graduated, transferred_out, dropped_out, withdrawn, suspended, expelled
 * - `promoted` → enrolled (next year enrollment)
 * - `detained` → enrolled (re-enrolled in same class)
 * - `suspended` → enrolled (reinstated), expelled
 * - `withdrawn` → re_enrolled
 * - `graduated` → passout
 * - `transferred_out` → terminal (TC issued, no further transitions)
 * - `expelled` → terminal
 * - `passout` → terminal
 * - `dropped_out` → re_enrolled
 * - `re_enrolled` → enrolled
 */
const VALID_TRANSITIONS: Record<AcademicStatus, ReadonlySet<AcademicStatus>> = {
  enrolled: new Set([
    'promoted',
    'detained',
    'graduated',
    'transferred_out',
    'dropped_out',
    'withdrawn',
    'suspended',
    'expelled',
  ]),
  promoted: new Set(['enrolled']),
  detained: new Set(['enrolled']),
  suspended: new Set(['enrolled', 'expelled']),
  withdrawn: new Set(['re_enrolled']),
  dropped_out: new Set(['re_enrolled']),
  re_enrolled: new Set(['enrolled']),
  graduated: new Set(['passout']),
  transferred_out: new Set(),
  expelled: new Set(),
  passout: new Set(),
};

/**
 * Validate an academic status transition.
 *
 * @throws UnprocessableEntityException with code INVALID_STATUS_TRANSITION
 *         if the transition is not allowed.
 */
export function validateStatusTransition(
  from: AcademicStatus,
  to: AcademicStatus,
  context?: { tcIssued?: boolean },
): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.has(to)) {
    throw new UnprocessableEntityException({
      message: `Invalid status transition: ${from} → ${to}`,
      code: 'INVALID_STATUS_TRANSITION',
    });
  }

  // transferred_out requires TC to be issued
  if (to === 'transferred_out' && !context?.tcIssued) {
    throw new UnprocessableEntityException({
      message:
        'Cannot transfer out without issuing a Transfer Certificate (tc_issued must be true)',
      code: 'INVALID_STATUS_TRANSITION',
    });
  }
}

/**
 * Check if a status transition is valid without throwing.
 */
export function isValidTransition(from: AcademicStatus, to: AcademicStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return !!allowed && allowed.has(to);
}
