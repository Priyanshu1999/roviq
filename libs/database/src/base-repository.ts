import { getRequestContext } from '@roviq/common-types';

export abstract class BaseRepository {
  protected assertTenantContext(): string {
    const ctx = getRequestContext();
    if (!ctx.tenantId) {
      throw new Error('Tenant-scoped query called without tenant context');
    }
    return ctx.tenantId;
  }
}
