// Smoke test for the global Express augmentation in `apps/api-gateway/src/express.d.ts`.
//
// `Request['user']` is overridden from Passport's default `User | undefined`
// to the branded `AuthUser | undefined`. The augmentation is fragile —
// it depends on the .d.ts being included in every tsconfig that compiles
// resolver/middleware code. If a downstream tsconfig drops it, callers
// silently revert to the looser Passport type and start needing `as`
// casts that defeat Item 4's branded-context invariant.

import type { AuthUser } from '@roviq/common-types';
import type { Request } from 'express';
import { describe, expectTypeOf, it } from 'vitest';

describe('Express Request augmentation', () => {
  it('Request["user"] resolves to AuthUser | undefined', () => {
    expectTypeOf<Request['user']>().toEqualTypeOf<AuthUser | undefined>();
  });
});
