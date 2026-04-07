import { describe, expect, it } from 'vitest';
import { AuditMask, getAuditMaskedFields } from '../decorators/audit-mask.decorator';

describe('AuditMask decorator', () => {
  it('returns masked field names for a decorated class', () => {
    class TestInput {
      @AuditMask()
      password!: string;

      name!: string;
    }

    expect(getAuditMaskedFields(TestInput)).toEqual(['password']);
  });

  it('returns multiple masked fields', () => {
    class TestInput {
      @AuditMask()
      password!: string;

      @AuditMask()
      aadhaarNumber!: string;

      name!: string;
    }

    expect(getAuditMaskedFields(TestInput)).toEqual(['password', 'aadhaarNumber']);
  });

  it('returns empty array for undecorated class', () => {
    class PlainInput {
      name!: string;
    }

    expect(getAuditMaskedFields(PlainInput)).toEqual([]);
  });

  it('does not leak metadata between classes', () => {
    class InputA {
      @AuditMask()
      secret!: string;
    }

    class InputB {
      public!: string;
    }

    expect(getAuditMaskedFields(InputA)).toEqual(['secret']);
    expect(getAuditMaskedFields(InputB)).toEqual([]);
  });
});
