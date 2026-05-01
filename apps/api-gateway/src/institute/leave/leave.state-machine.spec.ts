import {
  BusinessException,
  ErrorCode,
  LEAVE_STATUS_VALUES,
  type LeaveStatus,
} from '@roviq/common-types';
import { describe, expect, it } from 'vitest';
import { LEAVE_STATE_MACHINE } from './leave.state-machine';

describe('LEAVE_STATE_MACHINE', () => {
  it('declares an entry for every LeaveStatus value', () => {
    const keys = Object.keys(LEAVE_STATE_MACHINE.transitions);
    expect(keys.sort()).toEqual([...LEAVE_STATUS_VALUES].sort());
  });

  it.each([
    ['PENDING', 'APPROVED'],
    ['PENDING', 'REJECTED'],
    ['PENDING', 'CANCELLED'],
    ['APPROVED', 'CANCELLED'],
  ] as Array<[LeaveStatus, LeaveStatus]>)('%s → %s is allowed', (from, to) => {
    expect(LEAVE_STATE_MACHINE.canTransition(from, to)).toBe(true);
  });

  it.each([
    ['APPROVED', 'PENDING'],
    ['APPROVED', 'REJECTED'],
    ['REJECTED', 'APPROVED'],
    ['CANCELLED', 'APPROVED'],
  ] as Array<[LeaveStatus, LeaveStatus]>)('%s → %s is rejected', (from, to) => {
    expect(LEAVE_STATE_MACHINE.canTransition(from, to)).toBe(false);
  });

  it('REJECTED and CANCELLED are terminal', () => {
    for (const target of LEAVE_STATUS_VALUES) {
      expect(LEAVE_STATE_MACHINE.canTransition('REJECTED', target)).toBe(false);
      expect(LEAVE_STATE_MACHINE.canTransition('CANCELLED', target)).toBe(false);
    }
  });

  it('assertTransition throws BusinessException on illegal transition', () => {
    let caught: unknown;
    try {
      LEAVE_STATE_MACHINE.assertTransition('REJECTED', 'APPROVED');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
  });
});
