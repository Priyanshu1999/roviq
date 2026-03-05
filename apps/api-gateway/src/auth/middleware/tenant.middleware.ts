import { Injectable, type NestMiddleware } from '@nestjs/common';
import { tenantContext } from '@roviq/prisma-client';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as Request & { user?: { tenantId?: string } }).user;
    const tenantId = user?.tenantId;

    if (tenantId) {
      tenantContext.run({ tenantId }, () => next());
    } else {
      next();
    }
  }
}
