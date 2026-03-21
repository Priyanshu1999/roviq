import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthUser } from '@roviq/common-types';

@Injectable()
export class ResellerScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const user = ctx.getContext().req.user as AuthUser | undefined;
    if (!user || user.scope !== 'reseller') {
      throw new ForbiddenException('Reseller scope required');
    }
    return true;
  }
}
