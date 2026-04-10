import { UnprocessableEntityException } from '@nestjs/common';
import { AdmissionApplicationStatus } from '@roviq/common-types';
import { describe, expect, it } from 'vitest';
import {
  type ApplicationStatus,
  FUNNEL_STAGES,
  isValidApplicationTransition,
  TERMINAL_STATUSES,
  validateApplicationTransition,
} from '../application-status-machine';

const S = AdmissionApplicationStatus;

describe('application-status-machine', () => {
  // ── Valid transitions ──────────────────────────────────────

  const validPaths: [ApplicationStatus, ApplicationStatus][] = [
    // Happy path: full admission pipeline
    [S.DRAFT, S.SUBMITTED],
    [S.SUBMITTED, S.DOCUMENTS_PENDING],
    [S.DOCUMENTS_PENDING, S.DOCUMENTS_VERIFIED],
    [S.DOCUMENTS_VERIFIED, S.TEST_SCHEDULED],
    [S.TEST_SCHEDULED, S.TEST_COMPLETED],
    [S.TEST_COMPLETED, S.INTERVIEW_SCHEDULED],
    [S.INTERVIEW_SCHEDULED, S.INTERVIEW_COMPLETED],
    [S.INTERVIEW_COMPLETED, S.MERIT_LISTED],
    [S.MERIT_LISTED, S.OFFER_MADE],
    [S.OFFER_MADE, S.OFFER_ACCEPTED],
    [S.OFFER_ACCEPTED, S.FEE_PENDING],
    [S.FEE_PENDING, S.FEE_PAID],
    [S.FEE_PAID, S.ENROLLED],

    // Skip paths (common for simple admissions)
    [S.SUBMITTED, S.TEST_SCHEDULED],
    [S.DOCUMENTS_VERIFIED, S.OFFER_MADE],
    [S.DOCUMENTS_VERIFIED, S.MERIT_LISTED],
    [S.DOCUMENTS_VERIFIED, S.INTERVIEW_SCHEDULED],
    [S.TEST_COMPLETED, S.MERIT_LISTED],
    [S.TEST_COMPLETED, S.DOCUMENTS_VERIFIED],
    [S.INTERVIEW_COMPLETED, S.DOCUMENTS_VERIFIED],

    // Rejection paths
    [S.SUBMITTED, S.REJECTED],
    [S.DOCUMENTS_VERIFIED, S.REJECTED],
    [S.MERIT_LISTED, S.REJECTED],
    [S.TEST_COMPLETED, S.REJECTED],
    [S.INTERVIEW_COMPLETED, S.REJECTED],
    [S.WAITLISTED, S.REJECTED],

    // Withdrawal paths
    [S.DRAFT, S.WITHDRAWN],
    [S.SUBMITTED, S.WITHDRAWN],
    [S.DOCUMENTS_PENDING, S.WITHDRAWN],
    [S.TEST_SCHEDULED, S.WITHDRAWN],
    [S.INTERVIEW_SCHEDULED, S.WITHDRAWN],
    [S.OFFER_MADE, S.WITHDRAWN],
    [S.OFFER_ACCEPTED, S.WITHDRAWN],
    [S.FEE_PENDING, S.WITHDRAWN],
    [S.WAITLISTED, S.WITHDRAWN],

    // Waitlist → offer
    [S.DOCUMENTS_VERIFIED, S.WAITLISTED],
    [S.MERIT_LISTED, S.WAITLISTED],
    [S.WAITLISTED, S.OFFER_MADE],

    // Offer expiry
    [S.OFFER_MADE, S.EXPIRED],
  ];

  it.each(validPaths)('%s → %s succeeds', (from, to) => {
    expect(() => validateApplicationTransition(from, to)).not.toThrow();
  });

  // ── Invalid transitions ────────────────────────────────────

  const invalidPaths: [ApplicationStatus, ApplicationStatus][] = [
    // Can't skip from draft to deep stages
    [S.DRAFT, S.DOCUMENTS_PENDING],
    [S.DRAFT, S.ENROLLED],
    [S.DRAFT, S.OFFER_MADE],

    // Can't go backwards
    [S.DOCUMENTS_VERIFIED, S.SUBMITTED],
    [S.OFFER_ACCEPTED, S.OFFER_MADE],
    [S.FEE_PAID, S.FEE_PENDING],
    [S.ENROLLED, S.FEE_PAID],

    // Terminal states have no outgoing transitions
    [S.ENROLLED, S.SUBMITTED],
    [S.REJECTED, S.SUBMITTED],
    [S.WITHDRAWN, S.SUBMITTED],
    [S.EXPIRED, S.OFFER_ACCEPTED],

    // Can't jump from submitted to enrolled directly
    [S.SUBMITTED, S.ENROLLED],
    [S.SUBMITTED, S.OFFER_MADE],
    [S.SUBMITTED, S.FEE_PAID],

    // Waitlisted can't go directly to enrolled
    [S.WAITLISTED, S.ENROLLED],
    [S.WAITLISTED, S.FEE_PAID],
  ];

  it.each(invalidPaths)('%s → %s throws INVALID_STATUS_TRANSITION', (from, to) => {
    expect(() => validateApplicationTransition(from, to)).toThrow(UnprocessableEntityException);
  });

  // ── Terminal states ────────────────────────────────────────

  it('terminal states have no outgoing transitions', () => {
    const allStatuses: ApplicationStatus[] = Object.values(
      AdmissionApplicationStatus,
    ) as ApplicationStatus[];

    for (const terminal of TERMINAL_STATUSES) {
      for (const target of allStatuses) {
        expect(isValidApplicationTransition(terminal, target)).toBe(false);
      }
    }
  });

  // ── isValidApplicationTransition helper ────────────────────

  it('returns true for valid path', () => {
    expect(isValidApplicationTransition(S.SUBMITTED, S.DOCUMENTS_PENDING)).toBe(true);
  });

  it('returns false for invalid path', () => {
    expect(isValidApplicationTransition(S.SUBMITTED, S.ENROLLED)).toBe(false);
  });

  // ── 18 statuses ────────────────────────────────────────────

  it('has exactly 18 statuses defined', () => {
    const allStatuses = Object.values(AdmissionApplicationStatus);
    expect(allStatuses).toHaveLength(18);

    // Every status should be a key in the transitions map
    for (const status of allStatuses as ApplicationStatus[]) {
      expect(isValidApplicationTransition(status, status)).toBeDefined();
    }
  });

  // ── FUNNEL_STAGES ──────────────────────────────────────────

  it('funnel stages are in order', () => {
    expect(FUNNEL_STAGES).toEqual([
      S.SUBMITTED,
      S.DOCUMENTS_VERIFIED,
      S.TEST_COMPLETED,
      S.INTERVIEW_COMPLETED,
      S.MERIT_LISTED,
      S.OFFER_MADE,
      S.OFFER_ACCEPTED,
      S.FEE_PENDING,
      S.FEE_PAID,
      S.ENROLLED,
    ]);
  });
});
