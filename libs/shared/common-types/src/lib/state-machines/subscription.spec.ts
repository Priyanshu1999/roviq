import { describe, expect, it } from 'vitest';
import { BusinessException } from '../business-exception';
import { SUBSCRIPTION_STATUS_VALUES, type SubscriptionStatus } from '../enums/billing';
import { ErrorCode } from '../error-codes';
import { SUBSCRIPTION_STATE_MACHINE } from './subscription';

describe('SUBSCRIPTION_STATE_MACHINE', () => {
  it('declares an entry for every SubscriptionStatus value', () => {
    expect(Object.keys(SUBSCRIPTION_STATE_MACHINE.transitions).sort()).toEqual(
      [...SUBSCRIPTION_STATUS_VALUES].sort(),
    );
  });

  it('every transition target is itself a valid SubscriptionStatus', () => {
    for (const targets of Object.values(SUBSCRIPTION_STATE_MACHINE.transitions)) {
      for (const target of targets as readonly SubscriptionStatus[]) {
        expect(SUBSCRIPTION_STATUS_VALUES).toContain(target);
      }
    }
  });

  it.each([
    ['TRIALING', 'ACTIVE'],
    ['ACTIVE', 'PAUSED'],
    ['ACTIVE', 'PAST_DUE'],
    ['ACTIVE', 'CANCELLED'],
    ['PAUSED', 'ACTIVE'],
    ['PAUSED', 'CANCELLED'],
    ['PAST_DUE', 'ACTIVE'],
    ['PAST_DUE', 'CANCELLED'],
  ] as Array<[SubscriptionStatus, SubscriptionStatus]>)('%s → %s is allowed', (from, to) => {
    expect(SUBSCRIPTION_STATE_MACHINE.canTransition(from, to)).toBe(true);
  });

  it.each([
    ['CANCELLED', 'ACTIVE'],
    ['EXPIRED', 'ACTIVE'],
    ['ACTIVE', 'EXPIRED'],
    ['PAUSED', 'PAST_DUE'],
    ['TRIALING', 'PAUSED'],
  ] as Array<[SubscriptionStatus, SubscriptionStatus]>)('%s → %s is rejected', (from, to) => {
    expect(SUBSCRIPTION_STATE_MACHINE.canTransition(from, to)).toBe(false);
  });

  it('CANCELLED and EXPIRED are terminal', () => {
    for (const target of SUBSCRIPTION_STATUS_VALUES) {
      expect(SUBSCRIPTION_STATE_MACHINE.canTransition('CANCELLED', target)).toBe(false);
      expect(SUBSCRIPTION_STATE_MACHINE.canTransition('EXPIRED', target)).toBe(false);
    }
  });

  it('assertTransition throws BusinessException(INVALID_STATE_TRANSITION) on illegal transition', () => {
    let caught: unknown;
    try {
      SUBSCRIPTION_STATE_MACHINE.assertTransition('CANCELLED', 'ACTIVE');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
  });
});
