import { describe, expect, it } from 'vitest';
import { BusinessException } from '../business-exception';
import { INVOICE_STATUS_VALUES, type InvoiceStatus } from '../enums/billing';
import { ErrorCode } from '../error-codes';
import { INVOICE_STATE_MACHINE } from './invoice';

describe('INVOICE_STATE_MACHINE', () => {
  it('declares an entry for every InvoiceStatus value', () => {
    expect(Object.keys(INVOICE_STATE_MACHINE.transitions).sort()).toEqual(
      [...INVOICE_STATUS_VALUES].sort(),
    );
  });

  it('every transition target is itself a valid InvoiceStatus', () => {
    for (const targets of Object.values(INVOICE_STATE_MACHINE.transitions)) {
      for (const target of targets as readonly InvoiceStatus[]) {
        expect(INVOICE_STATUS_VALUES).toContain(target);
      }
    }
  });

  it.each([
    ['DRAFT', 'SENT'],
    ['SENT', 'PAID'],
    ['SENT', 'PARTIALLY_PAID'],
    ['SENT', 'OVERDUE'],
    ['PARTIALLY_PAID', 'PAID'],
    ['PARTIALLY_PAID', 'REFUNDED'],
    ['OVERDUE', 'PAID'],
    ['PAID', 'REFUNDED'],
  ] as Array<[InvoiceStatus, InvoiceStatus]>)('%s → %s is allowed', (from, to) => {
    expect(INVOICE_STATE_MACHINE.canTransition(from, to)).toBe(true);
  });

  it.each([
    ['DRAFT', 'PAID'],
    ['REFUNDED', 'PAID'],
    ['CANCELLED', 'SENT'],
    ['PAID', 'OVERDUE'],
  ] as Array<[InvoiceStatus, InvoiceStatus]>)('%s → %s is rejected', (from, to) => {
    expect(INVOICE_STATE_MACHINE.canTransition(from, to)).toBe(false);
  });

  it('REFUNDED and CANCELLED are terminal', () => {
    for (const target of INVOICE_STATUS_VALUES) {
      expect(INVOICE_STATE_MACHINE.canTransition('REFUNDED', target)).toBe(false);
      expect(INVOICE_STATE_MACHINE.canTransition('CANCELLED', target)).toBe(false);
    }
  });

  it('assertTransition throws BusinessException(INVALID_STATE_TRANSITION) on illegal transition', () => {
    let caught: unknown;
    try {
      INVOICE_STATE_MACHINE.assertTransition('REFUNDED', 'PAID');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
  });
});
