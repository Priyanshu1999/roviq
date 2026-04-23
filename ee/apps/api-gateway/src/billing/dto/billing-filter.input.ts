import { Field, InputType } from '@nestjs/graphql';
import { InvoiceStatus } from '@roviq/ee-billing-types';
import { DateTimeScalar } from '@roviq/nestjs-graphql';
import { IsDate, IsOptional } from 'class-validator';

@InputType()
export class BillingFilterInput {
  @Field(() => InvoiceStatus, { nullable: true })
  @IsOptional()
  status?: InvoiceStatus;

  @Field(() => DateTimeScalar, { nullable: true })
  @IsDate()
  @IsOptional()
  from?: Date;

  @Field(() => DateTimeScalar, { nullable: true })
  @IsDate()
  @IsOptional()
  to?: Date;
}
