/**
 * CBSE Class 9/11 Registration Export (ROV-171, PRD §3.1).
 *
 * Generates XLSX matching CBSE Pariksha Sangam template.
 * Batch-fetches all data (no N+1 per-row queries).
 */

import { GuardianRelationship } from '@roviq/common-types';
import { CBSE_REGISTRATION_HEADERS } from '@roviq/compliance';
import {
  type DrizzleDB,
  guardianProfiles,
  studentAcademics,
  studentGuardianLinks,
  studentProfiles,
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

/** Format YYYY-MM-DD → DD/MM/YYYY (CBSE format) */
function formatDobCbse(dob: string | null): string {
  if (!dob) return '';
  const match = String(dob).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

export async function generateCbseRegistrationExport(
  db: DrizzleDB,
  tenantId: string,
  academicYearId: string,
): Promise<Buffer> {
  // Batch fetch
  const academics = await withTenant(db, tenantId, async (tx) => {
    return tx
      .select()
      .from(studentAcademics)
      .where(eq(studentAcademics.academicYearId, academicYearId));
  });

  const allStudents = await withTenant(db, tenantId, async (tx) => {
    return tx.select().from(studentProfiles);
  });
  const studentMap = new Map(allStudents.map((s) => [s.id, s]));

  const allProfiles = await withAdmin(db, async (tx) => tx.select().from(userProfiles));
  const profileMap = new Map(allProfiles.map((p) => [p.userId, p]));

  const allGuardianLinks = await withAdmin(db, async (tx) => {
    return tx
      .select({
        studentProfileId: studentGuardianLinks.studentProfileId,
        relationship: studentGuardianLinks.relationship,
        firstName: userProfiles.firstName,
        lastName: userProfiles.lastName,
      })
      .from(studentGuardianLinks)
      .innerJoin(guardianProfiles, eq(studentGuardianLinks.guardianProfileId, guardianProfiles.id))
      .innerJoin(userProfiles, eq(guardianProfiles.userId, userProfiles.userId));
  });

  const guardianMap = new Map<string, typeof allGuardianLinks>();
  for (const link of allGuardianLinks) {
    const existing = guardianMap.get(link.studentProfileId) ?? [];
    existing.push(link);
    guardianMap.set(link.studentProfileId, existing);
  }

  // Build rows
  const rows = academics
    .map((acad) => {
      const student = studentMap.get(acad.studentProfileId);
      if (!student) return null;

      const profile = profileMap.get(student.userId);
      const guardians = guardianMap.get(student.id) ?? [];
      const father = guardians.find(
        (g) =>
          g.relationship === GuardianRelationship.FATHER ||
          g.relationship === GuardianRelationship.LEGAL_GUARDIAN,
      );
      const mother = guardians.find((g) => g.relationship === GuardianRelationship.MOTHER);

      return {
        'Student Name (CAPITALS)':
          `${resolveI18n(profile?.firstName)} ${resolveI18n(profile?.lastName)}`
            .trim()
            .toUpperCase(),
        "Mother's Name": mother
          ? `${resolveI18n(mother.firstName)} ${resolveI18n(mother.lastName)}`.trim()
          : '',
        "Father's/Guardian's Name": father
          ? `${resolveI18n(father.firstName)} ${resolveI18n(father.lastName)}`.trim()
          : '',
        'Date of Birth': formatDobCbse(profile?.dateOfBirth ?? null),
        Gender: profile?.gender ?? '',
        'APAAR ID': '',
        'Subject Code 1': '',
        'Subject Code 2': '',
        'Subject Code 3': '',
        'Subject Code 4': '',
        'Subject Code 5': '',
        'Subject Code 6': '',
        'Subject Code 7': '',
        'CWSN Status': student.cwsnType ?? '',
        'Mobile Number': '',
        Email: '',
        'Annual Income': '',
      };
    })
    .filter(Boolean) as Record<string, unknown>[];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(rows, { header: CBSE_REGISTRATION_HEADERS }),
    'CBSE Registration',
  );

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
