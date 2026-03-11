import { Injectable, type NestMiddleware } from '@nestjs/common';
import { tenantContext } from '@roviq/prisma-client';
import type { NextFunction, Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly logger: PinoLogger) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const tenantId = req.user?.tenantId;

    if (tenantId) {
      this.logger.assign({ tenantId });
      tenantContext.run({ tenantId }, () => next());
    } else {
      next();
    }
  }
}
