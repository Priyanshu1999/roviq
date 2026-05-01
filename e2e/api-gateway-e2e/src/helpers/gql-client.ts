import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { type FormattedExecutionResult, print } from 'graphql';

const API_URL = process.env.API_URL || 'http://localhost:3004/api/graphql';

/**
 * Default response shape — opaque object map. Callers that want strong
 * typing pass a type parameter to `gql<T>(...)` and get back
 * `FormattedExecutionResult<T>` so `data.foo.bar` is typed.
 */
// biome-ignore lint/suspicious/noExplicitAny: backwards-compat alias for callers that don't pass a type parameter
export type GqlResult<TData = Record<string, any>> = FormattedExecutionResult<TData>;

/**
 * POST a GraphQL operation against the running api-gateway.
 *
 * Two call styles:
 *   1. Typed — pass a `TypedDocumentNode` from `__generated__/graphql.ts`;
 *      `data` and `variables` are inferred from the document.
 *   2. Raw string — pass a query string + optional `<TData>` generic for
 *      compile-time access. Kept for backwards compat.
 */
export function gql<TData, TVars extends Record<string, unknown> | undefined = undefined>(
  document: TypedDocumentNode<TData, TVars>,
  variables?: TVars,
  token?: string,
): Promise<FormattedExecutionResult<TData>>;
export function gql<TData = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<FormattedExecutionResult<TData>>;
export async function gql<TData>(
  queryOrDocument: string | TypedDocumentNode<TData, Record<string, unknown> | undefined>,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<FormattedExecutionResult<TData>> {
  const query = typeof queryOrDocument === 'string' ? queryOrDocument : print(queryOrDocument);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<FormattedExecutionResult<TData>>;
}
