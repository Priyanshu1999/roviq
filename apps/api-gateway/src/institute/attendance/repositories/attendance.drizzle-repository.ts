import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  attendanceEntries,
  attendanceSessions,
  DRIZZLE_DB,
  type DrizzleDB,
  sections,
  softDelete,
  withTenant,
} from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { and, between, count, eq, isNull, sql } from 'drizzle-orm';
import { AttendanceRepository } from './attendance.repository';
import type {
  AbsenteeReportRow,
  AbsenteesReportQuery,
  AttendanceEntryRecord,
  AttendanceSessionRecord,
  CreateSessionData,
  SectionDailyBreakdownRow,
  SessionDateRangeQuery,
  SessionQuery,
  StudentHistoryQuery,
  StudentHistoryRow,
  UpsertEntryData,
} from './types';

const sessionColumns = {
  id: attendanceSessions.id,
  tenantId: attendanceSessions.tenantId,
  sectionId: attendanceSessions.sectionId,
  academicYearId: attendanceSessions.academicYearId,
  date: attendanceSessions.date,
  period: attendanceSessions.period,
  subjectId: attendanceSessions.subjectId,
  lecturerId: attendanceSessions.lecturerId,
  overrideCheck: attendanceSessions.overrideCheck,
  createdAt: attendanceSessions.createdAt,
  updatedAt: attendanceSessions.updatedAt,
} as const;

const entryColumns = {
  id: attendanceEntries.id,
  tenantId: attendanceEntries.tenantId,
  sessionId: attendanceEntries.sessionId,
  studentId: attendanceEntries.studentId,
  status: attendanceEntries.status,
  mode: attendanceEntries.mode,
  remarks: attendanceEntries.remarks,
  markedAt: attendanceEntries.markedAt,
  createdAt: attendanceEntries.createdAt,
  updatedAt: attendanceEntries.updatedAt,
} as const;

