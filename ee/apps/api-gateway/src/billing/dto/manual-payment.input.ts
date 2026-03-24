import { Field, InputType } from '@nestjs/graphql';
import { PaymentMethod } from '@roviq/ee-billing-types';
import { Allow, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { GraphQLBigInt } from 'graphql-scalars';

@InputType()
export class ManualPaymentInput {
  @Field(() => PaymentMethod)
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @Field(() => GraphQLBigInt)
  @Allow()
  amountPaise!: bigint;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  receiptNumber?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  notes?: string;

  /** Which reseller field agent collected the cash (method=CASH only) */
  @Field({ nullable: true })
  @IsUUID('all')
  @IsOptional()
  collectedById?: string;

  /** When cash was physically collected — may differ from recording date (method=CASH only) */
  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  collectionDate?: string;
}
