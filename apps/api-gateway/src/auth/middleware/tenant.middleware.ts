import { Injectable, type NestMiddleware } from '@nestjs/common';
import { requestContext } from '@roviq/common-types';
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

    // Create a proxy context that reads user fields lazily from req.user
    // (populated by Passport JWT guard AFTER middleware but BEFORE handlers)
    const ctx = {
      get tenantId(): string | null {
        return req.user?.tenantId ?? null;
      },
      get userId(): string {
        return req.user?.userId ?? '';
      },
      get scope(): import('@roviq/common-types').AuthScope {
        return req.user?.scope ?? 'institute';
      },
      get resellerId(): string | null {
        return req.user?.resellerId ?? null;
      },
      get impersonatorId(): string | null {
        return req.user?.impersonatorId ?? null;
      },
      correlationId,
    };

    if (req.user?.tenantId) {
      this.logger.assign({ tenantId: req.user.tenantId });
    }

    requestContext.run(ctx, () => next());
  }
}
