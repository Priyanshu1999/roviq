import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class FunnelStage {
  @Field()
  stage!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class SourceBreakdown {
  @Field()
  source!: string;

  @Field(() => Int)
  enquiryCount!: number;

  @Field(() => Int)
  applicationCount!: number;
}

@ObjectType({ description: 'Admission funnel statistics (ROV-159)' })
export class AdmissionStatisticsModel {
  @Field(() => Int)
  totalEnquiries!: number;

  @Field(() => Int)
  totalApplications!: number;

  @Field(() => [FunnelStage], { description: 'Funnel counts at each stage' })
  funnel!: FunnelStage[];

  @Field(() => [SourceBreakdown], { description: 'Breakdown by enquiry source' })
  bySource!: SourceBreakdown[];

  /** Enquiry → Application conversion rate (0-1) */
  @Field(() => Float)
  enquiryToApplicationRate!: number;

  /** Application → Enrolled conversion rate (0-1) */
  @Field(() => Float)
  applicationToEnrolledRate!: number;
}
