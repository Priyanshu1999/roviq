import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  /** null for platform/reseller requests (not scoped to a tenant) */
  tenantId: string | null;
  userId: string;
  scope: import('./common-types').AuthScope;
  impersonatorId: string | null;
  correlationId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  const ctx = requestContext.getStore();
  if (!ctx) throw new Error('No request context — are you inside a request?');
  return ctx;
}
