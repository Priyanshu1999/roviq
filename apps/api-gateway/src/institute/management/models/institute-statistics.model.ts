import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Grouped count entry for statistics charts (status→count, type→count)' })
export class KeyCountEntry {
  @Field({ description: 'Grouping key (e.g. ACTIVE, SCHOOL)' })
  key!: string;

  @Field(() => Int, { description: 'Number of institutes in this group' })
  count!: number;
}

@ObjectType({ description: 'Per-reseller institute count' })
export class ResellerInstituteCount {
  @Field()
  resellerId!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType({ description: 'Aggregate institute statistics for dashboard charts' })
export class InstituteStatisticsModel {
  @Field(() => Int)
  totalInstitutes!: number;

  @Field(() => [KeyCountEntry], { description: 'Institute count grouped by InstituteStatus' })
  byStatus!: KeyCountEntry[];

  @Field(() => [KeyCountEntry], {
    nullable: true,
    description: 'Institute count grouped by InstituteType (admin scope only)',
  })
  byType?: KeyCountEntry[];

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
