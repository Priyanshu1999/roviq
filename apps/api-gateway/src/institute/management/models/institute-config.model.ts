import { Field, Float, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AttendanceType } from '@roviq/common-types';
import GraphQLJSON from 'graphql-type-json';

registerEnumType(AttendanceType, { name: 'AttendanceType' });

// ── Nested ObjectTypes ───────────────────────────────────────────────────────

@ObjectType()
export class ShiftConfigModel {
  @Field(() => String)
  name!: string;

  @Field(() => String)
  start!: string;

  @Field(() => String)
  end!: string;
}

@ObjectType()
export class TermConfigModel {
  @Field(() => String)
  label!: string;

  @Field(() => String)
  startDate!: string;

  @Field(() => String)
  endDate!: string;
}

@ObjectType()
export class SectionStrengthNormsModel {
  @Field(() => Float)
  optimal!: number;

  @Field(() => Float)
  hardMax!: number;

  @Field(() => Boolean)
  exemptionAllowed!: boolean;
}

@ObjectType()
export class AdmissionNumberConfigModel {
  @Field(() => String)
  format!: string;

  @Field(() => String, { name: 'yearFormat' })
  year_format!: string;

  @Field(() => GraphQLJSON)
  prefixes!: Record<string, string>;

  @Field(() => Float, { name: 'noPrefixFromClass' })
  no_prefix_from_class!: number;
}

// ── Main Config Model ────────────────────────────────────────────────────────

@ObjectType()
export class InstituteConfigModel {
  @Field(() => ID)
  id!: string;

  @Field(() => AttendanceType)
  attendanceType!: AttendanceType;

  @Field(() => String, { nullable: true })
  openingTime?: string | null;

  @Field(() => String, { nullable: true })
  closingTime?: string | null;

  @Field(() => [ShiftConfigModel], { nullable: true })
  shifts?: ShiftConfigModel[] | null;

  /** Dynamic notification preferences -- shape is user-defined */
  @Field(() => GraphQLJSON, { nullable: true })
  notificationPreferences?: Record<string, unknown> | null;

  /** Dynamic payroll configuration -- shape is user-defined */
  @Field(() => GraphQLJSON, { nullable: true })
  payrollConfig?: Record<string, unknown> | null;

  /** Dynamic grading system -- shape is user-defined */
  @Field(() => GraphQLJSON, { nullable: true })
  gradingSystem?: Record<string, unknown> | null;

  @Field(() => [TermConfigModel], { nullable: true })
  termStructure?: TermConfigModel[] | null;

  @Field(() => SectionStrengthNormsModel, { nullable: true })
  sectionStrengthNorms?: SectionStrengthNormsModel | null;

  @Field(() => AdmissionNumberConfigModel, { nullable: true })
  admissionNumberConfig?: AdmissionNumberConfigModel | null;
}
