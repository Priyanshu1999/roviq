import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { AcademicStatus, AttendanceStatus } from '@roviq/common-types';
import { HolidayService } from '../holiday/holiday.service';
import { LeaveService } from '../leave/leave.service';
import { StudentService } from '../student/student.service';
import type { CreateAttendanceSessionInput } from './dto/create-attendance-session.input';
import type { BulkMarkAttendanceInput, MarkAttendanceInput } from './dto/mark-attendance.input';
import { AttendanceRepository } from './repositories/attendance.repository';
import type {
  AbsenteeReportRow,
  AttendanceEntryRecord,
  AttendanceSessionRecord,
  SectionDailyBreakdownRow,
  StudentHistoryRow,
} from './repositories/types';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly repo: AttendanceRepository,
    private readonly studentService: StudentService,
    private readonly leaveService: LeaveService,
    private readonly holidayService: HolidayService,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

  async findSession(id: string): Promise<AttendanceSessionRecord> {
    const session = await this.repo.findSessionById(id);
    if (!session) throw new NotFoundException(`Attendance session ${id} not found`);
    return session;
  }

  async findEntries(sessionId: string): Promise<AttendanceEntryRecord[]> {
    await this.findSession(sessionId);
    return this.repo.findEntriesBySession(sessionId);
  }

  async findSessionsForSection(
    sectionId: string,
    startDate: string,
    endDate: string,
  ): Promise<AttendanceSessionRecord[]> {
    return this.repo.findSessionsInRange({ sectionId, startDate, endDate });
  }

  async openSession(input: CreateAttendanceSessionInput): Promise<AttendanceSessionRecord> {
    const existing = await this.repo.findSession({
      sectionId: input.sectionId,
      date: input.date,
      period: input.period ?? null,
    });

    if (existing) {
      if (existing.lecturerId !== input.lecturerId) {
        throw new ConflictException(
          `Attendance for this slot already taken by another lecturer. Override required.`,
        );
      }
      return existing;
    }

    // Refuse to open a session on a declared holiday. This runs *after* the
    // idempotence check so re-opening an already-existing session on what
    // later became a holiday still returns the existing record. Admin
    // override is intentionally out of scope — keep it strict.
    const holidaysOnDate = await this.holidayService.onDate(input.date);
    if (holidaysOnDate.length > 0) {
      const holidayNames = holidaysOnDate
        .map((h) => h.name.en ?? Object.values(h.name)[0] ?? 'unnamed')
        .join(', ');
      throw new ConflictException(`ATTENDANCE_ON_HOLIDAY: ${holidayNames}`);
    }

    const session = await this.repo.createSession({
      sectionId: input.sectionId,
      academicYearId: input.academicYearId,
      date: input.date,
      period: input.period ?? null,
      subjectId: input.subjectId ?? null,
      lecturerId: input.lecturerId,
    });

    // Auto-seed: every active student of the section starts PRESENT (or
    // LEAVE if an approved leave covers this date). Teachers then only have
    // to flip absentees / latecomers. Mirrors the paper-register workflow.
    await this.seedPresentEntries(session.id, input.sectionId, session.date);

    this.emitEvent('ATTENDANCE_SESSION.opened', {
      sessionId: session.id,
      tenantId: session.tenantId,
      sectionId: session.sectionId,
      date: session.date,
      period: session.period,
    });

    return session;
  }

  private async seedPresentEntries(
    sessionId: string,
    sectionId: string,
    date: string,
  ): Promise<void> {
    // Paginate defensively in case a section grows beyond 1000 students.
    const PAGE_SIZE = 1000;
    const membershipIds: string[] = [];
    let after: string | undefined;
    // Loop guard — even a huge tenant should finish in a handful of pages.
    for (let i = 0; i < 20; i++) {
      const page = await this.studentService.list({
        sectionId,
        first: PAGE_SIZE,
        after,
        academicStatus: [AcademicStatus.ENROLLED],
      });
      for (const edge of page.edges) {
        if (edge.node.membershipId) membershipIds.push(edge.node.membershipId);
      }
      if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break;
      after = page.pageInfo.endCursor;
    }

    if (membershipIds.length === 0) return;

    // Pull the set of students with an APPROVED leave covering this date so
    // we seed them as LEAVE — matches the paper-register workflow where the
    // teacher sees absentees pre-marked.
    const onLeave = new Set(await this.leaveService.approvedOnDate(date, membershipIds));

    await this.repo.bulkInsertEntries(
      membershipIds.map((studentId) => ({
        sessionId,
        studentId,
        status: onLeave.has(studentId) ? AttendanceStatus.LEAVE : AttendanceStatus.PRESENT,
      })),
    );
  }

  async overrideSession(
    sessionId: string,
    lecturerId: string,
    subjectId: string | null,
  ): Promise<AttendanceSessionRecord> {
    const session = await this.findSession(sessionId);
    const lecturerChanged = session.lecturerId !== lecturerId;
    const subjectChanged = (session.subjectId ?? null) !== (subjectId ?? null);

    if (!lecturerChanged && !subjectChanged) return session;

    const withLecturer = lecturerChanged
      ? await this.repo.assignLecturer(sessionId, lecturerId)
      : session;

    const result = subjectChanged
      ? await this.repo.setSubject(sessionId, subjectId ?? null)
      : withLecturer;

    this.emitEvent('ATTENDANCE_SESSION.overridden', {
      sessionId: result.id,
      tenantId: result.tenantId,
      newLecturerId: result.lecturerId,
      newSubjectId: result.subjectId,
    });

    return result;
  }

  async markAttendance(
    input: MarkAttendanceInput,
    opts: { overridePastDay?: boolean; overrideReason?: string | null } = {},
  ): Promise<AttendanceEntryRecord> {
    const session = await this.findSession(input.sessionId);
    const past = this.isPastDate(session.date);
    if (past && !opts.overridePastDay) {
      throw new ForbiddenException(
        'ATTENDANCE_EDIT_WINDOW_CLOSED: attendance for past dates can only be edited with explicit admin override.',
      );
    }
    const entry = await this.repo.upsertEntry({
      sessionId: input.sessionId,
      studentId: input.studentId,
      status: input.status,
      mode: input.mode,
      remarks: input.remarks,
    });
    this.emitEvent('ATTENDANCE_ENTRY.marked', {
      entryId: entry.id,
      sessionId: entry.sessionId,
      tenantId: entry.tenantId,
      studentId: entry.studentId,
      status: entry.status,
    });
    if (past) {
      // Distinct auditable event — admin edits to past-day attendance are
      // consumed by the audit pipeline.
      this.emitEvent('ATTENDANCE_ENTRY.past_day_edited', {
        entryId: entry.id,
        sessionId: entry.sessionId,
        tenantId: entry.tenantId,
        studentId: entry.studentId,
        status: entry.status,
        sessionDate: session.date,
        reason: opts.overrideReason ?? null,
      });
    }
    if (entry.status === 'ABSENT' || entry.status === 'LATE') {
      // Fires a guardian-facing Novu workflow via notification-service.
      // Subject name matches NOTIFICATION_SUBJECTS.ATTENDANCE_ABSENT in
      // @roviq/notifications so the existing listener + Novu workflow pick
      // this up without a catalog change.
      //
      // AT-003: enrich the payload with student/section/standard names so
      // guardians get human-readable copy ("Aarav was absent from 7-A on
      // 2026-04-29") instead of a membership id. Producer already has the
      // joined student row at hand via studentService.
      const display = await this.resolveAbsenceDisplay(entry.studentId).catch((err) => {
        this.logger.warn(
          `Failed to resolve absence display for ${entry.studentId}: ${(err as Error).message}`,
        );
        return null;
      });
      this.emitEvent('NOTIFICATION.attendance.absent', {
        tenantId: entry.tenantId,
        sessionId: entry.sessionId,
        studentId: entry.studentId,
        status: entry.status,
        remarks: entry.remarks,
        markedAt: entry.markedAt.toISOString(),
        sessionDate: session.date,
        studentName: display?.studentName ?? null,
        sectionName: display?.sectionName ?? null,
        standardName: display?.standardName ?? null,
      });
    }
    return entry;
  }

  async bulkMark(
    input: BulkMarkAttendanceInput,
    opts: { overridePastDay?: boolean; overrideReason?: string | null } = {},
  ): Promise<AttendanceEntryRecord[]> {
    const session = await this.findSession(input.sessionId);
    const past = this.isPastDate(session.date);
    if (past && !opts.overridePastDay) {
      throw new ForbiddenException(
        'ATTENDANCE_EDIT_WINDOW_CLOSED: attendance for past dates can only be edited with explicit admin override.',
      );
    }
    const results: AttendanceEntryRecord[] = [];
    for (const item of input.entries) {
      const entry = await this.repo.upsertEntry({
        sessionId: input.sessionId,
        studentId: item.studentId,
        status: item.status,
        mode: item.mode,
        remarks: item.remarks,
      });
      results.push(entry);
    }
    this.emitEvent('ATTENDANCE_SESSION.bulk_marked', {
      sessionId: input.sessionId,
      count: results.length,
    });
    if (past) {
      this.emitEvent('ATTENDANCE_SESSION.past_day_bulk_edited', {
        sessionId: input.sessionId,
        tenantId: session.tenantId,
        sessionDate: session.date,
        count: results.length,
        reason: opts.overrideReason ?? null,
      });
    }
    return results;
  }

  async counts(sessionId: string) {
    await this.findSession(sessionId);
    const byStatus = await this.repo.countByStatus(sessionId);
    return Object.entries(byStatus).map(([status, count]) => ({ status, count }));
  }

  async countsForDate(date: string) {
    const byStatus = await this.repo.countForDate(date);
    return Object.entries(byStatus).map(([status, count]) => ({ status, count }));
  }

  async absenteesReport(
    sectionId: string | null,
    startDate: string,
    endDate: string,
  ): Promise<AbsenteeReportRow[]> {
    return this.repo.absenteesReport({ sectionId, startDate, endDate });
  }

  async sectionDailyBreakdown(date: string): Promise<SectionDailyBreakdownRow[]> {
    return this.repo.sectionDailyBreakdown(date);
  }

  async studentHistory(
    studentId: string,
    startDate: string,
    endDate: string,
  ): Promise<StudentHistoryRow[]> {
    return this.repo.studentHistory({ studentId, startDate, endDate });
  }

  async deleteSession(id: string): Promise<boolean> {
    await this.repo.softDeleteSession(id);
    this.emitEvent('ATTENDANCE_SESSION.deleted', { sessionId: id });
    return true;
  }

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }

  /**
   * Compare a session's ISO `YYYY-MM-DD` date against today in UTC. We treat
   * "today" inclusively — edits made during the same calendar day are always
   * allowed. Past-day edits hit the admin-override code path.
   */
  private isPastDate(sessionDate: string): boolean {
    const today = new Date();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(today.getUTCDate()).padStart(2, '0');
    const todayIso = `${yyyy}-${mm}-${dd}`;
    return sessionDate < todayIso;
  }

  /**
   * AT-003: resolve display fields for an absence event from the joined
   * student detail. Falls back to nulls (and the listener falls back to the
   * membership id) if the student lookup fails — emission must not block
   * notification delivery on display-name resolution.
   */
  private async resolveAbsenceDisplay(membershipId: string): Promise<{
    studentName: string | null;
    sectionName: string | null;
    standardName: string | null;
  } | null> {
    // `studentService.list` returns the joined student detail (incl. firstName,
    // currentStandardName, currentSectionName) keyed off membership ids. We
    // call `findById` on the studentProfileId once we have it. The repo path
    // is read-only.
    const student = await this.studentService.findByMembershipId(membershipId);
    if (!student) return null;
    const firstName = student.firstName?.en ?? Object.values(student.firstName ?? {})[0] ?? null;
    const lastName = student.lastName?.en ?? Object.values(student.lastName ?? {})[0] ?? null;
    const standard =
      student.currentStandardName?.en ??
      Object.values(student.currentStandardName ?? {})[0] ??
      null;
    const section =
      student.currentSectionName?.en ?? Object.values(student.currentSectionName ?? {})[0] ?? null;
    return {
      studentName: [firstName, lastName].filter(Boolean).join(' ').trim() || null,
      sectionName: section,
      standardName: standard,
    };
  }
}
