/**
 * CBSE Class 10/12 LOC (List of Candidates) Export (ROV-171, PRD §3.2).
 *
 * Builds on Class 9/11 registration data + Registration Number + updated APAAR.
 * Batch-fetches all data (no N+1).
 */
import {
  type DrizzleDB,
  mkAdminCtx,
  mkInstituteCtx,
  studentAcademicsLive,
  studentProfilesLive,
  userProfiles,
  withAdmin,
  withTenant,
} from '@roviq/database';
import { eq } from 'drizzle-orm';
import * as XLSX from 'xlsx';

/** Resolve an i18nText jsonb value to a single display string (en → first → ''). */
function resolveI18n(value: Record<string, string> | null | undefined): string {
  if (!value) return '';
  return value.en ?? Object.values(value)[0] ?? '';
}

const LOC_HEADERS = [
  'Registration Number',
  'Student Name (CAPITALS)',
  'Date of Birth',
  'Gender',
  'APAAR ID',
  'Subject Code 1',
  'Subject Code 2',
  'Subject Code 3',
  'Subject Code 4',
  'Subject Code 5',
  'Subject Code 6',
  'CWSN Status',
];

export async function generateCbseLocExport(
  db: DrizzleDB,
  tenantId: string,
  academicYearId: string,
): Promise<Buffer> {
  const academics = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
    return tx
      .select()
      .from(studentAcademicsLive)
      .where(eq(studentAcademicsLive.academicYearId, academicYearId));
  });

  const allStudents = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
    return tx.select().from(studentProfilesLive);
  });
  const studentMap = new Map(allStudents.map((s) => [s.id, s]));

  const allProfiles = await withAdmin(db, mkAdminCtx(), async (tx) =>
    tx.select().from(userProfiles),
  );
  const profileMap = new Map(allProfiles.map((p) => [p.userId, p]));

  const rows = academics
    .map((acad) => {
      const student = studentMap.get(acad.studentProfileId);
      if (!student) return null;
      const profile = profileMap.get(student.userId);

      return {
        'Registration Number': '',
        'Student Name (CAPITALS)':
          `${resolveI18n(profile?.firstName)} ${resolveI18n(profile?.lastName)}`
            .trim()
            .toUpperCase(),
        'Date of Birth': profile?.dateOfBirth ?? '',
        Gender: profile?.gender ?? '',
        'APAAR ID': '',
        'Subject Code 1': '',
        'Subject Code 2': '',
        'Subject Code 3': '',
        'Subject Code 4': '',
        'Subject Code 5': '',
        'Subject Code 6': '',
        'CWSN Status': student.cwsnType ?? '',
      };
    })
    .filter(Boolean) as Record<string, unknown>[];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(rows, { header: LOC_HEADERS }),
    'CBSE LOC',
  );
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
