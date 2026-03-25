/**
 * TC Register Export — PDF of all TCs issued in academic year (ROV-171, PRD §8).
 *
 * Generates XLSX (PDF generation deferred to Puppeteer integration).
 */
import { type DrizzleDB, tcRegister, withTenant } from '@roviq/database';
import { and, eq } from 'drizzle-orm';
import * as XLSX from 'xlsx';

const TC_REGISTER_HEADERS = [
  'TC Serial Number',
  'Student Profile ID',
  'Status',
  'Reason',
  'Requested At',
  'Issued At',
  'Is Duplicate',
];

export async function generateTcRegisterExport(
  db: DrizzleDB,
  tenantId: string,
  academicYearId: string,
): Promise<Buffer> {
  const tcs = await withTenant(db, tenantId, async (tx) => {
    return tx
      .select()
      .from(tcRegister)
      .where(and(eq(tcRegister.academicYearId, academicYearId), eq(tcRegister.status, 'issued')));
  });

  const rows = tcs.map((tc) => ({
    'TC Serial Number': tc.tcSerialNumber,
    'Student Profile ID': tc.studentProfileId,
    Status: tc.status,
    Reason: tc.reason,
    'Requested At': tc.requestedAt?.toISOString() ?? '',
    'Issued At': tc.issuedAt?.toISOString() ?? '',
    'Is Duplicate': tc.isDuplicate ? 'Yes' : 'No',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { header: TC_REGISTER_HEADERS });
  XLSX.utils.book_append_sheet(wb, ws, 'TC Register');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
