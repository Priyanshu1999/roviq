import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AcademicYearStatus } from '@roviq/common-types';
import GraphQLJSON from 'graphql-type-json';

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

  @Field(() => GraphQLJSON, { nullable: true })
  termStructure?: unknown[];

  @Field(() => GraphQLJSON, { nullable: true })
  boardExamDates?: Record<string, unknown>;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
