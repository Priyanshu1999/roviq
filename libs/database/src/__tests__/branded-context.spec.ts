// Compile-time + runtime invariant lock for the branded RequestContext.
// Asserts each DB wrapper accepts ONLY its matching branded context, and
// rejects every other variant. Uses Vitest's `expectTypeOf` so the
// invariant is bound to the type signatures themselves — refactors that
// move lines around (a known weakness of `// @ts-expect-error` markers)
// can't silently invalidate the lock.

import type { InstituteContext, PlatformContext, ResellerContext } from '@roviq/common-types';
import { describe, expectTypeOf, it } from 'vitest';
import type { withAdmin, withReseller, withTenant } from '../tenant-db';

describe('Branded RequestContext — wrapper signature invariants', () => {
  it('withTenant accepts only InstituteContext', () => {
    expectTypeOf<Parameters<typeof withTenant>[1]>().toEqualTypeOf<InstituteContext>();
    expectTypeOf<Parameters<typeof withTenant>[1]>().not.toEqualTypeOf<PlatformContext>();
    expectTypeOf<Parameters<typeof withTenant>[1]>().not.toEqualTypeOf<ResellerContext>();
  });

  it('withReseller accepts only ResellerContext', () => {
    expectTypeOf<Parameters<typeof withReseller>[1]>().toEqualTypeOf<ResellerContext>();
    expectTypeOf<Parameters<typeof withReseller>[1]>().not.toEqualTypeOf<PlatformContext>();
    expectTypeOf<Parameters<typeof withReseller>[1]>().not.toEqualTypeOf<InstituteContext>();
  });

  it('withAdmin accepts only PlatformContext', () => {
    expectTypeOf<Parameters<typeof withAdmin>[1]>().toEqualTypeOf<PlatformContext>();
    expectTypeOf<Parameters<typeof withAdmin>[1]>().not.toEqualTypeOf<ResellerContext>();
    expectTypeOf<Parameters<typeof withAdmin>[1]>().not.toEqualTypeOf<InstituteContext>();
  });
});
