import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { AcademicStatus, Gender, SocialCategory } from '@roviq/common-types';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

@InputType({ description: 'Filter + pagination input for listStudents (ROV-154)' })
export class StudentFilterInput {
  // ── Pagination ──────────────────────────────────────────
  @Field(() => Int, { nullable: true, defaultValue: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
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

  /**
   * Filter by one or more academic_status values. Multi-select lets
   * admins view e.g. ENROLLED + DETAINED in the same list.
   */
  @Field(() => [AcademicStatus], {
    nullable: true,
    description: 'Filter by academic_status (multi)',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AcademicStatus, { each: true })
  academicStatus?: AcademicStatus[];

  @Field(() => SocialCategory, { nullable: true })
  @IsOptional()
  @IsEnum(SocialCategory)
  socialCategory?: SocialCategory;

  @Field({ nullable: true })
  @IsOptional()
  isRteAdmitted?: boolean;

  @Field(() => Gender, { nullable: true })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  // ── Search ──────────────────────────────────────────────
  @Field({ nullable: true, description: 'Full-text search on name + admission number' })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Sort directive. Accepts `field:direction`, e.g. `admissionNumber:asc`,
   * `createdAt:desc`. Whitelisted columns only — see student.service list().
   */
  @Field({ nullable: true, description: 'Sort directive (e.g. admissionNumber:asc)' })
  @IsOptional()
  @IsString()
  orderBy?: string;
}
