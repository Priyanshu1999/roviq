import { type CustomScalar, Scalar } from '@nestjs/graphql';
import type { ValueNode } from 'graphql';
import { GraphQLLocalDate } from 'graphql-scalars';

/**
 * GraphQL scalar for a calendar date in `YYYY-MM-DD` form, with no timezone
 * or time component. Backed by the Postgres `date` column type.
 *
 * Serializes as a string (e.g. `2025-12-03`) and validates that the value is
 * both well-formed and a real calendar date (so `2020-02-30` is rejected).
 *
 * Delegates to `graphql-scalars`'s `GraphQLLocalDate`; this wrapper just
 * registers it with Nest's code-first schema builder under the name
 * `DateOnly` (same pattern as `I18nTextScalar`).
 */
@Scalar('DateOnly', () => DateOnlyScalar)
export class DateOnlyScalar implements CustomScalar<string, string> {
  description =
    GraphQLLocalDate.description ?? 'Calendar date in YYYY-MM-DD form, with no timezone.';

  parseValue(value: unknown): string {
    return GraphQLLocalDate.parseValue(value);
  }

  serialize(value: unknown): string {
    return GraphQLLocalDate.serialize(value);
  }

  parseLiteral(ast: ValueNode): string {
    return GraphQLLocalDate.parseLiteral(ast, undefined);
  }
}
