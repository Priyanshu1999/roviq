import { Field, ID, ObjectType } from '@nestjs/graphql';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType({
  description: 'A subject node inside the admin academic-structure tree',
})
export class AcademicTreeSubjectNode {
  @Field(() => ID)
  id!: string;

  @Field(() => String, {
    description: 'Plain-text subject name (not i18n JSONB — subjects.name is text)',
  })
  name!: string;

  @Field(() => String, { nullable: true })
  shortName?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Board code (e.g. CBSE 041 for Mathematics)',
  })
  boardCode?: string | null;

  @Field(() => String, { description: 'Subject category — ACADEMIC, SPORT, LANGUAGE, …' })
  type!: string;
}

@ObjectType({ description: 'A section node inside the admin academic-structure tree' })
export class AcademicTreeSectionNode {
  @Field(() => ID)
  id!: string;

  @Field(() => I18nTextScalar)
  name!: Record<string, string>;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Optional stream config for 11th/12th (SCIENCE, COMMERCE, ARTS, NEP combos)',
  })
  stream?: Record<string, unknown> | null;
}

@ObjectType({ description: 'A standard (grade) node inside the admin academic-structure tree' })
export class AcademicTreeStandardNode {
  @Field(() => ID)
  id!: string;

  @Field(() => I18nTextScalar)
  name!: Record<string, string>;

  @Field(() => String, {
    nullable: true,
    description: 'Education level (PRIMARY, SECONDARY, …) this grade belongs to',
  })
  department?: string | null;

  @Field(() => [AcademicTreeSectionNode])
  sections!: AcademicTreeSectionNode[];

  @Field(() => [AcademicTreeSubjectNode])
  subjects!: AcademicTreeSubjectNode[];
}

@ObjectType({
  description:
    'Read-only tree of an institute\u2019s academic structure — standards → sections + subjects. Returned by adminGetInstituteAcademicTree. Admin-only view; institute portal owns CRUD.',
})
export class AcademicTreeModel {
  @Field(() => ID)
  instituteId!: string;

  @Field(() => String, {
    nullable: true,
    description:
      'Academic-year id this tree was snapshotted against (current active year when null)',
  })
  academicYearId?: string | null;

  @Field(() => [AcademicTreeStandardNode])
  standards!: AcademicTreeStandardNode[];
}
