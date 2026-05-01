import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { AuthUser } from '@roviq/common-types';
import { requestContext } from '@roviq/request-context';
import type { NextFunction, Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

/**
 * Sets up RequestContext ALS for the request lifecycle.
 *
 * Runs as middleware (before guards), so req.user is NOT yet populated by Passport.
 * We initialize context with empty userId, then the request handler reads the final
 * userId lazily via getRequestContext() — by that time, Passport has populated req.user.
 *
 * To solve this, we store the req reference and read user lazily.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly logger: PinoLogger) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const correlationId =
      ('correlationId' in req ? (req.correlationId as string) : null) || crypto.randomUUID();

    const getUser = (): AuthUser | undefined => req.user;

    const ctx = {
      get tenantId(): string | null {
        const u = getUser();
        return u?.scope === 'institute' ? u.tenantId : null;
      },
      get userId(): string {
        return getUser()?.userId ?? '';
      },
      get scope(): import('@roviq/common-types').AuthScope | null {
        return getUser()?.scope ?? null;
      },
      get resellerId(): string | null {
        const u = getUser();
        if (!u) return null;
        if (u.scope === 'reseller') return u.resellerId;
        if (u.scope === 'institute') return u.resellerId ?? null;
        return null;
      },
      get impersonatorId(): string | null {
        return getUser()?.impersonatorId ?? null;
      },
      correlationId,
    };

    const u = getUser();
    if (u?.scope === 'institute' && u.tenantId) {
      this.logger.assign({ tenantId: u.tenantId });
    }

    requestContext.run(ctx, () => next());
  }
}
