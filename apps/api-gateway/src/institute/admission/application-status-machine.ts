/**
 * Admission application status state machine (ROV-159, PRD Part 3 §1.2).
 *
 * 18 statuses covering the full admission lifecycle from draft through enrollment.
 * Invalid transitions throw INVALID_STATUS_TRANSITION (422).
 */
import { UnprocessableEntityException } from '@nestjs/common';
import { AdmissionApplicationStatus } from '@roviq/common-types';

/** All valid application statuses — matches AdmissionApplicationStatus pgEnum */
export type ApplicationStatus = AdmissionApplicationStatus;

/**
 * Valid transitions map.
 *
 * Linear flow: DRAFT → SUBMITTED → DOCUMENTS_PENDING → DOCUMENTS_VERIFIED
 *   → TEST_SCHEDULED → TEST_COMPLETED → INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED
 *   → MERIT_LISTED → OFFER_MADE → OFFER_ACCEPTED → FEE_PENDING → FEE_PAID → ENROLLED
 *
 * Branches:
 * - SUBMITTED can skip directly to TEST_SCHEDULED, or be REJECTED/WITHDRAWN
 * - DOCUMENTS_VERIFIED → MERIT_LISTED | OFFER_MADE | WAITLISTED | REJECTED
 * - MERIT_LISTED → OFFER_MADE | WAITLISTED | REJECTED
 * - OFFER_MADE → OFFER_ACCEPTED | WITHDRAWN | EXPIRED
 * - WAITLISTED → OFFER_MADE | REJECTED | WITHDRAWN
 * - TEST_COMPLETED → INTERVIEW_SCHEDULED | MERIT_LISTED | DOCUMENTS_VERIFIED
 * - INTERVIEW_COMPLETED → MERIT_LISTED | DOCUMENTS_VERIFIED
 *
 * Terminal states: ENROLLED, REJECTED, WITHDRAWN, EXPIRED
 */
const VALID_TRANSITIONS: Record<ApplicationStatus, ReadonlySet<ApplicationStatus>> = {
  [AdmissionApplicationStatus.DRAFT]: new Set([
    AdmissionApplicationStatus.SUBMITTED,
    AdmissionApplicationStatus.WITHDRAWN,
  ]),
  [AdmissionApplicationStatus.SUBMITTED]: new Set([
    AdmissionApplicationStatus.DOCUMENTS_PENDING,
    AdmissionApplicationStatus.TEST_SCHEDULED,
    AdmissionApplicationStatus.REJECTED,
    AdmissionApplicationStatus.WITHDRAWN,
  ]),
  [AdmissionApplicationStatus.DOCUMENTS_PENDING]: new Set([
    AdmissionApplicationStatus.DOCUMENTS_VERIFIED,
    AdmissionApplicationStatus.WITHDRAWN,
  ]),
  [AdmissionApplicationStatus.DOCUMENTS_VERIFIED]: new Set([
    AdmissionApplicationStatus.TEST_SCHEDULED,
    AdmissionApplicationStatus.INTERVIEW_SCHEDULED,
    AdmissionApplicationStatus.MERIT_LISTED,
    AdmissionApplicationStatus.OFFER_MADE,
    AdmissionApplicationStatus.WAITLISTED,
    AdmissionApplicationStatus.REJECTED,
  ]),
  [AdmissionApplicationStatus.TEST_SCHEDULED]: new Set([
    AdmissionApplicationStatus.TEST_COMPLETED,
    AdmissionApplicationStatus.WITHDRAWN,
  ]),
  [AdmissionApplicationStatus.TEST_COMPLETED]: new Set([
    AdmissionApplicationStatus.INTERVIEW_SCHEDULED,
    AdmissionApplicationStatus.MERIT_LISTED,
    AdmissionApplicationStatus.DOCUMENTS_VERIFIED,
    AdmissionApplicationStatus.REJECTED,
  ]),
  [AdmissionApplicationStatus.INTERVIEW_SCHEDULED]: new Set([
    AdmissionApplicationStatus.INTERVIEW_COMPLETED,
    AdmissionApplicationStatus.WITHDRAWN,
  ]),
  [AdmissionApplicationStatus.INTERVIEW_COMPLETED]: new Set([
    AdmissionApplicationStatus.MERIT_LISTED,
    AdmissionApplicationStatus.DOCUMENTS_VERIFIED,
    AdmissionApplicationStatus.REJECTED,
  ]),
  [AdmissionApplicationStatus.MERIT_LISTED]: new Set([
    AdmissionApplicationStatus.OFFER_MADE,
    AdmissionApplicationStatus.WAITLISTED,
    AdmissionApplicationStatus.REJECTED,
  ]),
  [AdmissionApplicationStatus.OFFER_MADE]: new Set([
    AdmissionApplicationStatus.OFFER_ACCEPTED,
    AdmissionApplicationStatus.WITHDRAWN,
    AdmissionApplicationStatus.EXPIRED,
  ]),
  [AdmissionApplicationStatus.OFFER_ACCEPTED]: new Set([
    AdmissionApplicationStatus.FEE_PENDING,
    AdmissionApplicationStatus.WITHDRAWN,
  ]),
  [AdmissionApplicationStatus.FEE_PENDING]: new Set([
    AdmissionApplicationStatus.FEE_PAID,
    AdmissionApplicationStatus.WITHDRAWN,
  ]),
  [AdmissionApplicationStatus.FEE_PAID]: new Set([AdmissionApplicationStatus.ENROLLED]),
  [AdmissionApplicationStatus.ENROLLED]: new Set(),
  [AdmissionApplicationStatus.WAITLISTED]: new Set([
    AdmissionApplicationStatus.OFFER_MADE,
    AdmissionApplicationStatus.REJECTED,
    AdmissionApplicationStatus.WITHDRAWN,
  ]),
  [AdmissionApplicationStatus.REJECTED]: new Set(),
  [AdmissionApplicationStatus.WITHDRAWN]: new Set(),
  [AdmissionApplicationStatus.EXPIRED]: new Set(),
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
  if (!allowed?.has(to)) {
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
  AdmissionApplicationStatus.ENROLLED,
  AdmissionApplicationStatus.REJECTED,
  AdmissionApplicationStatus.WITHDRAWN,
  AdmissionApplicationStatus.EXPIRED,
]);

/** Ordered funnel stages for admissionStatistics */
export const FUNNEL_STAGES: readonly ApplicationStatus[] = [
  AdmissionApplicationStatus.SUBMITTED,
  AdmissionApplicationStatus.DOCUMENTS_VERIFIED,
  AdmissionApplicationStatus.TEST_COMPLETED,
  AdmissionApplicationStatus.INTERVIEW_COMPLETED,
  AdmissionApplicationStatus.MERIT_LISTED,
  AdmissionApplicationStatus.OFFER_MADE,
  AdmissionApplicationStatus.OFFER_ACCEPTED,
  AdmissionApplicationStatus.FEE_PENDING,
  AdmissionApplicationStatus.FEE_PAID,
  AdmissionApplicationStatus.ENROLLED,
];
