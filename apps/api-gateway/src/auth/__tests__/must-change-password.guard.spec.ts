import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthUser } from '@roviq/common-types';
import { createMock } from '@roviq/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALLOW_WHEN_PASSWORD_CHANGE_REQUIRED } from '../decorators/allow-when-password-change-required.decorator';
import { MustChangePasswordGuard } from '../middleware/must-change-password.guard';

vi.mock('@nestjs/graphql', () => ({
  GqlExecutionContext: {
    create: vi.fn(),
  },
}));

const mockedGqlCreate = vi.mocked(GqlExecutionContext.create);

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    _scope: 'institute',
    userId: 'user-1',
    scope: 'institute',
    tenantId: 'tenant-1',
    membershipId: 'mem-1',
    roleId: 'role-1',
    type: 'access',
    ...overrides,
  } as AuthUser;
}

function makeExecutionContext(): ExecutionContext {
  return {
    getType: vi.fn().mockReturnValue('graphql'),
    getHandler: vi.fn().mockReturnValue(() => {}),
    getClass: vi.fn().mockReturnValue(class {}),
    getArgs: vi.fn(),
    getArgByIndex: vi.fn(),
    switchToHttp: vi.fn(),
    switchToRpc: vi.fn(),
    switchToWs: vi.fn(),
  } as unknown as ExecutionContext;
}

/**
 * Stub the result of `GqlExecutionContext.create(...)` so the guard sees the
 * supplied raw context shape. The guard reads `ctx.getContext().req?.user` —
 * pass `req: undefined` to simulate a WebSocket subscription that has NOT
 * been merged through the app.module.ts context wrapper.
 */
function stubGqlContext(rawContext: { req?: { user?: AuthUser } | null; extra?: unknown }): void {
  mockedGqlCreate.mockReturnValue(
    createMock<GqlExecutionContext>({
      getContext: () => rawContext as Record<string, unknown>,
    }),
  );
}

function makeReflector(returnValue: boolean | undefined): Reflector {
  return createMock<Reflector>({
    getAllAndOverride: vi.fn().mockReturnValue(returnValue),
  });
}

describe('MustChangePasswordGuard', () => {
  let guard: MustChangePasswordGuard;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HTTP requests (req.user populated)', () => {
    it('blocks with PASSWORD_CHANGE_REQUIRED when user.mustChangePassword=true and handler is not allow-decorated', () => {
      guard = new MustChangePasswordGuard(makeReflector(undefined));
      stubGqlContext({ req: { user: makeUser({ mustChangePassword: true }) } });

      const ctx = makeExecutionContext();
      const err = (() => {
        try {
          guard.canActivate(ctx);
          return null;
        } catch (e: unknown) {
          return e;
        }
      })();

      expect(err).toBeInstanceOf(ForbiddenException);
      const response = (err as ForbiddenException).getResponse() as { code?: string };
      expect(response.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('returns true when user has no mustChangePassword flag', () => {
      guard = new MustChangePasswordGuard(makeReflector(undefined));
      stubGqlContext({ req: { user: makeUser({ mustChangePassword: false }) } });

      expect(guard.canActivate(makeExecutionContext())).toBe(true);
    });

    it('returns true when handler is decorated @AllowWhenPasswordChangeRequired even if flag is set', () => {
      const reflector = makeReflector(true);
      guard = new MustChangePasswordGuard(reflector);
      stubGqlContext({ req: { user: makeUser({ mustChangePassword: true }) } });

      const ctx = makeExecutionContext();
      expect(guard.canActivate(ctx)).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        ALLOW_WHEN_PASSWORD_CHANGE_REQUIRED,
        [ctx.getHandler(), ctx.getClass()],
      );
    });

    it('returns true for anonymous requests (no user on req)', () => {
      guard = new MustChangePasswordGuard(makeReflector(undefined));
      stubGqlContext({ req: {} });

      expect(guard.canActivate(makeExecutionContext())).toBe(true);
    });
  });

  describe('WebSocket requests', () => {
    // The app.module.ts context() wrapper merges `extra.user` (set by
    // graphql-ws onConnect) onto `req.user` for every subscription. The
    // assertions below exercise BOTH shapes:
    //   1. The wrapped shape — what subscriptions see in production. Behaves
    //      identically to HTTP because the guard reads from `req.user`.
    //   2. The unwrapped shape — what `extra` would look like if a future
    //      refactor bypassed the wrapper. The guard MUST NOT fail-open by
    //      peeking at `extra.user`; it must treat the request as anonymous
    //      (req?.user === undefined → returns true and lets downstream
    //      auth/scope guards reject), which is the safe behaviour for a
    //      first-login check that runs after authentication.

    it('blocks WS with mustChangePassword=true when context has been wrapped (req.user populated)', () => {
      guard = new MustChangePasswordGuard(makeReflector(undefined));
      stubGqlContext({ req: { user: makeUser({ mustChangePassword: true }) } });

      expect(() => guard.canActivate(makeExecutionContext())).toThrow(ForbiddenException);
    });

    it('does NOT fail-open when WS context has not been wrapped — reads only from req?.user, never extra.user', () => {
      // Simulate the raw onConnect shape: user lives on extra, not req.
      // If the guard ever started reading from extra it would let this
      // user through with mustChangePassword=true — that would be a fail-OPEN.
      // Instead, with `req` undefined the guard must treat this as anonymous
      // (no user) and return true so downstream auth guards can reject.
      guard = new MustChangePasswordGuard(makeReflector(undefined));
      stubGqlContext({
        req: undefined,
        extra: { user: makeUser({ mustChangePassword: true }) },
      });

      // Returns true because req?.user is undefined — the guard does NOT
      // peek at extra.user. Downstream auth/scope guards are responsible
      // for rejecting the unauthenticated request.
      expect(guard.canActivate(makeExecutionContext())).toBe(true);
    });
  });
});
