import { Field, InputType } from '@nestjs/graphql';
import { PaymentProvider } from '@roviq/ee-billing-types';
import { IsEmail, IsEnum, IsString, IsUUID } from 'class-validator';

@InputType()
export class AssignPlanInput {
  @Field()
  @IsUUID()
  instituteId!: string;

  @Field()
  @IsUUID()
  planId!: string;

  @Field(() => PaymentProvider)
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;

  @Field()
  @IsEmail()
  customerEmail!: string;

  @Field()
  @IsString()
  customerPhone!: string;
}
