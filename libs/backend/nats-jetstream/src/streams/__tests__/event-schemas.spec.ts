import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { flattenEventPatterns } from '../event-patterns';
import { _DOMAIN_SCHEMA_MAPS, flatEventSchemas } from '../event-schemas';

/**
 * Test-local replacement for the previously-exported `getMissingSchemaPatterns`
 * helper — moved out of production code per the ROV-256 review (M5).
 */
function getMissingSchemaPatterns(): string[] {
  const allPatterns = flattenEventPatterns();
  return allPatterns.filter((p) => !(p in flatEventSchemas));
}

// Valid v4 UUIDs (variant bits 8-b in group 4) for use across tests.
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333333';
const U4 = '44444444-4444-4444-8444-444444444444';
const U5 = '55555555-5555-4555-8555-555555555555';

describe('flatEventSchemas', () => {
  it('covers every EVENT_PATTERNS leaf', () => {
    const missing = getMissingSchemaPatterns();
    expect(missing).toEqual([]);
  });

  describe('STUDENT schemas', () => {
    it('STUDENT.admitted accepts a valid payload', () => {
      expect(() =>
        flatEventSchemas['STUDENT.admitted'].parse({
          studentProfileId: U1,
          membershipId: U2,
          standardId: U3,
          sectionId: U4,
          tenantId: U5,
        }),
      ).not.toThrow();
    });

    it('STUDENT.admitted rejects when studentProfileId is missing', () => {
      expect(() =>
        flatEventSchemas['STUDENT.admitted'].parse({
          membershipId: U2,
          standardId: U3,
          sectionId: U4,
          tenantId: U5,
        }),
      ).toThrow(ZodError);
    });

    it('STUDENT.statusChanged accepts a valid payload with null reason', () => {
      expect(() =>
        flatEventSchemas['STUDENT.statusChanged'].parse({
          studentProfileId: U1,
          fromStatus: 'ENROLLED',
          toStatus: 'TRANSFERRED_OUT',
          reason: null,
          tenantId: U5,
        }),
      ).not.toThrow();
    });

    it('STUDENT.left rejects when tcNumber is absent entirely', () => {
      expect(() =>
        flatEventSchemas['STUDENT.left'].parse({
          studentProfileId: U1,
          reason: 'TRANSFERRED_OUT',
          tenantId: U5,
          // tcNumber deliberately omitted — schema requires it (nullable, not optional)
        }),
      ).toThrow(ZodError);
    });
  });

  describe('LEAVE schemas', () => {
    it('LEAVE.approved accepts a valid payload', () => {
      expect(() =>
        flatEventSchemas['LEAVE.approved'].parse({
          leaveId: U1,
          tenantId: U2,
          userId: U3,
          approverMembershipId: U4,
        }),
      ).not.toThrow();
    });

    it('LEAVE.approved rejects when approverMembershipId is missing', () => {
      expect(() =>
        flatEventSchemas['LEAVE.approved'].parse({
          leaveId: U1,
          tenantId: U2,
          userId: U3,
        }),
      ).toThrow(ZodError);
    });
  });

  describe('APPLICATION schemas', () => {
    it('APPLICATION.status_changed accepts a valid payload', () => {
      expect(() =>
        flatEventSchemas['APPLICATION.status_changed'].parse({
          applicationId: U1,
          oldStatus: 'PENDING',
          newStatus: 'APPROVED',
          tenantId: U2,
        }),
      ).not.toThrow();
    });
  });

  describe('ACADEMIC_YEAR schemas', () => {
    it('ACADEMIC_YEAR.activated accepts previousYearId as null', () => {
      expect(() =>
        flatEventSchemas['ACADEMIC_YEAR.activated'].parse({
          academicYearId: U1,
          tenantId: U2,
          previousYearId: null,
        }),
      ).not.toThrow();
    });

    it('ACADEMIC_YEAR.activated rejects when academicYearId is not a uuid', () => {
      expect(() =>
        flatEventSchemas['ACADEMIC_YEAR.activated'].parse({
          academicYearId: 'not-a-uuid',
          tenantId: U2,
          previousYearId: null,
        }),
      ).toThrow(ZodError);
    });
  });

  describe('BILLING schemas', () => {
    it('BILLING.subscription.created accepts a valid payload', () => {
      expect(() =>
        flatEventSchemas['BILLING.subscription.created'].parse({
          subscriptionId: U1,
          tenantId: U2,
        }),
      ).not.toThrow();
    });

    it('BILLING.plan.created accepts a valid payload', () => {
      expect(() =>
        flatEventSchemas['BILLING.plan.created'].parse({
          id: U1,
          name: { en: 'Basic Plan' },
        }),
      ).not.toThrow();
    });
  });

  describe('NOTIFICATION schemas', () => {
    it('NOTIFICATION.leave.decided accepts a valid payload', () => {
      expect(() =>
        flatEventSchemas['NOTIFICATION.leave.decided'].parse({
          leaveId: U1,
          tenantId: U2,
          userId: U3,
          status: 'APPROVED',
        }),
      ).not.toThrow();
    });
  });

  describe('permissive baseline (tenantId enforcement)', () => {
    it('BOT.created rejects when tenantId is missing', () => {
      expect(() => flatEventSchemas['BOT.created'].parse({ name: 'my-bot' })).toThrow(ZodError);
    });

    it('BOT.created accepts extra fields via passthrough', () => {
      expect(() =>
        flatEventSchemas['BOT.created'].parse({
          tenantId: U1,
          name: 'my-bot',
          extra: true,
        }),
      ).not.toThrow();
    });
  });

  it('all EVENT_PATTERNS leaves are in flatEventSchemas', () => {
    const allPatterns = flattenEventPatterns();
    for (const pattern of allPatterns) {
      expect(flatEventSchemas, `missing schema for ${pattern}`).toHaveProperty(pattern);
    }
  });

  it('flatEventSchemas has no duplicate keys across domain spreads', () => {
    // Sum of constituent map sizes must equal the merged map's key count.
    // A mismatch means two domain maps emitted the same EVENT_PATTERNS key
    // and the later spread silently overwrote the earlier — would
    // otherwise be a silent registry-coverage bug.
    const sumOfDomainKeys = _DOMAIN_SCHEMA_MAPS.reduce(
      (acc, map) => acc + Object.keys(map).length,
      0,
    );
    const flatKeys = Object.keys(flatEventSchemas).length;

    if (sumOfDomainKeys !== flatKeys) {
      const seen = new Map<string, number>();
      for (const map of _DOMAIN_SCHEMA_MAPS) {
        for (const key of Object.keys(map)) {
          seen.set(key, (seen.get(key) ?? 0) + 1);
        }
      }
      const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
      expect.fail(
        `Duplicate keys detected in domain schema spreads: ${duplicates.join(', ')}. ` +
          `Sum of domain keys = ${sumOfDomainKeys}, merged keys = ${flatKeys}.`,
      );
    }
    expect(sumOfDomainKeys).toBe(flatKeys);
  });
});
