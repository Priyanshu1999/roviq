import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';
import { GraphQLBigInt } from 'graphql-scalars';

@InputType()
export class RefundInput {
  @Field(() => GraphQLBigInt)
  amountPaise!: bigint;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  reason?: string;
}
