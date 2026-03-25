import { Field, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

@InputType()
export class AssignPlanInput {
  @Field()
  @IsUUID()
  tenantId!: string;

  @Field()
  @IsUUID()
  planId!: string;
}
