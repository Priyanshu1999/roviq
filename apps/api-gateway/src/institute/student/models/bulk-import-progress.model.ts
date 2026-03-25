import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

/**
 * Status of a bulk student import workflow:
 * - `PARSING`: CSV file is being downloaded and parsed
 * - `VALIDATING`: Rows are being validated against field rules
 * - `INSERTING`: Batch inserts of student records in progress
 * - `GENERATING_REPORT`: Creating error CSV and uploading to storage
 * - `COMPLETED`: Import finished (may have partial errors)
 * - `FAILED`: Workflow failed unrecoverably
 */
export enum BulkImportStatusEnum {
  PARSING = 'parsing',
  VALIDATING = 'validating',
  INSERTING = 'inserting',
  GENERATING_REPORT = 'generating_report',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

registerEnumType(BulkImportStatusEnum, { name: 'BulkImportStatus' });

@ObjectType({ description: 'Progress/result of a bulk student import workflow' })
export class BulkImportProgressModel {
  @Field(() => BulkImportStatusEnum, { description: 'Current workflow status' })
  status!: BulkImportStatusEnum;

  @Field(() => Int, { description: 'Total data rows in the CSV (excluding header)' })
  totalRows!: number;

  @Field(() => Int, { description: 'Number of rows processed so far' })
  processed!: number;

  @Field(() => Int, { description: 'Number of students successfully created' })
  created!: number;

  @Field(() => Int, { description: 'Number of rows skipped (duplicates)' })
  skipped!: number;

  @Field(() => Int, { description: 'Number of validation/insert errors' })
  errors!: number;

  @Field(() => String, {
    nullable: true,
    description: 'URL of the error report CSV (available when status = COMPLETED)',
  })
  reportUrl?: string | null;
}
