/**
 * Platform-admin cross-tenant attendance roll-up.
 *
 * One row per institute for the requested date: session count + counts per
 * attendance status. Frontend combines presentCount/absentCount to compute the
 * attendance percentage. Institute name is returned as an `I18nText` blob so
 * the frontend resolves the locale (same policy as every other i18n field —
 * resolvers never pick a locale).
 */
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { I18nTextScalar } from '@roviq/nestjs-graphql';

@ObjectType({
  description:
    'Per-institute attendance totals for a single date, aggregated across every attendance session in the tenant.',
})
export class AdminAttendanceSummaryModel {
  @Field(() => ID)
  instituteId!: string;

  @Field(() => I18nTextScalar, {
    description: 'Full i18n blob for the institute name — frontend picks the locale.',
  })
  instituteName!: Record<string, string>;

  @Field(() => Int, { description: 'Number of PRESENT attendance entries across all sessions.' })
  presentCount!: number;

  @Field(() => Int, { description: 'Number of ABSENT attendance entries across all sessions.' })
  absentCount!: number;

  @Field(() => Int, { description: 'Number of LEAVE attendance entries across all sessions.' })
  leaveCount!: number;

  @Field(() => Int, { description: 'Number of LATE attendance entries across all sessions.' })
  lateCount!: number;

  @Field(() => Int, {
    description: 'Total number of attendance sessions recorded for the institute on this date.',
  })
  sessionCount!: number;
}
