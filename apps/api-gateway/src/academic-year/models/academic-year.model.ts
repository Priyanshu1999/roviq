import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AcademicYearStatus } from '@roviq/common-types';
import GraphQLJSON from 'graphql-type-json';
import { TermConfigModel } from '../../institute/management/models/institute-config.model';

registerEnumType(AcademicYearStatus, { name: 'AcademicYearStatus' });

@ObjectType()
export class AcademicYearModel {
  @Field(() => ID)
  id!: string;

  @Field()
  label!: string;

  @Field()
  startDate!: string;

  @Field()
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

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
