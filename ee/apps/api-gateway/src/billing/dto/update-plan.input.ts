import { Field, InputType, Int } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { BillingInterval, type FeatureLimits } from '@roviq/ee-billing-types';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import { IsInt, IsObject, IsOptional, Min } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class UpdatePlanInput {
  @Field(() => I18nTextScalar, { nullable: true })
  @IsObject()
  @IsOptional()
  name?: I18nContent;

  @Field(() => I18nTextScalar, { nullable: true })
  @IsObject()
  @IsOptional()
  description?: I18nContent;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @Min(0)
  @IsOptional()
  amount?: number;

  @Field(() => BillingInterval, { nullable: true })
  @IsOptional()
  billingInterval?: BillingInterval;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsObject()
  @IsOptional()
  featureLimits?: FeatureLimits;
}
