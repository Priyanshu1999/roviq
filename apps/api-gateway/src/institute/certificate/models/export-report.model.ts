import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { DateTimeScalar } from '@roviq/nestjs-graphql';

@ObjectType({ description: 'Result of starting a compliance export — workflow ID for tracking' })
export class ExportStartResult {
  @Field({ description: 'Temporal workflow ID for progress tracking' })
  workflowId!: string;
}

@ObjectType({ description: 'A generated compliance report with download URL' })
export class ExportReportModel {
  @Field(() => ID)
  id!: string;

  @Field()
  reportType!: string;

  @Field()
  academicYearId!: string;

  @Field(() => String, { nullable: true })
  fileUrl?: string | null;

  @Field(() => Int, { nullable: true })
  fileSize?: number | null;

  @Field()
  status!: string;

  @Field(() => DateTimeScalar)
  requestedAt!: Date;

  @Field(() => DateTimeScalar, { nullable: true })
  completedAt?: Date | null;
}
