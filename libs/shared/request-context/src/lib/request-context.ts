import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  /** null for platform/reseller requests (not scoped to a tenant) */
  tenantId: string | null;
  /** null for platform/institute requests (not scoped to a reseller) */
  resellerId: string | null;
  userId: string;
  scope: import('@roviq/common-types').AuthScope;
  impersonatorId: string | null;
  correlationId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  const ctx = requestContext.getStore();
  if (!ctx) throw new Error('No request context — are you inside a request?');
  return ctx;
}
