import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthUser } from '@roviq/common-types';

@Injectable()
export class InstituteScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const user = ctx.getContext().req.user as AuthUser | undefined;
    if (!user || user.scope !== 'institute') {
      throw new ForbiddenException('Institute scope required');
    }
    return true;
  }
}
