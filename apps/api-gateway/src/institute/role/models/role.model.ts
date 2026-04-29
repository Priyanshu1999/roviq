import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';

@ObjectType('Role')
export class RoleModel {
  @Field(() => ID)
  id!: string;

  @Field(() => I18nTextScalar)
  name!: I18nContent;

  @Field()
  isDefault!: boolean;

  @Field()
  isSystem!: boolean;

  @Field(() => [String], {
    description:
      'Symbolic NAV_SLUGS promoted to the phone bottom tab bar for users with this role. Empty → frontend uses per-portal defaultSlugs.',
  })
  primaryNavSlugs!: string[];
}
