import { Field, InputType, Int } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { BillingInterval, type FeatureLimits } from '@roviq/ee-billing-types';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import { Allow, IsEnum, IsInt, IsObject, IsOptional, IsString, Length, Min } from 'class-validator';
import { GraphQLBigInt } from 'graphql-scalars';
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

  @Field()
  @IsString()
  @Length(1, 50)
  code!: string;

  @Field(() => BillingInterval)
  @IsEnum(BillingInterval)
  interval!: BillingInterval;

  @Field(() => GraphQLBigInt)
  @Allow()
  amount!: bigint;

  @Field({ defaultValue: 'INR' })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @Field(() => Int, { defaultValue: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  trialDays?: number;

  @Field(() => GraphQLJSON)
  @IsObject()
  entitlements!: FeatureLimits;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
