import { Field, ID, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

@InputType()
export class GenerateInvoiceInput {
  @Field(() => ID)
  @IsUUID('all')
  tenantId!: string;

  @Field(() => ID)
  @IsUUID('all')
  subscriptionId!: string;
}
