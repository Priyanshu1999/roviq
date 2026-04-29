/**
 * Admission Register (AWR) Export (ROV-171, PRD §8).
 *
 * All admissions in academic year sorted by admission_number.
 * Batch-fetches all data (no N+1).
 */
import {
  type DrizzleDB,
  studentAcademicsLive,
  studentProfilesLive,
  userProfiles,
  withAdmin,
  withTenant,
} from '@roviq/database';
import { asc, eq } from 'drizzle-orm';
import * as XLSX from 'xlsx';

/** Resolve an i18nText jsonb value to a single display string (en → first → ''). */
function resolveI18n(value: Record<string, string> | null | undefined): string {
  if (!value) return '';
  return value.en ?? Object.values(value)[0] ?? '';
}

const AWR_HEADERS = [
  'S.No.',
  'Admission Number',
  'Student Name',
  'Date of Birth',
  'Gender',
  'Admission Date',
  'Admission Class',
  'Admission Type',
  'Academic Status',
  'Social Category',
  'Class',
  'Section',
];

export async function generateAwrExport(
  db: DrizzleDB,
  tenantId: string,
  academicYearId: string,
): Promise<Buffer> {
  // Batch fetch all data
  const students = await withTenant(db, tenantId, async (tx) => {
    return tx.select().from(studentProfilesLive).orderBy(asc(studentProfilesLive.admissionNumber));
  });

  const academics = await withTenant(db, tenantId, async (tx) => {
    return tx
      .select()
      .from(studentAcademicsLive)
      .where(eq(studentAcademicsLive.academicYearId, academicYearId));
  });

  const allProfiles = await withAdmin(db, async (tx) => tx.select().from(userProfiles));
  const profileMap = new Map(allProfiles.map((p) => [p.userId, p]));
  const academicMap = new Map(academics.map((a) => [a.studentProfileId, a]));

  let sno = 1;
  const rows = students.map((student) => {
    const profile = profileMap.get(student.userId);
    const acad = academicMap.get(student.id);

    return {
      'S.No.': sno++,
      'Admission Number': student.admissionNumber,
      'Student Name': `${resolveI18n(profile?.firstName)} ${resolveI18n(profile?.lastName)}`.trim(),
      'Date of Birth': profile?.dateOfBirth ?? '',
      Gender: profile?.gender ?? '',
      'Admission Date': student.admissionDate,
      'Admission Class': student.admissionClass ?? '',
      'Admission Type': student.admissionType,
      'Academic Status': student.academicStatus,
      'Social Category': student.socialCategory,
      Class: acad?.standardId ?? '',
      Section: acad?.sectionId ?? '',
    };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(rows, { header: AWR_HEADERS }),
    'Admission Register',
  );
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
