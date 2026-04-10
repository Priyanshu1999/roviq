import type { FormattedExecutionResult } from 'graphql';

const API_URL = process.env.API_URL || 'http://localhost:3004/api/graphql';

/**
 * Default response shape — opaque object map. Callers that want strong
 * typing pass a type parameter to `gql<T>(...)` and get back
 * `FormattedExecutionResult<T>` so `data.foo.bar` is typed.
 */
// biome-ignore lint/suspicious/noExplicitAny: backwards-compat alias for callers that don't pass a type parameter
export type GqlResult<TData = Record<string, any>> = FormattedExecutionResult<TData>;

/**
 * POST a GraphQL query against the running api-gateway and return the parsed
 * response. Callers that know the expected `data` shape pass a type parameter
 * for compile-time access:
 *
 *     const res = await gql<{ createPlan: { id: string; status: string } }>(
 *       CREATE_PLAN, { input }, token,
 *     );
 *     res.data?.createPlan.id  // typed as string
 *
 * Without a type parameter, `data` falls back to `Record<string, any>` so
 * existing call sites continue to compile while migration is in progress.
 */
export async function gql<TData = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<FormattedExecutionResult<TData>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<FormattedExecutionResult<TData>>;
}
