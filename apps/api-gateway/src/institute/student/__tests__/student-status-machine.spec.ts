import { UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  type AcademicStatus,
  isValidTransition,
  validateStatusTransition,
} from '../student-status-machine';

describe('student-status-machine', () => {
  // ── Valid transitions ─────────────────────────────────────

  const validPaths: [AcademicStatus, AcademicStatus][] = [
    ['enrolled', 'promoted'],
    ['enrolled', 'detained'],
    ['enrolled', 'graduated'],
    ['enrolled', 'dropped_out'],
    ['enrolled', 'withdrawn'],
    ['enrolled', 'suspended'],
    ['enrolled', 'expelled'],
    ['promoted', 'enrolled'],
    ['detained', 'enrolled'],
    ['suspended', 'enrolled'],
    ['suspended', 'expelled'],
    ['withdrawn', 're_enrolled'],
    ['dropped_out', 're_enrolled'],
    ['re_enrolled', 'enrolled'],
    ['graduated', 'passout'],
  ];

  it.each(validPaths)('%s → %s succeeds', (from, to) => {
    expect(() => validateStatusTransition(from, to)).not.toThrow();
  });

  // ── transferred_out requires tcIssued ─────────────────────

  it('enrolled → transferred_out succeeds with tcIssued=true', () => {
    expect(() =>
      validateStatusTransition('enrolled', 'transferred_out', { tcIssued: true }),
    ).not.toThrow();
  });

  it('enrolled → transferred_out fails without tcIssued', () => {
    expect(() =>
      validateStatusTransition('enrolled', 'transferred_out', { tcIssued: false }),
    ).toThrow(UnprocessableEntityException);
  });

  it('enrolled → transferred_out fails when tcIssued omitted', () => {
    expect(() => validateStatusTransition('enrolled', 'transferred_out')).toThrow(
      UnprocessableEntityException,
    );
  });

  // ── Invalid transitions ───────────────────────────────────

  const invalidPaths: [AcademicStatus, AcademicStatus][] = [
    ['enrolled', 'passout'],
    ['enrolled', 're_enrolled'],
    ['promoted', 'graduated'],
    ['detained', 'promoted'],
    ['transferred_out', 'enrolled'],
    ['expelled', 'enrolled'],
    ['passout', 'enrolled'],
    ['graduated', 'enrolled'],
    ['withdrawn', 'enrolled'],
    ['dropped_out', 'enrolled'],
  ];

  it.each(invalidPaths)('%s → %s throws INVALID_STATUS_TRANSITION', (from, to) => {
    expect(() => validateStatusTransition(from, to)).toThrow(UnprocessableEntityException);
  });

  // ── Terminal states have no outgoing transitions ──────────

  const terminalStates: AcademicStatus[] = ['transferred_out', 'expelled', 'passout'];

  it.each(terminalStates)('%s is terminal (no valid transitions)', (status) => {
    const allStatuses: AcademicStatus[] = [
      'enrolled',
      'promoted',
      'detained',
      'graduated',
      'transferred_out',
      'dropped_out',
      'withdrawn',
      'suspended',
      'expelled',
      're_enrolled',
      'passout',
    ];

    for (const target of allStatuses) {
      expect(isValidTransition(status, target)).toBe(false);
    }
  });

  // ── isValidTransition helper ──────────────────────────────

  it('isValidTransition returns true for valid path', () => {
    expect(isValidTransition('enrolled', 'promoted')).toBe(true);
  });

  it('isValidTransition returns false for invalid path', () => {
    expect(isValidTransition('enrolled', 'passout')).toBe(false);
  });
});
