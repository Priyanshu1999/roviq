import { type RequestContext, requestContext } from './request-context';

export function withTestContext<T>(fn: () => T | Promise<T>, overrides?: Partial<RequestContext>) {
  return requestContext.run(
    {
      userId: 'test-user-id',
      tenantId: 'test-tenant-id',
      scope: 'institute',
      impersonatorId: null,
      correlationId: 'test-correlation-id',
      ...overrides,
    },
    fn,
  );
}
