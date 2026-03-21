import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthUser } from '@roviq/common-types';

@Injectable()
export class PlatformScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const user = ctx.getContext().req.user as AuthUser | undefined;
    if (!user || user.scope !== 'platform') {
      throw new ForbiddenException('Platform scope required');
    }
    return true;
  }
}
