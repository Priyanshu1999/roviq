import { type CustomScalar, Scalar } from '@nestjs/graphql';
import type { ValueNode } from 'graphql';
import { GraphQLDateTimeISO } from 'graphql-scalars';

/**
 * GraphQL scalar for an RFC 3339 / ISO 8601 date-time string (with timezone).
 *
 * Serializes a JavaScript `Date` to an ISO string (e.g. `2025-12-03T10:15:30.000Z`)
 * and parses incoming ISO strings back into `Date` objects.
 *
 * Delegates to `graphql-scalars`'s `GraphQLDateTimeISO` for validation and
 * parsing; this wrapper only exists so Nest's code-first schema builder
 * picks it up via the `@Scalar` decorator (same pattern as `I18nTextScalar`).
 */
@Scalar('DateTime', () => Date)
export class DateTimeScalar implements CustomScalar<string, Date> {
  description = GraphQLDateTimeISO.description ?? 'RFC 3339 date-time string (ISO 8601, UTC).';

  parseValue(value: unknown): Date {
    return GraphQLDateTimeISO.parseValue(value);
  }

  serialize(value: unknown): string {
    return GraphQLDateTimeISO.serialize(value);
  }

  parseLiteral(ast: ValueNode): Date {
    return GraphQLDateTimeISO.parseLiteral(ast, undefined);
  }
}
