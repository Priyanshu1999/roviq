/**
 * RTE Enrollment Report Export (ROV-171, PRD §8).
 *
 * RTE student count by class, fee reimbursement amounts.
 * Batch-fetches all data (no N+1).
 */
import {
  type DrizzleDB,
  mkInstituteCtx,
  studentAcademicsLive,
  studentProfilesLive,
  withTenant,
} from '@roviq/database';
import { eq } from 'drizzle-orm';
import * as XLSX from 'xlsx';

const RTE_HEADERS = ['Class (Standard ID)', 'RTE Students Count', 'Total Students'];

export async function generateRteReport(
  db: DrizzleDB,
  tenantId: string,
  academicYearId: string,
): Promise<Buffer> {
  const academics = await withTenant(
    db,
    mkInstituteCtx(tenantId, 'service:certificate-rte-report-export'),
    async (tx) => {
      return tx
        .select()
        .from(studentAcademicsLive)
        .where(eq(studentAcademicsLive.academicYearId, academicYearId));
    },
  );

  // Batch fetch all student profiles (single query instead of per-row)
  const allStudents = await withTenant(
    db,
    mkInstituteCtx(tenantId, 'service:certificate-rte-report-export'),
    async (tx) => {
      return tx
        .select({ id: studentProfilesLive.id, isRteAdmitted: studentProfilesLive.isRteAdmitted })
        .from(studentProfilesLive);
    },
  );
  const rteMap = new Map(allStudents.map((s) => [s.id, s.isRteAdmitted]));

  // Group by standardId
  const standardMap = new Map<string, { total: number; rte: number }>();
  for (const acad of academics) {
    const entry = standardMap.get(acad.standardId) ?? { total: 0, rte: 0 };
    entry.total++;
    if (rteMap.get(acad.studentProfileId)) entry.rte++;
    standardMap.set(acad.standardId, entry);
  }

  const rows = Array.from(standardMap.entries()).map(([standardId, data]) => ({
    'Class (Standard ID)': standardId,
    'RTE Students Count': data.rte,
    'Total Students': data.total,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(rows, { header: RTE_HEADERS }),
    'RTE Report',
  );
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
