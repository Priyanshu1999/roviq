import { describe, expect, it } from 'vitest';
import { BusinessException } from '../business-exception';
import { TC_STATUS_VALUES, type TcStatus } from '../enums/admission';
import { ErrorCode } from '../error-codes';
import { TC_STATE_MACHINE } from './tc';

describe('TC_STATE_MACHINE', () => {
  it('declares an entry for every TcStatus value', () => {
    expect(Object.keys(TC_STATE_MACHINE.transitions).sort()).toEqual([...TC_STATUS_VALUES].sort());
  });

  it('every transition target is itself a valid TcStatus', () => {
    for (const targets of Object.values(TC_STATE_MACHINE.transitions)) {
      for (const target of targets as readonly TcStatus[]) {
        expect(TC_STATUS_VALUES).toContain(target);
      }
    }
  });

  it.each([
    ['REQUESTED', 'CLEARANCE_PENDING'],
    ['CLEARANCE_PENDING', 'CLEARANCE_COMPLETE'],
    ['CLEARANCE_COMPLETE', 'GENERATED'],
    ['GENERATED', 'APPROVED'],
    ['REVIEW_PENDING', 'APPROVED'],
    ['APPROVED', 'ISSUED'],
    ['ISSUED', 'DUPLICATE_REQUESTED'],
    ['DUPLICATE_REQUESTED', 'DUPLICATE_ISSUED'],
    ['REQUESTED', 'CANCELLED'],
    ['CLEARANCE_PENDING', 'CANCELLED'],
  ] as Array<[TcStatus, TcStatus]>)('%s → %s is allowed', (from, to) => {
    expect(TC_STATE_MACHINE.canTransition(from, to)).toBe(true);
  });

  it.each([
    ['REQUESTED', 'GENERATED'],
    ['GENERATED', 'ISSUED'],
    ['ISSUED', 'CANCELLED'],
    ['ISSUED', 'APPROVED'],
    ['CANCELLED', 'REQUESTED'],
    ['DUPLICATE_ISSUED', 'ISSUED'],
  ] as Array<[TcStatus, TcStatus]>)('%s → %s is rejected', (from, to) => {
    expect(TC_STATE_MACHINE.canTransition(from, to)).toBe(false);
  });

  it('DUPLICATE_ISSUED and CANCELLED are terminal', () => {
    for (const target of TC_STATUS_VALUES) {
      expect(TC_STATE_MACHINE.canTransition('DUPLICATE_ISSUED', target)).toBe(false);
      expect(TC_STATE_MACHINE.canTransition('CANCELLED', target)).toBe(false);
    }
  });

  it('assertTransition throws BusinessException(INVALID_STATE_TRANSITION) on illegal transition', () => {
    let caught: unknown;
    try {
      TC_STATE_MACHINE.assertTransition('CANCELLED', 'REQUESTED');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
  });
});
