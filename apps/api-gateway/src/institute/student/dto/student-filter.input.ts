import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

@InputType({ description: 'Filter + pagination input for listStudents (ROV-154)' })
export class StudentFilterInput {
  // ── Pagination ──────────────────────────────────────────
  @Field(() => Int, { nullable: true, defaultValue: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  first?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;

  // ── Filters ─────────────────────────────────────────────
  @Field(() => ID, {
    nullable: true,
    description: 'Filter by academic year (defaults to active year)',
  })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  standardId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @Field({ nullable: true, description: 'Filter by academic_status (enrolled, promoted, etc.)' })
  @IsOptional()
  @IsString()
  academicStatus?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  socialCategory?: string;

  @Field({ nullable: true })
  @IsOptional()
  isRteAdmitted?: boolean;

  @Field({ nullable: true, description: 'Filter by gender (joined from user_profiles)' })
  @IsOptional()
  @IsString()
  gender?: string;

  // ── Search ──────────────────────────────────────────────
  @Field({ nullable: true, description: 'Full-text search on name + admission number' })
  @IsOptional()
  @IsString()
  search?: string;
}
