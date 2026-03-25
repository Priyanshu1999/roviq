import { Field, ID, InputType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@InputType({ description: 'Input for bulk student import via CSV file' })
export class BulkCreateStudentsInput {
  @Field({ description: 'MinIO/S3 URL of the uploaded CSV file' })
  fileUrl!: string;

  @Field(() => ID, { description: 'Academic year for enrollment' })
  academicYearId!: string;

  @Field(() => ID, { description: 'Default standard (grade level) for all rows unless overridden' })
  standardId!: string;

  @Field(() => ID, { description: 'Default section for all rows unless overridden' })
  sectionId!: string;

  @Field(() => GraphQLJSON, {
    description:
      'Maps CSV column headers to internal field names. Example: { "Student Name": "first_name", "DOB": "date_of_birth" }',
  })
  fieldMapping!: Record<string, string>;
}
