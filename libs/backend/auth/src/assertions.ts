import { ForbiddenException } from '@nestjs/common';
import type {
  AuthUser,
  InstituteContext,
  PlatformContext,
  ResellerContext,
} from '@roviq/common-types';

/**
 * Assert the authenticated user has a platform context. Narrows the branded
 * union so DB wrappers (`withAdmin`) accept the context.
 */
export function assertPlatformContext(user: AuthUser): asserts user is PlatformContext {
  if (user.scope !== 'platform') {
    throw new ForbiddenException('Platform scope required');
  }
}

/**
 * Assert the authenticated user has a reseller context (used by every
 * `@ResellerScope()` resolver and the EE billing graph). Centralised so each
 * call site doesn't reinvent the error message and so a future change to the
 * invariant lands in one place.
 */
export function assertResellerContext(user: AuthUser): asserts user is ResellerContext {
  if (user.scope !== 'reseller' || !user.resellerId) {
    throw new ForbiddenException('Reseller scope required');
  }
}

/**
 * Assert the authenticated user has a tenant (institute) context. Mirrors
 * `assertResellerContext` for institute-scoped resolvers.
 */
export function assertTenantContext(user: AuthUser): asserts user is InstituteContext {
  if (user.scope !== 'institute' || !user.tenantId) {
    throw new ForbiddenException('Institute scope required');
  }
}

/**
 * Assert the authenticated user is an institute user AND has a resellerId
 * (i.e. their institute is owned by a reseller). Used by EE billing flows
 * where institute users transact through their reseller's gateway.
 */
export function assertInstituteWithReseller(
  user: AuthUser,
): asserts user is InstituteContext & { resellerId: string } {
  if (user.scope !== 'institute' || !user.tenantId || !user.resellerId) {
    throw new ForbiddenException('Institute scope with reseller required');
  }
}
