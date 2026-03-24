import { Field, InputType, Int } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { BillingInterval, type FeatureLimits } from '@roviq/ee-billing-types';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import { IsInt, IsObject, IsOptional, Min } from 'class-validator';
import { GraphQLBigInt } from 'graphql-scalars';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class UpdatePlanInput {
  /** Optimistic concurrency — must match current plan version */
  @Field(() => Int)
  @IsInt()
  @Min(1)
  version!: number;
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

  /** Number of free trial days before billing starts (0 = no trial) */
  @Field(() => Int, { nullable: true })
  @IsInt()
  @Min(0)
  @IsOptional()
  trialDays?: number;

  /** Display order in plan listing — lower numbers appear first */
  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsObject()
  @IsOptional()
  entitlements?: FeatureLimits;
}