@Injectable()
export class AttendanceDrizzleRepository extends AttendanceRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  private getTenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context is required');
    return tenantId;
  }

  async findSessionById(id: string): Promise<AttendanceSessionRecord | null> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .select(sessionColumns)
        .from(attendanceSessions)
        .where(and(eq(attendanceSessions.id, id), isNull(attendanceSessions.deletedAt)));
      return (rows[0] as AttendanceSessionRecord | undefined) ?? null;
    });
  }

  async findSession(query: SessionQuery): Promise<AttendanceSessionRecord | null> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const periodCondition =
        query.period === undefined || query.period === null
          ? isNull(attendanceSessions.period)
          : eq(attendanceSessions.period, query.period);
      const rows = await tx
        .select(sessionColumns)
        .from(attendanceSessions)
        .where(
          and(
            eq(attendanceSessions.sectionId, query.sectionId),
            eq(attendanceSessions.date, query.date),
            periodCondition,
            isNull(attendanceSessions.deletedAt),
          ),
        );
      return (rows[0] as AttendanceSessionRecord | undefined) ?? null;
    });
  }

  async findSessionsInRange(query: SessionDateRangeQuery): Promise<AttendanceSessionRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const conditions = [
        between(attendanceSessions.date, query.startDate, query.endDate),
        isNull(attendanceSessions.deletedAt),
      ];
      if (query.sectionId) conditions.push(eq(attendanceSessions.sectionId, query.sectionId));
      return tx
        .select(sessionColumns)
        .from(attendanceSessions)
        .where(and(...conditions)) as Promise<AttendanceSessionRecord[]>;
    });
  }

  async createSession(data: CreateSessionData): Promise<AttendanceSessionRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .insert(attendanceSessions)
        .values({
          tenantId,
          sectionId: data.sectionId,
          academicYearId: data.academicYearId,
          date: data.date,
          period: data.period ?? null,
          subjectId: data.subjectId ?? null,
          lecturerId: data.lecturerId,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning(sessionColumns);
      return rows[0] as AttendanceSessionRecord;
    });
  }

  async assignLecturer(sessionId: string, lecturerId: string): Promise<AttendanceSessionRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(attendanceSessions)
        .set({ lecturerId, updatedBy: userId })
        .where(and(eq(attendanceSessions.id, sessionId), isNull(attendanceSessions.deletedAt)))
        .returning(sessionColumns);
      if (rows.length === 0)
        throw new NotFoundException(`Attendance session ${sessionId} not found`);
      return rows[0] as AttendanceSessionRecord;
    });
  }

  async setSubject(sessionId: string, subjectId: string | null): Promise<AttendanceSessionRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(attendanceSessions)
        .set({ subjectId, updatedBy: userId })
        .where(and(eq(attendanceSessions.id, sessionId), isNull(attendanceSessions.deletedAt)))
        .returning(sessionColumns);
      if (rows.length === 0)
        throw new NotFoundException(`Attendance session ${sessionId} not found`);
      return rows[0] as AttendanceSessionRecord;
    });
  }

  async findEntriesBySession(sessionId: string): Promise<AttendanceEntryRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select(entryColumns)
        .from(attendanceEntries)
        .where(
          and(eq(attendanceEntries.sessionId, sessionId), isNull(attendanceEntries.deletedAt)),
        ) as Promise<AttendanceEntryRecord[]>;
    });
  }

  async findEntry(sessionId: string, studentId: string): Promise<AttendanceEntryRecord | null> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .select(entryColumns)
        .from(attendanceEntries)
        .where(
          and(
            eq(attendanceEntries.sessionId, sessionId),
            eq(attendanceEntries.studentId, studentId),
            isNull(attendanceEntries.deletedAt),
          ),
        );
      return (rows[0] as AttendanceEntryRecord | undefined) ?? null;
    });
  }

  async bulkInsertEntries(
    entries: Array<Omit<UpsertEntryData, 'sessionId'> & { sessionId: string }>,
  ): Promise<AttendanceEntryRecord[]> {
    if (entries.length === 0) return [];
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      return tx
        .insert(attendanceEntries)
        .values(
          entries.map((entry) => ({
            tenantId,
            sessionId: entry.sessionId,
            studentId: entry.studentId,
            status: entry.status,
            mode: entry.mode ?? 'MANUAL',
            remarks: entry.remarks ?? null,
            createdBy: userId,
            updatedBy: userId,
          })),
        )
        .returning(entryColumns) as Promise<AttendanceEntryRecord[]>;
    });
  }

  async upsertEntry(data: UpsertEntryData): Promise<AttendanceEntryRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const existing = await tx
        .select(entryColumns)
        .from(attendanceEntries)
        .where(
          and(
            eq(attendanceEntries.sessionId, data.sessionId),
            eq(attendanceEntries.studentId, data.studentId),
            isNull(attendanceEntries.deletedAt),
          ),
        );

      if (existing.length > 0) {
        const rows = await tx
          .update(attendanceEntries)
          .set({
            status: data.status,
            ...(data.mode !== undefined && { mode: data.mode }),
            ...(data.remarks !== undefined && { remarks: data.remarks }),
            markedAt: new Date(),
            updatedBy: userId,
          })
          .where(
            and(
              eq(attendanceEntries.id, (existing[0] as AttendanceEntryRecord).id),
              isNull(attendanceEntries.deletedAt),
            ),
          )
          .returning(entryColumns);
        return rows[0] as AttendanceEntryRecord;
      }

      const rows = await tx
        .insert(attendanceEntries)
        .values({
          tenantId,
          sessionId: data.sessionId,
          studentId: data.studentId,
          status: data.status,
          mode: data.mode ?? 'MANUAL',
          remarks: data.remarks ?? null,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning(entryColumns);
      return rows[0] as AttendanceEntryRecord;
    });
  }

  async countByStatus(sessionId: string): Promise<Record<string, number>> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .select({
          status: attendanceEntries.status,
          count: count(),
        })
        .from(attendanceEntries)
        .where(and(eq(attendanceEntries.sessionId, sessionId), isNull(attendanceEntries.deletedAt)))
        .groupBy(attendanceEntries.status);
      return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
    });
  }

  async countForDate(date: string): Promise<Record<string, number>> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .select({
          status: attendanceEntries.status,
          count: count(),
        })
        .from(attendanceEntries)
        .innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceEntries.sessionId))
        .where(
          and(
            sql`${attendanceSessions.date} = ${date}::date`,
            isNull(attendanceEntries.deletedAt),
            isNull(attendanceSessions.deletedAt),
          ),
        )
        .groupBy(attendanceEntries.status);
      return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
    });
  }

  async absenteesReport(query: AbsenteesReportQuery): Promise<AbsenteeReportRow[]> {
    const tenantId = this.getTenantId();
    const { sectionId, startDate, endDate } = query;
    // section filter is optional; we emit the predicate conditionally via sql fragments.
    const sectionFilter = sectionId ? sql`AND s.section_id = ${sectionId}::uuid` : sql``;

    return withTenant(this.db, tenantId, async (tx) => {
      const result = await tx.execute<{
        student_id: string;
        total_sessions: string | number;
        present_count: string | number;
        absent_count: string | number;
        leave_count: string | number;
        late_count: string | number;
        absent_dates: string[] | null;
      }>(
        sql`
          SELECT
            e.student_id AS student_id,
            COUNT(*) AS total_sessions,
            COUNT(*) FILTER (WHERE e.status = 'PRESENT') AS present_count,
            COUNT(*) FILTER (WHERE e.status = 'ABSENT') AS absent_count,
            COUNT(*) FILTER (WHERE e.status = 'LEAVE') AS leave_count,
            COUNT(*) FILTER (WHERE e.status = 'LATE') AS late_count,
            COALESCE(
              array_agg(DISTINCT to_char(s.date, 'YYYY-MM-DD') ORDER BY to_char(s.date, 'YYYY-MM-DD'))
                FILTER (WHERE e.status = 'ABSENT'),
              ARRAY[]::text[]
            ) AS absent_dates
          FROM ${attendanceSessions} s
          INNER JOIN ${attendanceEntries} e ON e.session_id = s.id
          WHERE s.date BETWEEN ${startDate}::date AND ${endDate}::date
            AND s.deleted_at IS NULL
            AND e.deleted_at IS NULL
            ${sectionFilter}
          GROUP BY e.student_id
          ORDER BY e.student_id
        `,
      );

      return result.rows.map((row) => ({
        studentId: row.student_id,
        totalSessions: Number(row.total_sessions),
        presentCount: Number(row.present_count),
        absentCount: Number(row.absent_count),
        leaveCount: Number(row.leave_count),
        lateCount: Number(row.late_count),
        absentDates: row.absent_dates ?? [],
      }));
    });
  }

  async sectionDailyBreakdown(date: string): Promise<SectionDailyBreakdownRow[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const result = await tx.execute<{
        session_id: string;
        section_id: string;
        section_name: Record<string, string> | null;
        period: number | null;
        subject_id: string | null;
        lecturer_id: string;
        present_count: string | number;
        absent_count: string | number;
        leave_count: string | number;
        late_count: string | number;
        absentee_ids: string[] | null;
      }>(
        sql`
          SELECT
            s.id AS session_id,
            s.section_id AS section_id,
            sec.name AS section_name,
            s.period AS period,
            s.subject_id AS subject_id,
            s.lecturer_id AS lecturer_id,
            COUNT(e.id) FILTER (WHERE e.status = 'PRESENT') AS present_count,
            COUNT(e.id) FILTER (WHERE e.status = 'ABSENT') AS absent_count,
            COUNT(e.id) FILTER (WHERE e.status = 'LEAVE') AS leave_count,
            COUNT(e.id) FILTER (WHERE e.status = 'LATE') AS late_count,
            COALESCE(
              array_agg(e.student_id) FILTER (WHERE e.status = 'ABSENT'),
              ARRAY[]::uuid[]
            ) AS absentee_ids
          FROM ${attendanceSessions} s
          LEFT JOIN ${attendanceEntries} e
            ON e.session_id = s.id AND e.deleted_at IS NULL
          INNER JOIN ${sections} sec
            ON sec.id = s.section_id AND sec.deleted_at IS NULL
          WHERE s.date = ${date}::date
            AND s.deleted_at IS NULL
          GROUP BY s.id, s.section_id, sec.name, s.period, s.subject_id, s.lecturer_id
          ORDER BY s.section_id, s.period NULLS FIRST
        `,
      );

      return result.rows.map((row) => ({
        sessionId: row.session_id,
        sectionId: row.section_id,
        sectionName: row.section_name ?? {},
        period: row.period,
        subjectId: row.subject_id,
        lecturerId: row.lecturer_id,
        presentCount: Number(row.present_count),
        absentCount: Number(row.absent_count),
        leaveCount: Number(row.leave_count),
        lateCount: Number(row.late_count),
        absenteeIds: row.absentee_ids ?? [],
      }));
    });
  }

  async studentHistory(query: StudentHistoryQuery): Promise<StudentHistoryRow[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const result = await tx.execute<{
        session_id: string;
        section_id: string;
        date: string;
        period: number | null;
        subject_id: string | null;
        status: string;
        remarks: string | null;
        marked_at: Date;
      }>(
        sql`
          SELECT
            s.id AS session_id,
            s.section_id AS section_id,
            s.date AS date,
            s.period AS period,
            s.subject_id AS subject_id,
            e.status AS status,
            e.remarks AS remarks,
            e.marked_at AS marked_at
          FROM ${attendanceEntries} e
          INNER JOIN ${attendanceSessions} s ON s.id = e.session_id
          WHERE e.student_id = ${query.studentId}::uuid
            AND s.date BETWEEN ${query.startDate}::date AND ${query.endDate}::date
            AND e.deleted_at IS NULL
            AND s.deleted_at IS NULL
          ORDER BY s.date DESC, s.period NULLS FIRST
        `,
      );
      return result.rows.map((row) => ({
        sessionId: row.session_id,
        sectionId: row.section_id,
        date: typeof row.date === 'string' ? row.date : String(row.date),
        period: row.period,
        subjectId: row.subject_id,
        status: row.status,
        remarks: row.remarks,
        markedAt: row.marked_at,
      }));
    });
  }

  async softDeleteSession(id: string): Promise<void> {
    const tenantId = this.getTenantId();
    await withTenant(this.db, tenantId, async (tx) => {
      await softDelete(tx, attendanceSessions, id);
    });
  }
}
