// Compile-time test that EventPayload<P> resolves to the specific schema's
// inferred type, NOT `any`. This locks in the ROV-256 H1 fix — if someone
// re-adds the `Record<string, z.ZodTypeAny>` annotation on flatEventSchemas
// (collapsing every type back to `any`), the @ts-expect-error blocks below
// stop firing and the test fails to compile.

import { describe, it } from 'vitest';
import type { EventPayload } from '../event-schemas';

describe('EventPayload<P> type lookup (compile-time only)', () => {
  it('STUDENT.promoted resolves to the specific schema shape', () => {
    type T = EventPayload<'STUDENT.promoted'>;
    // Valid shape compiles.
    const ok: T = { studentProfileId: 'a', tenantId: 'b' };
    void ok;

    // @ts-expect-error — missing tenantId
    const missingField: T = { studentProfileId: 'a' };
    void missingField;

    // @ts-expect-error — wrong field types
    const wrongTypes: T = { studentProfileId: 1, tenantId: 2 };
    void wrongTypes;
  });

  it('LEAVE.approved requires every field in its strict schema', () => {
    type T = EventPayload<'LEAVE.approved'>;
    const ok: T = {
      leaveId: 'a',
      tenantId: 'b',
      userId: 'c',
      approverMembershipId: 'd',
    };
    void ok;

    // @ts-expect-error — missing approverMembershipId
    const incomplete: T = { leaveId: 'a', tenantId: 'b', userId: 'c' };
    void incomplete;
  });

  it('passthrough schemas allow extra keys but require base fields', () => {
    type T = EventPayload<'STUDENT.updated'>;
    // tenantBase.passthrough() — tenantId is required, anything else allowed.
    const ok: T = { tenantId: 'a', someExtra: 'value', another: 42 };
    void ok;

    // @ts-expect-error — missing required tenantId
    const missingTenant: T = { someExtra: 'value' };
    void missingTenant;
  });
});
