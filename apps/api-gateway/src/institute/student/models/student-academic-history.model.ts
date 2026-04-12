import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';

/**
 * Year-by-year academic record for a single student, used by the
 * "Academics" tab on the student detail page (ROV-167).
 *
 * This is a flattened read model that joins `student_academics` with the
 * resolved academic year, standard, and section labels so the frontend
 * doesn't have to issue cascading queries.
 */
@ObjectType({
  description: 'A single academic-year record for a student (year, class, section, roll number)',
})
export class StudentAcademicHistoryModel {
  /** student_academics.id — stable reference for section-change mutations. */
  @Field(() => ID)
  id!: string;

  @Field()
  studentProfileId!: string;

  @Field()
  academicYearId!: string;

  /** Label of the academic year, e.g. "2025–26". Free-form text. */
  @Field()
  academicYearLabel!: string;

  /** True when this row belongs to the institute's currently-active year. */
  @Field()
  isCurrentYear!: boolean;

  @Field(() => String, { nullable: true })
  standardId?: string | null;

  @Field(() => I18nTextScalar, { nullable: true })
  standardName?: I18nContent | null;

  @Field(() => String, { nullable: true })
  sectionId?: string | null;

  @Field(() => I18nTextScalar, { nullable: true })
  sectionName?: I18nContent | null;

  @Field(() => String, { nullable: true })
  rollNumber?: string | null;

  /**
   * Promotion status for this academic record
   * (enrolled/promoted/detained/…). Nullable — only populated after the
   * student leaves this year (promoted, detained, etc.).
   */
  @Field(() => String, { nullable: true })
  promotionStatus?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
