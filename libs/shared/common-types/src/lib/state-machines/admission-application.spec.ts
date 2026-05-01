import { describe, expect, it } from 'vitest';
import { BusinessException } from '../business-exception';
import {
  ADMISSION_APPLICATION_STATUS_VALUES,
  AdmissionApplicationStatus,
} from '../enums/admission';
import { ErrorCode } from '../error-codes';
import {
  ADMISSION_APPLICATION_STATE_MACHINE,
  FUNNEL_STAGES,
  TERMINAL_STATUSES,
} from './admission-application';

const S = AdmissionApplicationStatus;

describe('ADMISSION_APPLICATION_STATE_MACHINE', () => {
  it('declares an entry for every AdmissionApplicationStatus value', () => {
    const keys = Object.keys(ADMISSION_APPLICATION_STATE_MACHINE.transitions);
    expect(keys.sort()).toEqual([...ADMISSION_APPLICATION_STATUS_VALUES].sort());
  });

  it('every transition target is itself a valid AdmissionApplicationStatus', () => {
    for (const targets of Object.values(ADMISSION_APPLICATION_STATE_MACHINE.transitions)) {
      for (const target of targets as readonly AdmissionApplicationStatus[]) {
        expect(ADMISSION_APPLICATION_STATUS_VALUES).toContain(target);
      }
    }
  });

  it.each([
    [S.DRAFT, S.SUBMITTED],
    [S.SUBMITTED, S.DOCUMENTS_PENDING],
    [S.DOCUMENTS_PENDING, S.DOCUMENTS_VERIFIED],
    [S.DOCUMENTS_VERIFIED, S.TEST_SCHEDULED],
    [S.TEST_SCHEDULED, S.TEST_COMPLETED],
    [S.TEST_COMPLETED, S.INTERVIEW_SCHEDULED],
    [S.MERIT_LISTED, S.OFFER_MADE],
    [S.OFFER_MADE, S.OFFER_ACCEPTED],
    [S.FEE_PAID, S.ENROLLED],
    [S.WAITLISTED, S.OFFER_MADE],
    [S.OFFER_MADE, S.EXPIRED],
  ] as Array<
    [AdmissionApplicationStatus, AdmissionApplicationStatus]
  >)('%s → %s is allowed', (from, to) => {
    expect(ADMISSION_APPLICATION_STATE_MACHINE.canTransition(from, to)).toBe(true);
  });

  it.each([
    [S.DRAFT, S.ENROLLED],
    [S.SUBMITTED, S.ENROLLED],
    [S.OFFER_ACCEPTED, S.OFFER_MADE],
    [S.FEE_PAID, S.FEE_PENDING],
    [S.ENROLLED, S.SUBMITTED],
    [S.REJECTED, S.SUBMITTED],
    [S.WITHDRAWN, S.SUBMITTED],
    [S.EXPIRED, S.OFFER_ACCEPTED],
    [S.WAITLISTED, S.ENROLLED],
  ] as Array<
    [AdmissionApplicationStatus, AdmissionApplicationStatus]
  >)('%s → %s is rejected', (from, to) => {
    expect(ADMISSION_APPLICATION_STATE_MACHINE.canTransition(from, to)).toBe(false);
  });

  it('terminal statuses have no outgoing transitions', () => {
    for (const terminal of TERMINAL_STATUSES) {
      for (const target of ADMISSION_APPLICATION_STATUS_VALUES) {
        expect(ADMISSION_APPLICATION_STATE_MACHINE.canTransition(terminal, target)).toBe(false);
      }
    }
  });

  it('TERMINAL_STATUSES contains the four lifecycle endpoints', () => {
    expect(TERMINAL_STATUSES).toEqual(new Set([S.ENROLLED, S.REJECTED, S.WITHDRAWN, S.EXPIRED]));
  });

  it('FUNNEL_STAGES are in pipeline order', () => {
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

  it('assertTransition throws BusinessException on illegal transition', () => {
    let caught: unknown;
    try {
      ADMISSION_APPLICATION_STATE_MACHINE.assertTransition(S.ENROLLED, S.SUBMITTED);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
  });
});
