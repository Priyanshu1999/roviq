import type { Server } from 'node:http';
import request from 'supertest';

export interface GqlError {
  message: string;
  extensions?: { code?: string; [key: string]: unknown };
  path?: ReadonlyArray<string | number>;
}

export interface GqlResponse<T = unknown> {
  data?: T;
  errors?: GqlError[];
}

export interface GqlRequestOptions {
  query: string;
  variables?: Record<string, unknown>;
  /** Bearer token to send in the Authorization header. */
  token?: string;
}

const GRAPHQL_PATH = '/api/graphql';

/**
 * Send a GraphQL request to an in-process NestJS app via supertest.
 *
 * GraphQL resolver errors come back as HTTP 200 with `errors` in the body, so
 * the helper returns both `data` and `errors` and the caller asserts against
 * whichever it cares about. Transport-layer failures (HTTP 4xx/5xx from Nest
 * itself, e.g. a crash before Apollo runs, or malformed body) throw here so
 * tests don't silently pass with `response.data === undefined`.
 */
export async function gqlRequest<T = unknown>(
  httpServer: Server,
  options: GqlRequestOptions,
): Promise<GqlResponse<T>> {
  const req = request(httpServer).post(GRAPHQL_PATH).set('Content-Type', 'application/json');

  if (options.token) {
    req.set('Authorization', `Bearer ${options.token}`);
  }

  const body: { query: string; variables?: Record<string, unknown> } = {
    query: options.query,
  };
  if (options.variables) {
    body.variables = options.variables;
  }

  const response = await req.send(body);

  if (response.status >= 400) {
    const snippet = JSON.stringify(response.body).slice(0, 400);
    throw new Error(
      `gqlRequest: unexpected HTTP ${response.status} from ${GRAPHQL_PATH} (body: ${snippet})`,
    );
  }

  return response.body as GqlResponse<T>;
}
