import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthUser } from '@roviq/common-types';
import { ALLOW_WHEN_PASSWORD_CHANGE_REQUIRED } from '../decorators/allow-when-password-change-required.decorator';

/**
 * ROV-96 — first-login enforcement.
 *
 * Runs after GqlAuthGuard has populated `req.user`. If the authenticated user
 * was flagged with `mustChangePassword = true` at access-token mint time, we
 * block every operation except those explicitly marked
 * `@AllowWhenPasswordChangeRequired()` (changePassword, logout, me).
 *
 * Anonymous requests (no user on req) and users without the flag pass through
 * untouched — auth/scope guards handle their own concerns.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    // Both HTTP and WebSocket requests reach this guard via the wrapped
    // context shape `{ req: { user } }`. For WS subscriptions the wrap is
    // performed inside `apps/api-gateway/src/app/app.module.ts` `context()`,
    // which copies `extra.user` (set by `onConnect`) onto `req.user`. Reading
    // strictly from `req?.user` here means a future refactor that bypasses
    // the wrapper for WS would surface as `undefined` (anonymous, fail-CLOSE
    // for everyone except handlers tagged @AllowWhenPasswordChangeRequired)
    // rather than silently fail-OPEN by reading directly from `extra`.
    const user = ctx.getContext().req?.user as AuthUser | undefined | null;

    if (!user) {
      return true;
    }

    if (user.mustChangePassword !== true) {
      return true;
    }

    const isAllowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_WHEN_PASSWORD_CHANGE_REQUIRED,
      [context.getHandler(), context.getClass()],
    );

    if (isAllowed) {
      return true;
    }

    throw new ForbiddenException({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'You must change your password before continuing.',
    });
  }
}
