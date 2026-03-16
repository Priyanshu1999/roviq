import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';

@ObjectType()
export class InstituteRef {
  @Field(() => ID)
  id!: string;

  @Field(() => I18nTextScalar)
  name!: I18nContent;
}
