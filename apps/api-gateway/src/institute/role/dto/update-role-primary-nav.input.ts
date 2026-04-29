import { Field, ID, InputType } from '@nestjs/graphql';
import { ALL_NAV_SLUGS, MAX_PRIMARY_NAV_SLUGS } from '@roviq/common-types';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsUUID } from 'class-validator';

@InputType({
  description:
    "Set a role's bottom-tab-bar destinations. Empty array clears the customization (frontend falls back to per-portal defaults).",
})
export class UpdateRolePrimaryNavInput {
  @Field(() => ID)
  @IsUUID()
  roleId!: string;

  @Field(() => [String], {
    description: `Up to ${MAX_PRIMARY_NAV_SLUGS} symbolic NAV_SLUGS, in display order. Slugs the user has no ability for are silently skipped at render time.`,
  })
  @IsArray()
  @ArrayMaxSize(MAX_PRIMARY_NAV_SLUGS)
  @ArrayUnique()
  @IsIn(ALL_NAV_SLUGS as readonly string[], { each: true })
  slugs!: string[];
}
