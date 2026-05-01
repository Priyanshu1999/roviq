import { describe, expect, it } from 'vitest';
import { BusinessException } from '../business-exception';
import { ACADEMIC_STATUS_VALUES, type AcademicStatus } from '../enums/user-profile';
import { ErrorCode } from '../error-codes';
import { STUDENT_ACADEMIC_STATE_MACHINE } from './student-academic';

describe('STUDENT_ACADEMIC_STATE_MACHINE', () => {
  it('declares an entry for every AcademicStatus value', () => {
    const keys = Object.keys(STUDENT_ACADEMIC_STATE_MACHINE.transitions);
    expect(keys.sort()).toEqual([...ACADEMIC_STATUS_VALUES].sort());
  });

  it('every transition target is itself a valid AcademicStatus', () => {
    for (const targets of Object.values(STUDENT_ACADEMIC_STATE_MACHINE.transitions)) {
      for (const target of targets as readonly AcademicStatus[]) {
        expect(ACADEMIC_STATUS_VALUES).toContain(target);
      }
    }
  });

  it.each([
    ['ENROLLED', 'PROMOTED'],
    ['ENROLLED', 'DETAINED'],
    ['ENROLLED', 'GRADUATED'],
    ['ENROLLED', 'TRANSFERRED_OUT'],
    ['PROMOTED', 'ENROLLED'],
    ['DETAINED', 'ENROLLED'],
    ['SUSPENDED', 'ENROLLED'],
    ['SUSPENDED', 'EXPELLED'],
    ['WITHDRAWN', 'RE_ENROLLED'],
    ['DROPPED_OUT', 'RE_ENROLLED'],
    ['RE_ENROLLED', 'ENROLLED'],
    ['GRADUATED', 'PASSOUT'],
  ] as Array<[AcademicStatus, AcademicStatus]>)('%s → %s is allowed', (from, to) => {
    expect(STUDENT_ACADEMIC_STATE_MACHINE.canTransition(from, to)).toBe(true);
  });

  it.each([
    ['ENROLLED', 'PASSOUT'],
    ['ENROLLED', 'RE_ENROLLED'],
    ['PROMOTED', 'GRADUATED'],
    ['TRANSFERRED_OUT', 'ENROLLED'],
    ['EXPELLED', 'ENROLLED'],
    ['PASSOUT', 'ENROLLED'],
  ] as Array<[AcademicStatus, AcademicStatus]>)('%s → %s is rejected', (from, to) => {
    expect(STUDENT_ACADEMIC_STATE_MACHINE.canTransition(from, to)).toBe(false);
  });

  it('TRANSFERRED_OUT, EXPELLED, PASSOUT are terminal', () => {
    for (const terminal of ['TRANSFERRED_OUT', 'EXPELLED', 'PASSOUT'] as AcademicStatus[]) {
      for (const target of ACADEMIC_STATUS_VALUES) {
        expect(STUDENT_ACADEMIC_STATE_MACHINE.canTransition(terminal, target)).toBe(false);
      }
    }
  });

  it('assertTransition throws BusinessException on illegal transition', () => {
    let caught: unknown;
    try {
      STUDENT_ACADEMIC_STATE_MACHINE.assertTransition('PASSOUT', 'ENROLLED');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
  });
});
