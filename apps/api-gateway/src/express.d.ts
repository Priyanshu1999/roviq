import type { AppAbility, AuthUser } from '@roviq/common-types';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      ability?: AppAbility;
      // Override Passport's `req.user: User | undefined` with the branded
      // `AuthUser` union so resolvers narrow by `scope`. Augmenting `User` is
      // not viable here because it cannot `extends` a union type.
      user?: AuthUser;
    }
  }
}
