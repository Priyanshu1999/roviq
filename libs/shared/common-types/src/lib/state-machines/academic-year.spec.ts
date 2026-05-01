import { describe, expect, it } from 'vitest';
import { BusinessException } from '../business-exception';
import { ACADEMIC_YEAR_STATUS_VALUES, type AcademicYearStatus } from '../enums/institute';
import { ErrorCode } from '../error-codes';
import { ACADEMIC_YEAR_STATE_MACHINE } from './academic-year';

describe('ACADEMIC_YEAR_STATE_MACHINE', () => {
  it('declares an entry for every AcademicYearStatus value', () => {
    const keys = Object.keys(ACADEMIC_YEAR_STATE_MACHINE.transitions);
    expect(keys.sort()).toEqual([...ACADEMIC_YEAR_STATUS_VALUES].sort());
  });

  it('every transition target is itself a valid AcademicYearStatus', () => {
    for (const targets of Object.values(ACADEMIC_YEAR_STATE_MACHINE.transitions)) {
      for (const target of targets as readonly AcademicYearStatus[]) {
        expect(ACADEMIC_YEAR_STATUS_VALUES).toContain(target);
      }
    }
  });

  it.each([
    ['PLANNING', 'ACTIVE'],
    ['ACTIVE', 'COMPLETING'],
    ['COMPLETING', 'ARCHIVED'],
  ] as Array<[AcademicYearStatus, AcademicYearStatus]>)('%s → %s is allowed', (from, to) => {
    expect(ACADEMIC_YEAR_STATE_MACHINE.canTransition(from, to)).toBe(true);
  });

  it.each([
    ['PLANNING', 'COMPLETING'],
    ['PLANNING', 'ARCHIVED'],
    ['ACTIVE', 'ARCHIVED'],
    ['ARCHIVED', 'PLANNING'],
    ['ARCHIVED', 'ACTIVE'],
  ] as Array<[AcademicYearStatus, AcademicYearStatus]>)('%s → %s is rejected', (from, to) => {
    expect(ACADEMIC_YEAR_STATE_MACHINE.canTransition(from, to)).toBe(false);
  });

  it('ARCHIVED is terminal', () => {
    for (const target of ACADEMIC_YEAR_STATUS_VALUES) {
      expect(ACADEMIC_YEAR_STATE_MACHINE.canTransition('ARCHIVED', target)).toBe(false);
    }
  });

  it('assertTransition throws BusinessException(INVALID_STATE_TRANSITION) on illegal transition', () => {
    let caught: unknown;
    try {
      ACADEMIC_YEAR_STATE_MACHINE.assertTransition('ARCHIVED', 'ACTIVE');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
  });
});
