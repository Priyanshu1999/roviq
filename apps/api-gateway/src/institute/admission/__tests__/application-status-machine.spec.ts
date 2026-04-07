import { UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  type ApplicationStatus,
  FUNNEL_STAGES,
  isValidApplicationTransition,
  TERMINAL_STATUSES,
  validateApplicationTransition,
} from '../application-status-machine';

describe('application-status-machine', () => {
  // ── Valid transitions ──────────────────────────────────────

  const validPaths: [ApplicationStatus, ApplicationStatus][] = [
    // Happy path: full admission pipeline
    ['draft', 'submitted'],
    ['submitted', 'documents_pending'],
    ['documents_pending', 'documents_verified'],
    ['documents_verified', 'test_scheduled'],
    ['test_scheduled', 'test_completed'],
    ['test_completed', 'interview_scheduled'],
    ['interview_scheduled', 'interview_completed'],
    ['interview_completed', 'merit_listed'],
    ['merit_listed', 'offer_made'],
    ['offer_made', 'offer_accepted'],
    ['offer_accepted', 'fee_pending'],
    ['fee_pending', 'fee_paid'],
    ['fee_paid', 'enrolled'],

    // Skip paths (common for simple admissions)
    ['submitted', 'test_scheduled'],
    ['documents_verified', 'offer_made'],
    ['documents_verified', 'merit_listed'],
    ['documents_verified', 'interview_scheduled'],
    ['test_completed', 'merit_listed'],
    ['test_completed', 'documents_verified'],
    ['interview_completed', 'documents_verified'],

    // Rejection paths
    ['submitted', 'rejected'],
    ['documents_verified', 'rejected'],
    ['merit_listed', 'rejected'],
    ['test_completed', 'rejected'],
    ['interview_completed', 'rejected'],
    ['waitlisted', 'rejected'],

    // Withdrawal paths
    ['draft', 'withdrawn'],
    ['submitted', 'withdrawn'],
    ['documents_pending', 'withdrawn'],
    ['test_scheduled', 'withdrawn'],
    ['interview_scheduled', 'withdrawn'],
    ['offer_made', 'withdrawn'],
    ['offer_accepted', 'withdrawn'],
    ['fee_pending', 'withdrawn'],
    ['waitlisted', 'withdrawn'],

    // Waitlist → offer
    ['documents_verified', 'waitlisted'],
    ['merit_listed', 'waitlisted'],
    ['waitlisted', 'offer_made'],

    // Offer expiry
    ['offer_made', 'expired'],
  ];

  it.each(validPaths)('%s → %s succeeds', (from, to) => {
    expect(() => validateApplicationTransition(from, to)).not.toThrow();
  });

  // ── Invalid transitions ────────────────────────────────────

  const invalidPaths: [ApplicationStatus, ApplicationStatus][] = [
    // Can't skip from draft to deep stages
    ['draft', 'documents_pending'],
    ['draft', 'enrolled'],
    ['draft', 'offer_made'],

    // Can't go backwards
    ['documents_verified', 'submitted'],
    ['offer_accepted', 'offer_made'],
    ['fee_paid', 'fee_pending'],
    ['enrolled', 'fee_paid'],

    // Terminal states have no outgoing transitions
    ['enrolled', 'submitted'],
    ['rejected', 'submitted'],
    ['withdrawn', 'submitted'],
    ['expired', 'offer_accepted'],

    // Can't jump from submitted to enrolled directly
    ['submitted', 'enrolled'],
    ['submitted', 'offer_made'],
    ['submitted', 'fee_paid'],

    // Waitlisted can't go directly to enrolled
    ['waitlisted', 'enrolled'],
    ['waitlisted', 'fee_paid'],
  ];

  it.each(invalidPaths)('%s → %s throws INVALID_STATUS_TRANSITION', (from, to) => {
    expect(() => validateApplicationTransition(from, to)).toThrow(UnprocessableEntityException);
  });

  // ── Terminal states ────────────────────────────────────────

  it('terminal states have no outgoing transitions', () => {
    const allStatuses: ApplicationStatus[] = [
      'draft',
      'submitted',
      'documents_pending',
      'documents_verified',
      'test_scheduled',
      'test_completed',
      'interview_scheduled',
      'interview_completed',
      'merit_listed',
      'offer_made',
      'offer_accepted',
      'fee_pending',
      'fee_paid',
      'enrolled',
      'waitlisted',
      'rejected',
      'withdrawn',
      'expired',
    ];

    for (const terminal of TERMINAL_STATUSES) {
      for (const target of allStatuses) {
        expect(isValidApplicationTransition(terminal, target)).toBe(false);
      }
    }
  });

  // ── isValidApplicationTransition helper ────────────────────

  it('returns true for valid path', () => {
    expect(isValidApplicationTransition('submitted', 'documents_pending')).toBe(true);
  });

  it('returns false for invalid path', () => {
    expect(isValidApplicationTransition('submitted', 'enrolled')).toBe(false);
  });

  // ── 18 statuses ────────────────────────────────────────────

  it('has exactly 18 statuses defined', () => {
    const allStatuses: ApplicationStatus[] = [
      'draft',
      'submitted',
      'documents_pending',
      'documents_verified',
      'test_scheduled',
      'test_completed',
      'interview_scheduled',
      'interview_completed',
      'merit_listed',
      'offer_made',
      'offer_accepted',
      'fee_pending',
      'fee_paid',
      'enrolled',
      'waitlisted',
      'rejected',
      'withdrawn',
      'expired',
    ];
    expect(allStatuses).toHaveLength(18);

    // Every status should be a key in the transitions map
    for (const status of allStatuses) {
      expect(isValidApplicationTransition(status, status)).toBeDefined();
    }
  });

  // ── FUNNEL_STAGES ──────────────────────────────────────────

  it('funnel stages are in order', () => {
    expect(FUNNEL_STAGES).toEqual([
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
    ]);
  });
});
