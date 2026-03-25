/**
 * Admission application status state machine (ROV-159, PRD Part 3 §1.2).
 *
 * 18 statuses covering the full admission lifecycle from draft through enrollment.
 * Invalid transitions throw INVALID_STATUS_TRANSITION (422).
 */
import { UnprocessableEntityException } from '@nestjs/common';

/** All valid application statuses — matches chk_application_status CHECK constraint */
export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'documents_pending'
  | 'documents_verified'
  | 'test_scheduled'
  | 'test_completed'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'merit_listed'
  | 'offer_made'
  | 'offer_accepted'
  | 'fee_pending'
  | 'fee_paid'
  | 'enrolled'
  | 'waitlisted'
  | 'rejected'
  | 'withdrawn'
  | 'expired';

/**
 * Valid transitions map.
 *
 * Linear flow: draft → submitted → documents_pending → documents_verified
 *   → test_scheduled → test_completed → interview_scheduled → interview_completed
 *   → merit_listed → offer_made → offer_accepted → fee_pending → fee_paid → enrolled
 *
 * Branches:
 * - submitted can skip directly to test_scheduled, under_review, or be rejected/withdrawn
 * - documents_verified → merit_listed | offer_made | waitlisted | rejected
 * - merit_listed → offer_made | waitlisted | rejected
 * - offer_made → offer_accepted | withdrawn | expired
 * - waitlisted → offer_made | rejected | withdrawn
 * - test_completed → interview_scheduled | merit_listed | documents_verified
 * - interview_completed → merit_listed | documents_verified
 *
 * Terminal states: enrolled, rejected, withdrawn, expired
 */
const VALID_TRANSITIONS: Record<ApplicationStatus, ReadonlySet<ApplicationStatus>> = {
  draft: new Set(['submitted', 'withdrawn']),
  submitted: new Set(['documents_pending', 'test_scheduled', 'rejected', 'withdrawn']),
  documents_pending: new Set(['documents_verified', 'withdrawn']),
  documents_verified: new Set([
    'test_scheduled',
    'interview_scheduled',
    'merit_listed',
    'offer_made',
    'waitlisted',
    'rejected',
  ]),
  test_scheduled: new Set(['test_completed', 'withdrawn']),
  test_completed: new Set([
    'interview_scheduled',
    'merit_listed',
    'documents_verified',
    'rejected',
  ]),
  interview_scheduled: new Set(['interview_completed', 'withdrawn']),
  interview_completed: new Set(['merit_listed', 'documents_verified', 'rejected']),
  merit_listed: new Set(['offer_made', 'waitlisted', 'rejected']),
  offer_made: new Set(['offer_accepted', 'withdrawn', 'expired']),
  offer_accepted: new Set(['fee_pending', 'withdrawn']),
  fee_pending: new Set(['fee_paid', 'withdrawn']),
  fee_paid: new Set(['enrolled']),
  enrolled: new Set(),
  waitlisted: new Set(['offer_made', 'rejected', 'withdrawn']),
  rejected: new Set(),
  withdrawn: new Set(),
  expired: new Set(),
};

/**
 * Validate an application status transition.
 *
 * @throws UnprocessableEntityException with code INVALID_STATUS_TRANSITION
 */
export function validateApplicationTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.has(to)) {
    throw new UnprocessableEntityException({
      message: `Invalid application status transition: ${from} → ${to}`,
      code: 'INVALID_STATUS_TRANSITION',
    });
  }
}

/**
 * Check if a transition is valid without throwing.
 */
export function isValidApplicationTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return !!allowed && allowed.has(to);
}

/** Statuses that represent the end of the application lifecycle */
export const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  'enrolled',
  'rejected',
  'withdrawn',
  'expired',
]);

/** Ordered funnel stages for admissionStatistics */
export const FUNNEL_STAGES: readonly ApplicationStatus[] = [
  'submitted',
  'documents_verified',
  'test_completed',
  'interview_completed',
  'merit_listed',
  'offer_made',
  'offer_accepted',
  'fee_pending',
  'fee_paid',
  'enrolled',
];
