import { Field, InputType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { BillingInterval, type FeatureLimits } from '@roviq/ee-billing-types';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import { Allow, IsEnum, IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';
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

  @Field(() => GraphQLBigInt)
  @Allow()
  amount!: bigint;

  @Field({ defaultValue: 'INR' })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @Field(() => BillingInterval)
  @IsEnum(BillingInterval)
  interval!: BillingInterval;

  @Field(() => GraphQLJSON)
  @IsObject()
  entitlements!: FeatureLimits;

  @Field()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'resellerId must be a valid UUID format',
  })
  resellerId!: string;

  @Field()
  @IsString()
  @Length(1, 50)
  code!: string;
}
