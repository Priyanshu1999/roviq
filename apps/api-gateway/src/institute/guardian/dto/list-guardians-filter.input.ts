import { Field, InputType } from '@nestjs/graphql';

/**
 * Filter input for the `listGuardians` query. Currently supports free-text
 * search over the joined user_profiles.search_vector (first/last name). The
 * guardian list per institute is small, so we intentionally do NOT expose
 * cursor pagination here — full list fits comfortably in one response.
 */
@InputType({ description: 'Filter for listing guardians in an institute' })
export class ListGuardiansFilterInput {
  /**
   * Full-text search across first/last name via the generated
   * `user_profiles.search_vector` column (English + Hindi tokens).
   * Uses plainto_tsquery, so input is treated as literal text (no
   * operator parsing) which protects against query injection.
   */
  @Field(() => String, { nullable: true })
  search?: string;
}
