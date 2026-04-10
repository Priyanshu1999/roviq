import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class InstituteBrandingModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  logoUrl?: string | null;

  @Field(() => String, { nullable: true })
  faviconUrl?: string | null;

  @Field(() => String, { nullable: true })
  primaryColor?: string | null;

  @Field(() => String, { nullable: true })
  secondaryColor?: string | null;

  @Field(() => String, { nullable: true })
  themeIdentifier?: string | null;

  @Field(() => String, { nullable: true })
  coverImageUrl?: string | null;
}
