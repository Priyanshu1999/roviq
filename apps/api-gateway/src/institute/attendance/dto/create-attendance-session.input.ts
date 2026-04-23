import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsDateString, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

@InputType({
  description:
    'Open an attendance session for a section on a given date. Period is optional — omit for whole-day DAILY mode.',
})
export class CreateAttendanceSessionInput {
  @IsUUID()
  @Field(() => ID)
  sectionId!: string;

  @IsUUID()
  @Field(() => ID)
  academicYearId!: string;

  @IsDateString()
  @Field(() => String, { description: 'Attendance date as ISO YYYY-MM-DD.' })
  date!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Field(() => Int, {
    nullable: true,
    description: 'Period / lecture slot number. Omit or pass null for whole-day attendance.',
  })
  period?: number | null;

  @IsOptional()
  @IsUUID()
  @Field(() => ID, { nullable: true, description: 'Subject being taught (for lecture-wise mode).' })
  subjectId?: string | null;

  @IsUUID()
  @Field(() => ID, { description: 'Membership id of the lecturer taking this session.' })
  lecturerId!: string;
}
