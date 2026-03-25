import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class StatusCount {
  @Field()
  status!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class SectionCount {
  @Field()
  sectionId!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class StandardCount {
  @Field()
  standardId!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class GenderCount {
  @Field()
  gender!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class CategoryCount {
  @Field()
  category!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType({ description: 'Aggregate student statistics for the current institute (ROV-154)' })
export class StudentStatisticsModel {
  @Field(() => Int)
  total!: number;

  @Field(() => [StatusCount])
  byStatus!: StatusCount[];

  @Field(() => [SectionCount])
  bySection!: SectionCount[];

  @Field(() => [StandardCount])
  byStandard!: StandardCount[];

  @Field(() => [GenderCount])
  byGender!: GenderCount[];

  @Field(() => [CategoryCount])
  byCategory!: CategoryCount[];
}
