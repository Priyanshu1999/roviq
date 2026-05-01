import { describe, expect, it } from 'vitest';
import { BusinessException } from './business-exception';
import { ErrorCode } from './error-codes';
import { defineStateMachine } from './state-machine';

type Status = 'OPEN' | 'CLOSED' | 'ARCHIVED';

const machine = defineStateMachine<Status>('Sample', {
  OPEN: ['CLOSED'],
  CLOSED: ['OPEN', 'ARCHIVED'],
  ARCHIVED: [],
});

describe('defineStateMachine', () => {
  describe('canTransition', () => {
    it('returns true for an allowed transition', () => {
      expect(machine.canTransition('OPEN', 'CLOSED')).toBe(true);
      expect(machine.canTransition('CLOSED', 'ARCHIVED')).toBe(true);
    });

    it('returns false for a disallowed transition', () => {
      expect(machine.canTransition('OPEN', 'ARCHIVED')).toBe(false);
      expect(machine.canTransition('ARCHIVED', 'OPEN')).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('does not throw on an allowed transition', () => {
      expect(() => machine.assertTransition('OPEN', 'CLOSED')).not.toThrow();
    });

    it('throws BusinessException with INVALID_STATE_TRANSITION code', () => {
      let caught: unknown;
      try {
        machine.assertTransition('OPEN', 'ARCHIVED');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(BusinessException);
      expect((caught as BusinessException).code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
    });

    it('error message includes the machine name, from, and to states', () => {
      expect(() => machine.assertTransition('OPEN', 'ARCHIVED')).toThrow(/Sample.*OPEN.*ARCHIVED/);
    });

    it('error message says "none (terminal)" when source has no allowed targets', () => {
      expect(() => machine.assertTransition('ARCHIVED', 'OPEN')).toThrow(/none \(terminal\)/);
    });
  });

  it('exposes the original transition map and machine name', () => {
    expect(machine.name).toBe('Sample');
    expect(machine.transitions.OPEN).toEqual(['CLOSED']);
  });
});
