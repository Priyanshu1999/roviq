import { type SignOptions, sign } from 'jsonwebtoken';

/**
 * JWT secret used for test token signing.
 *
 * Reads from `JWT_SECRET` env var so signed tokens validate against the same
 * secret the api-gateway's `JwtStrategy` reads at boot. The fallback value is
 * only used if a test runner forgets to set the env var; integration tests that
 * use `createIntegrationApp()` boot the real `JwtStrategy`, so a mismatch here
 * will produce a clear "invalid signature" failure.
 */
function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-production';
}

interface BaseTokenOptions {
  /** The user ID — becomes the JWT `sub` claim and `AuthUser.userId`. */
  sub: string;
  /** The active membership ID for this session. */
  membershipId: string;
  /** The role ID attached to the membership. */
  roleId: string;
  /** Optional override for token TTL. */
  expiresIn?: SignOptions['expiresIn'];
}

/**
 * Mint an institute-scoped JWT identical in shape to one issued by
 * `instituteLogin → selectInstitute`.
 *
 * The payload matches `JwtPayload` in `apps/api-gateway/src/auth/jwt.strategy.ts`,
 * so a request bearing this token resolves to a valid `AuthUser` with
 * `scope: 'institute'`.
 */
export function createInstituteToken(
  options: BaseTokenOptions & { tenantId: string; resellerId?: string },
): string {
  return sign(
    {
      sub: options.sub,
      scope: 'institute' as const,
      tenantId: options.tenantId,
      membershipId: options.membershipId,
      roleId: options.roleId,
      type: 'access' as const,
      ...(options.resellerId ? { resellerId: options.resellerId } : {}),
    },
    getJwtSecret(),
    { expiresIn: options.expiresIn ?? '15m' },
  );
}

/**
 * Mint a platform-scoped JWT identical in shape to one issued by `adminLogin`.
 */
export function createPlatformToken(options: BaseTokenOptions): string {
  return sign(
    {
      sub: options.sub,
      scope: 'platform' as const,
      membershipId: options.membershipId,
      roleId: options.roleId,
      type: 'access' as const,
    },
    getJwtSecret(),
    { expiresIn: options.expiresIn ?? '5m' },
  );
}

/**
 * Mint a reseller-scoped JWT identical in shape to one issued by `resellerLogin`.
 */
export function createResellerToken(options: BaseTokenOptions & { resellerId: string }): string {
  return sign(
    {
      sub: options.sub,
      scope: 'reseller' as const,
      resellerId: options.resellerId,
      membershipId: options.membershipId,
      roleId: options.roleId,
      type: 'access' as const,
    },
    getJwtSecret(),
    { expiresIn: options.expiresIn ?? '10m' },
  );
}

/**
 * Mint an institute-scoped JWT carrying impersonation claims, identical in
 * shape to one issued by `impersonate`. Impersonation tokens are non-renewable.
 */
export function createImpersonationToken(
  options: BaseTokenOptions & {
    tenantId: string;
    impersonatorId: string;
    impersonationSessionId: string;
  },
): string {
  return sign(
    {
      sub: options.sub,
      scope: 'institute' as const,
      tenantId: options.tenantId,
      membershipId: options.membershipId,
      roleId: options.roleId,
      type: 'access' as const,
      isImpersonated: true,
      impersonatorId: options.impersonatorId,
      impersonationSessionId: options.impersonationSessionId,
    },
    getJwtSecret(),
    { expiresIn: options.expiresIn ?? '15m' },
  );
}
