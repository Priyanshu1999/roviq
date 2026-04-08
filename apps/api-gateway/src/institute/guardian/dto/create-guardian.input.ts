import { Field, ID, InputType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import { IsObject, IsOptional } from 'class-validator';

@InputType({ description: 'Input for creating a guardian' })
export class CreateGuardianInput {
  @Field(() => I18nTextScalar, { description: 'First name' })
  @IsObject()
  firstName!: I18nContent;

  @Field(() => I18nTextScalar, { nullable: true })
  @IsObject()
  @IsOptional()
  lastName?: I18nContent;

  @Field(() => String, { nullable: true })
  gender?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  occupation?: string;

  @Field(() => String, { nullable: true })
  organization?: string;

  @Field(() => String, { nullable: true })
  educationLevel?: string;

  @Field(() => ID, {
    nullable: true,
    description: 'If provided, immediately link this guardian to a student',
  })
  studentProfileId?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Relationship to the student: father/mother/legal_guardian/etc.',
  })
  relationship?: string;

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  isPrimaryContact?: boolean;
}
