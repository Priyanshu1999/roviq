import { Field, Int, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType({ description: 'Per-reseller institute count' })
export class ResellerInstituteCount {
  @Field()
  resellerId!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType({ description: 'Aggregate institute statistics' })
export class InstituteStatisticsModel {
  @Field(() => Int)
  totalInstitutes!: number;

  @Field(() => GraphQLJSON, { description: 'Institute count keyed by status' })
  byStatus!: Record<string, number>;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Institute count keyed by type (admin scope only)',
  })
  byType?: Record<string, number>;

  @Field(() => [ResellerInstituteCount], {
    nullable: true,
    description: 'Institute count per reseller (admin scope only)',
  })
  byReseller?: ResellerInstituteCount[];

  @Field(() => Int, {
    nullable: true,
    description: 'Institutes created in the last 30 days (admin scope only)',
  })
  recentlyCreated?: number;
}
