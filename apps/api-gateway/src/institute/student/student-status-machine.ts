/**
 * Academic status state machine (ROV-154, PRD Part 3 §1.1).
 *
 * Validates transitions at the application level. Invalid transitions
 * throw a GraphQL-friendly error with code INVALID_STATUS_TRANSITION (422).
 *
 * Terminal states: TRANSFERRED_OUT (requires TC issued), GRADUATED → PASSOUT, EXPELLED.
 */
import { UnprocessableEntityException } from '@nestjs/common';
import { AcademicStatus } from '@roviq/common-types';

/** Re-export for consumers that import AcademicStatus from this module */
export type { AcademicStatus };

/**
 * Map of valid transitions: `from` → set of allowed `to` statuses.
 *
 * - ENROLLED → PROMOTED, DETAINED, GRADUATED, TRANSFERRED_OUT, DROPPED_OUT, WITHDRAWN, SUSPENDED, EXPELLED
 * - PROMOTED → ENROLLED (next year enrollment)
 * - DETAINED → ENROLLED (re-enrolled in same class)
 * - SUSPENDED → ENROLLED (reinstated), EXPELLED
 * - WITHDRAWN → RE_ENROLLED
 * - GRADUATED → PASSOUT
 * - TRANSFERRED_OUT → terminal (TC issued, no further transitions)
 * - EXPELLED → terminal
 * - PASSOUT → terminal
 * - DROPPED_OUT → RE_ENROLLED
 * - RE_ENROLLED → ENROLLED
 */
const VALID_TRANSITIONS: Record<AcademicStatus, ReadonlySet<AcademicStatus>> = {
  [AcademicStatus.ENROLLED]: new Set([
    AcademicStatus.PROMOTED,
    AcademicStatus.DETAINED,
    AcademicStatus.GRADUATED,
    AcademicStatus.TRANSFERRED_OUT,
    AcademicStatus.DROPPED_OUT,
    AcademicStatus.WITHDRAWN,
    AcademicStatus.SUSPENDED,
    AcademicStatus.EXPELLED,
  ]),
  [AcademicStatus.PROMOTED]: new Set([AcademicStatus.ENROLLED]),
  [AcademicStatus.DETAINED]: new Set([AcademicStatus.ENROLLED]),
  [AcademicStatus.SUSPENDED]: new Set([AcademicStatus.ENROLLED, AcademicStatus.EXPELLED]),
  [AcademicStatus.WITHDRAWN]: new Set([AcademicStatus.RE_ENROLLED]),
  [AcademicStatus.DROPPED_OUT]: new Set([AcademicStatus.RE_ENROLLED]),
  [AcademicStatus.RE_ENROLLED]: new Set([AcademicStatus.ENROLLED]),
  [AcademicStatus.GRADUATED]: new Set([AcademicStatus.PASSOUT]),
  [AcademicStatus.TRANSFERRED_OUT]: new Set(),
  [AcademicStatus.EXPELLED]: new Set(),
  [AcademicStatus.PASSOUT]: new Set(),
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

  // TRANSFERRED_OUT requires TC to be issued
  if (to === AcademicStatus.TRANSFERRED_OUT && !context?.tcIssued) {
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
