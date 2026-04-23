import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard, InstituteScopeGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceSessionInput } from './dto/create-attendance-session.input';
import { BulkMarkAttendanceInput, MarkAttendanceInput } from './dto/mark-attendance.input';
import {
  AbsenteeReportItem,
  AttendanceEntryModel,
  AttendanceSessionModel,
  AttendanceStatusCount,
  SectionDailyBreakdown,
  StudentHistoryItem,
} from './models/attendance.model';
import type {
  AbsenteeReportRow,
  AttendanceEntryRecord,
  AttendanceSessionRecord,
  SectionDailyBreakdownRow,
  StudentHistoryRow,
} from './repositories/types';

@UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)
@Resolver(() => AttendanceSessionModel)
export class AttendanceResolver {
  constructor(private readonly service: AttendanceService) {}

  @Query(() => AttendanceSessionModel)
  @CheckAbility('read', 'Attendance')
  async attendanceSession(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AttendanceSessionRecord> {
    return this.service.findSession(id);
  }

  @Query(() => [AttendanceSessionModel])
  @CheckAbility('read', 'Attendance')
  async attendanceSessionsForSection(
    @Args('sectionId', { type: () => ID }) sectionId: string,
    @Args('startDate', { type: () => String }) startDate: string,
    @Args('endDate', { type: () => String }) endDate: string,
  ): Promise<AttendanceSessionRecord[]> {
    return this.service.findSessionsForSection(sectionId, startDate, endDate);
  }

  @Query(() => [AttendanceEntryModel])
  @CheckAbility('read', 'Attendance')
  async attendanceEntries(
    @Args('sessionId', { type: () => ID }) sessionId: string,
  ): Promise<AttendanceEntryRecord[]> {
    return this.service.findEntries(sessionId);
  }

  @Query(() => [AttendanceStatusCount])
  @CheckAbility('read', 'Attendance')
  async attendanceCounts(@Args('sessionId', { type: () => ID }) sessionId: string) {
    return this.service.counts(sessionId);
  }

  @Query(() => [AttendanceStatusCount])
  @CheckAbility('read', 'Attendance')
  async attendanceCountsForDate(@Args('date', { type: () => String }) date: string) {
    return this.service.countsForDate(date);
  }

  @Query(() => [AbsenteeReportItem], {
    description:
      'Per-student absentee report aggregated across sessions. Pass sectionId to scope to one section, or null for a tenant-wide report.',
  })
  @CheckAbility('read', 'Attendance')
  async attendanceAbsenteesReport(
    @Args('sectionId', { type: () => ID, nullable: true }) sectionId: string | null,
    @Args('startDate', { type: () => String }) startDate: string,
    @Args('endDate', { type: () => String }) endDate: string,
  ): Promise<AbsenteeReportRow[]> {
    return this.service.absenteesReport(sectionId, startDate, endDate);
  }

  @Query(() => [SectionDailyBreakdown], {
    description:
      'One row per attendance session on the given date — aggregate counts plus the list of ABSENT membership ids.',
  })
  @CheckAbility('read', 'Attendance')
  async attendanceSectionDailyBreakdown(
    @Args('date', { type: () => String }) date: string,
  ): Promise<SectionDailyBreakdownRow[]> {
    return this.service.sectionDailyBreakdown(date);
  }

  @Query(() => [StudentHistoryItem], {
    description:
      'Per-student attendance history — every mark for this student across the requested date range, newest first.',
  })
  @CheckAbility('read', 'Attendance')
  async attendanceStudentHistory(
    @Args('studentId', { type: () => ID }) studentId: string,
    @Args('startDate', { type: () => String }) startDate: string,
    @Args('endDate', { type: () => String }) endDate: string,
  ): Promise<StudentHistoryRow[]> {
    return this.service.studentHistory(studentId, startDate, endDate);
  }

  @Mutation(() => AttendanceSessionModel)
  @CheckAbility('create', 'Attendance')
  async openAttendanceSession(
    @Args('input') input: CreateAttendanceSessionInput,
  ): Promise<AttendanceSessionRecord> {
    return this.service.openSession(input);
  }

  @Mutation(() => AttendanceSessionModel, {
    description: 'Override an existing attendance session — replaces lecturer and/or subject.',
  })
  @CheckAbility('update', 'Attendance')
  async overrideAttendanceSession(
    @Args('sessionId', { type: () => ID }) sessionId: string,
    @Args('lecturerId', { type: () => ID }) lecturerId: string,
    @Args('subjectId', { type: () => ID, nullable: true }) subjectId: string | null,
  ): Promise<AttendanceSessionRecord> {
    return this.service.overrideSession(sessionId, lecturerId, subjectId);
  }

  @Mutation(() => AttendanceEntryModel, {
    description:
      'Mark a single student. For sessions older than today this throws ATTENDANCE_EDIT_WINDOW_CLOSED unless the caller supplies `overridePastDay: true` AND has the `manage` permission on Attendance (admins). Overrides are audited.',
  })
  @CheckAbility('update', 'Attendance')
  async markAttendance(
    @Args('input') input: MarkAttendanceInput,
    @Args('overridePastDay', { type: () => Boolean, nullable: true })
    overridePastDay: boolean | null,
    @Args('overrideReason', { type: () => String, nullable: true })
    overrideReason: string | null,
  ): Promise<AttendanceEntryRecord> {
    return this.service.markAttendance(input, {
      overridePastDay: overridePastDay ?? false,
      overrideReason,
    });
  }

  @Mutation(() => [AttendanceEntryModel], {
    description:
      'Bulk-mark a roster. Same past-day guard as markAttendance — admins must explicitly opt in with `overridePastDay: true`.',
  })
  @CheckAbility('update', 'Attendance')
  async bulkMarkAttendance(
    @Args('input') input: BulkMarkAttendanceInput,
    @Args('overridePastDay', { type: () => Boolean, nullable: true })
    overridePastDay: boolean | null,
    @Args('overrideReason', { type: () => String, nullable: true })
    overrideReason: string | null,
  ): Promise<AttendanceEntryRecord[]> {
    return this.service.bulkMark(input, {
      overridePastDay: overridePastDay ?? false,
      overrideReason,
    });
  }

  @Mutation(() => Boolean)
  @CheckAbility('delete', 'Attendance')
  async deleteAttendanceSession(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.service.deleteSession(id);
  }
}
