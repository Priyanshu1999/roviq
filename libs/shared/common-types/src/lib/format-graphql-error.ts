import type { GraphQLFormattedError } from 'graphql';

/**
 * NestJS wraps HttpException's serialized response under
 * `extensions.originalError`. ValidationPipe errors carry the actual array of
 * validator messages there, while resolvers throw business errors with a plain
 * string message. Surface those messages instead of the generic
 * "Bad Request Exception" wrapper so failures point to the real root cause.
 */
interface NestOriginalError {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

/**
 * Format a `GraphQLFormattedError` (the wire format from Apollo / graphql-js)
 * for display in test failure output and Console Guardian reports.
 *
 * Handles every wire shape observed in production:
 *   - Plain GraphQL execution errors                    → `<message> [<code>]`
 *   - Apollo errors with extensions.code               → `<message> [<code>]`
 *   - NestJS HttpException (string `originalError`)     → `<message> [<code>]: <orig>`
 *   - NestJS ValidationPipe (array `originalError`)     → `<message> [<code>]: <m1>, <m2>`
 *   - Errors with no extensions                         → `<message> [NO_CODE]`
 *   - Errors with empty/missing message                 → `<empty> [<code>]`
 *
 * Example NestJS ValidationPipe wire payload:
 *   {
 *     message: "Bad Request Exception",
 *     extensions: {
 *       code: "BAD_REQUEST",
 *       originalError: { message: ["studentProfileId must be a valid UUIDv7"] }
 *     }
 *   }
 * → `Bad Request Exception [BAD_REQUEST]: studentProfileId must be a valid UUIDv7`
 */
export function formatGraphQLError(err: GraphQLFormattedError): string {
  const code = typeof err.extensions?.code === 'string' ? err.extensions.code : 'NO_CODE';
  const original = err.extensions?.originalError as NestOriginalError | undefined;
  const detail = original?.message;
  const detailStr = Array.isArray(detail) ? detail.join(', ') : detail;
  const base = `${err.message ?? ''} [${code}]`;
  return detailStr && detailStr.length > 0 ? `${base}: ${detailStr}` : base;
}
