import {
  BusinessException,
  ErrorCode,
  INSTITUTE_STATUS_VALUES,
  type InstituteStatus,
} from '@roviq/common-types';
import { describe, expect, it } from 'vitest';
import { INSTITUTE_STATE_MACHINE } from './institute.state-machine';

describe('INSTITUTE_STATE_MACHINE', () => {
  it('declares an entry for every InstituteStatus value', () => {
    const keys = Object.keys(INSTITUTE_STATE_MACHINE.transitions);
    expect(keys.sort()).toEqual([...INSTITUTE_STATUS_VALUES].sort());
  });

  it('every transition target is itself a valid InstituteStatus', () => {
    for (const targets of Object.values(INSTITUTE_STATE_MACHINE.transitions)) {
      for (const target of targets as readonly InstituteStatus[]) {
        expect(INSTITUTE_STATUS_VALUES).toContain(target);
      }
    }
  });

  // Bug-fix lock: prior to this state machine, PENDING_APPROVAL had no entry,
  // so platform admins could not approve a freshly-registered institute.
  it('PENDING_APPROVAL → PENDING is allowed (platform approval path)', () => {
    expect(INSTITUTE_STATE_MACHINE.canTransition('PENDING_APPROVAL', 'PENDING')).toBe(true);
  });

  it('PENDING_APPROVAL → REJECTED is allowed', () => {
    expect(INSTITUTE_STATE_MACHINE.canTransition('PENDING_APPROVAL', 'REJECTED')).toBe(true);
  });

  it.each([
    ['PENDING', 'ACTIVE'],
    ['ACTIVE', 'SUSPENDED'],
    ['ACTIVE', 'INACTIVE'],
    ['INACTIVE', 'ACTIVE'],
    ['SUSPENDED', 'ACTIVE'],
  ] as Array<[InstituteStatus, InstituteStatus]>)('%s → %s is allowed', (from, to) => {
    expect(INSTITUTE_STATE_MACHINE.canTransition(from, to)).toBe(true);
  });

  it.each([
    ['PENDING_APPROVAL', 'ACTIVE'],
    ['ACTIVE', 'PENDING'],
    ['REJECTED', 'ACTIVE'],
    ['INACTIVE', 'SUSPENDED'],
  ] as Array<[InstituteStatus, InstituteStatus]>)('%s → %s is rejected', (from, to) => {
    expect(INSTITUTE_STATE_MACHINE.canTransition(from, to)).toBe(false);
  });

  it('assertTransition throws BusinessException on illegal transition', () => {
    let caught: unknown;
    try {
      INSTITUTE_STATE_MACHINE.assertTransition('REJECTED', 'ACTIVE');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
  });

  it('REJECTED is terminal', () => {
    for (const target of INSTITUTE_STATUS_VALUES) {
      expect(INSTITUTE_STATE_MACHINE.canTransition('REJECTED', target)).toBe(false);
    }
  });
});
