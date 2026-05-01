/**
 * Cross-tenant attendance roll-up for the platform admin portal.
 *
 * Runs a single aggregate query via `withAdmin` (BYPASSRLS so we can read
 * every institute's sessions) and emits one row per institute for the given
 * date. Institutes with zero sessions are omitted — the admin table shows
 * only tenants that actually recorded attendance.
 */
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, mkAdminCtx, withAdmin } from '@roviq/database';
import { sql } from 'drizzle-orm';

export interface AdminAttendanceSummaryRow {
  instituteId: string;
  instituteName: Record<string, string>;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  lateCount: number;
  sessionCount: number;
}

@Injectable()
export class AdminAttendanceService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  /**
   * Return one row per institute with attendance totals for `date`.
   * Ordered by institute name so the UI has a stable page order without a
   * client-side sort.
   */
  async summaryForDate(date: string): Promise<AdminAttendanceSummaryRow[]> {
    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const result = await tx.execute<{
        institute_id: string;
        institute_name: Record<string, string>;
        present_count: string | number;
        absent_count: string | number;
        leave_count: string | number;
        late_count: string | number;
        session_count: string | number;
      }>(
        sql`
          SELECT
            s.tenant_id AS institute_id,
            i.name AS institute_name,
            COUNT(e.id) FILTER (WHERE e.status = 'PRESENT') AS present_count,
            COUNT(e.id) FILTER (WHERE e.status = 'ABSENT') AS absent_count,
            COUNT(e.id) FILTER (WHERE e.status = 'LEAVE') AS leave_count,
            COUNT(e.id) FILTER (WHERE e.status = 'LATE') AS late_count,
            COUNT(DISTINCT s.id) AS session_count
          FROM attendance_sessions s
          INNER JOIN institutes i ON i.id = s.tenant_id
          LEFT JOIN attendance_entries e
            ON e.session_id = s.id AND e.deleted_at IS NULL
          WHERE s.date = ${date}::date
            AND s.deleted_at IS NULL
            AND i.deleted_at IS NULL
          GROUP BY s.tenant_id, i.name
          ORDER BY i.name->>'en' NULLS LAST
        `,
      );

      return result.rows.map((row) => ({
        instituteId: row.institute_id,
        instituteName: row.institute_name,
        presentCount: Number(row.present_count),
        absentCount: Number(row.absent_count),
        leaveCount: Number(row.leave_count),
        lateCount: Number(row.late_count),
        sessionCount: Number(row.session_count),
      }));
    });
  }
}
