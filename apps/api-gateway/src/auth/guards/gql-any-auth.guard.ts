import { type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from '@roviq/common-types';

@Injectable()
export class GqlAnyAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }

  // biome-ignore lint/suspicious/noExplicitAny: must match IAuthGuard.handleRequest signature
  handleRequest<TUser = any>(err: any, user: any, _info: any): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    const tokenType = (user as AuthUser).type;
    if (tokenType !== 'access' && tokenType !== 'platform') {
      throw new UnauthorizedException('Access or platform token required');
    }
    return user as TUser;
  }
}
