import { UnprocessableEntityException } from '@nestjs/common';
import { AcademicStatus } from '@roviq/common-types';
import { describe, expect, it } from 'vitest';
import { isValidTransition, validateStatusTransition } from '../student-status-machine';

const S = AcademicStatus;

describe('student-status-machine', () => {
  // ── Valid transitions ─────────────────────────────────────

  const validPaths: [AcademicStatus, AcademicStatus][] = [
    [S.ENROLLED, S.PROMOTED],
    [S.ENROLLED, S.DETAINED],
    [S.ENROLLED, S.GRADUATED],
    [S.ENROLLED, S.DROPPED_OUT],
    [S.ENROLLED, S.WITHDRAWN],
    [S.ENROLLED, S.SUSPENDED],
    [S.ENROLLED, S.EXPELLED],
    [S.PROMOTED, S.ENROLLED],
    [S.DETAINED, S.ENROLLED],
    [S.SUSPENDED, S.ENROLLED],
    [S.SUSPENDED, S.EXPELLED],
    [S.WITHDRAWN, S.RE_ENROLLED],
    [S.DROPPED_OUT, S.RE_ENROLLED],
    [S.RE_ENROLLED, S.ENROLLED],
    [S.GRADUATED, S.PASSOUT],
  ];

  it.each(validPaths)('%s → %s succeeds', (from, to) => {
    expect(() => validateStatusTransition(from, to)).not.toThrow();
  });

  // ── transferred_out requires tcIssued ─────────────────────

  it('enrolled → transferred_out succeeds with tcIssued=true', () => {
    expect(() =>
      validateStatusTransition(S.ENROLLED, S.TRANSFERRED_OUT, { tcIssued: true }),
    ).not.toThrow();
  });

  it('enrolled → transferred_out fails without tcIssued', () => {
    expect(() =>
      validateStatusTransition(S.ENROLLED, S.TRANSFERRED_OUT, { tcIssued: false }),
    ).toThrow(UnprocessableEntityException);
  });

  it('enrolled → transferred_out fails when tcIssued omitted', () => {
    expect(() => validateStatusTransition(S.ENROLLED, S.TRANSFERRED_OUT)).toThrow(
      UnprocessableEntityException,
    );
  });

  // ── Invalid transitions ───────────────────────────────────

  const invalidPaths: [AcademicStatus, AcademicStatus][] = [
    [S.ENROLLED, S.PASSOUT],
    [S.ENROLLED, S.RE_ENROLLED],
    [S.PROMOTED, S.GRADUATED],
    [S.DETAINED, S.PROMOTED],
    [S.TRANSFERRED_OUT, S.ENROLLED],
    [S.EXPELLED, S.ENROLLED],
    [S.PASSOUT, S.ENROLLED],
    [S.GRADUATED, S.ENROLLED],
    [S.WITHDRAWN, S.ENROLLED],
    [S.DROPPED_OUT, S.ENROLLED],
  ];

  it.each(invalidPaths)('%s → %s throws INVALID_STATUS_TRANSITION', (from, to) => {
    expect(() => validateStatusTransition(from, to)).toThrow(UnprocessableEntityException);
  });

  // ── Terminal states have no outgoing transitions ──────────

  const terminalStates: AcademicStatus[] = [S.TRANSFERRED_OUT, S.EXPELLED, S.PASSOUT];

  it.each(terminalStates)('%s is terminal (no valid transitions)', (status) => {
    const allStatuses: AcademicStatus[] = Object.values(AcademicStatus) as AcademicStatus[];

    for (const target of allStatuses) {
      expect(isValidTransition(status, target)).toBe(false);
    }
  });

  // ── isValidTransition helper ──────────────────────────────

  it('isValidTransition returns true for valid path', () => {
    expect(isValidTransition(S.ENROLLED, S.PROMOTED)).toBe(true);
  });

  it('isValidTransition returns false for invalid path', () => {
    expect(isValidTransition(S.ENROLLED, S.PASSOUT)).toBe(false);
  });
});
