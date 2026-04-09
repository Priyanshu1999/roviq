import { getRequestContext } from '@roviq/request-context';
export abstract class BaseRepository {
  protected assertTenantContext(): string {
    const ctx = getRequestContext();
    if (!ctx.tenantId) {
      throw new Error('Tenant-scoped query called without tenant context');
    }
    return ctx.tenantId;
  }
}
