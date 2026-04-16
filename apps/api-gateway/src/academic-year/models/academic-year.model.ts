import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AcademicYearStatus } from '@roviq/common-types';
import { DateOnlyScalar, DateTimeScalar } from '@roviq/nestjs-graphql';
import GraphQLJSON from 'graphql-type-json';
import { TermConfigModel } from '../../institute/management/models/institute-config.model';

registerEnumType(AcademicYearStatus, { name: 'AcademicYearStatus' });

@ObjectType()
export class AcademicYearModel {
  @Field(() => ID)
  id!: string;

  @Field({
    description:
      'Academic-year label in YYYY-YY format (e.g. 2025-26). Leading 4 digits = start year; trailing 2 digits = end year mod 100.',
  })
  label!: string;

  @Field(() => DateOnlyScalar)
  startDate!: string;

  @Field(() => DateOnlyScalar)
  endDate!: string;

  @Field()
  isActive!: boolean;

  @Field(() => AcademicYearStatus)
  status!: AcademicYearStatus;

  @Field(() => [TermConfigModel], {
    nullable: true,
    description: 'Term/semester breakdown for this year',
  })
  termStructure?: TermConfigModel[];

  /** Board exam dates keyed by board name — dynamic keys, kept as JSON */
  @Field(() => GraphQLJSON, { nullable: true, description: 'Board exam dates keyed by board name' })
  boardExamDates?: Record<string, unknown>;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;
}
