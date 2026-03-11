import type { AppAbility, AuthUser } from '@roviq/common-types';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      user?: AuthUser;
      ability?: AppAbility;
    }
  }
}
