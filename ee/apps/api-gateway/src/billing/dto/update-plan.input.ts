import { Field, InputType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { BillingInterval, type FeatureLimits } from '@roviq/ee-billing-types';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import { IsObject, IsOptional } from 'class-validator';
import { GraphQLBigInt } from 'graphql-scalars';
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

  @Field(() => GraphQLBigInt, { nullable: true })
  @IsOptional()
  amount?: bigint;

  @Field(() => BillingInterval, { nullable: true })
  @IsOptional()
  interval?: BillingInterval;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsObject()
  @IsOptional()
  entitlements?: FeatureLimits;
}
