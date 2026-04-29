/**
 * Platform-admin GraphQL surface for cross-tenant attendance.
 *
 * One query that rolls up every institute's attendance for a single date.
 * Gated by `read:Attendance` — platform_admin has `manage:all`, which grants
 * it, so no new CASL seed entry is required.
 */
import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard, PlatformScopeGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { AdminAttendanceService } from './admin-attendance.service';
import { AdminAttendanceSummaryModel } from './models/admin-attendance-summary.model';

@UseGuards(GqlAuthGuard, PlatformScopeGuard, AbilityGuard)
@Resolver(() => AdminAttendanceSummaryModel)
export class AdminAttendanceResolver {
  constructor(private readonly service: AdminAttendanceService) {}

  @Query(() => [AdminAttendanceSummaryModel], {
    description:
      'Platform admin: cross-tenant attendance roll-up for a single date. One row per institute with totals for each status + session count.',
  })
  @CheckAbility('read', 'Attendance')
  async adminAttendanceSummary(
    @Args('date', { type: () => String, description: 'ISO YYYY-MM-DD date to roll up.' })
    date: string,
  ): Promise<AdminAttendanceSummaryModel[]> {
    return this.service.summaryForDate(date);
  }
}
