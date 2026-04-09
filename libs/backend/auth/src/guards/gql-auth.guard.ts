import { type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  /**
   * For WebSocket subscriptions, the user is populated by the GraphQL module's
   * `onConnect` callback (single-use ws-ticket flow) and surfaced on
   * `context.req.user`. The synthetic request has no `headers`, so running
   * passport-jwt against it crashes with "Cannot read properties of undefined
   * (reading 'authorization')". Detect that case and short-circuit — the user
   * was already authenticated when the ticket was minted, no JWT to verify.
   */
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const gqlReq = ctx.getContext().req;
    if (gqlReq?.user) {
      return true;
    }
    // For HTTP requests, fall through to the standard passport-jwt flow.
    return (await super.canActivate(context)) as boolean;
  }

  override getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }

  // biome-ignore lint/suspicious/noExplicitAny: must match IAuthGuard.handleRequest signature
  override handleRequest<TUser = any>(err: any, user: any, _info: any): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user as TUser;
  }
}
