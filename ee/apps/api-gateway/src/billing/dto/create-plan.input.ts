import { Field, InputType, Int } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { BillingInterval, type FeatureLimits } from '@roviq/ee-billing-types';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import { IsEnum, IsInt, IsObject, IsOptional, IsString, Length, Min } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class CreatePlanInput {
  @Field(() => I18nTextScalar)
  @IsObject()
  name!: I18nContent;

  @Field(() => I18nTextScalar, { nullable: true })
  @IsObject()
  @IsOptional()
  description?: I18nContent;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  amount!: number;

  @Field({ defaultValue: 'INR' })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @Field(() => BillingInterval)
  @IsEnum(BillingInterval)
  billingInterval!: BillingInterval;

  @Field(() => GraphQLJSON)
  @IsObject()
  featureLimits!: FeatureLimits;
}
