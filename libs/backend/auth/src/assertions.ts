import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '@roviq/common-types';

/**
 * Assert the authenticated user has a reseller context (used by every
 * `@ResellerScope()` resolver and the EE billing graph). Centralised so each
 * call site doesn't reinvent the error message and so a future change to the
 * invariant (e.g. allow nullable resellerId for platform admins acting on
 * behalf of a reseller) lands in one place.
 */
export function assertResellerContext(user: AuthUser): asserts user is AuthUser & {
  resellerId: string;
} {
  if (!user.resellerId) {
    throw new ForbiddenException('Reseller context required');
  }
}

/**
 * Assert the authenticated user has a tenant (institute) context. Mirrors
 * `assertResellerContext` for institute-scoped resolvers that read
 * `user.tenantId` directly instead of relying on guards.
 */
export function assertTenantContext(user: AuthUser): asserts user is AuthUser & {
  tenantId: string;
} {
  if (!user.tenantId) {
    throw new ForbiddenException('Tenant context required');
  }
}
