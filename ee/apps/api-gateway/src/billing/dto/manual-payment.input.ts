import { Field, InputType } from '@nestjs/graphql';
import { PaymentMethod } from '@roviq/ee-billing-types';
import { Allow, IsEnum, IsOptional, IsString } from 'class-validator';
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
}
