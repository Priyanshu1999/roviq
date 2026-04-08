import type { AppAbility, AuthUser } from '@roviq/common-types';

declare global {
  namespace Express {
    // Passport declares `interface User {}` and types `req.user` as `User | undefined`.
    // Augmenting `User` (instead of redeclaring `Request.user`) avoids the conflict and
    // gives `req.user` the full `AuthUser` shape across the app.
    interface User extends AuthUser {}

    interface Request {
      correlationId: string;
      ability?: AppAbility;
    }
  }
}
