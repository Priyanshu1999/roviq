/**
 * UDISE+ DCF Export (ROV-171, PRD §2.1-2.3).
 *
 * Generates XLSX with:
 * - Sheet 1: Student data (21 UDISE+ student fields)
 * - Sheet 2: Teacher data (12 UDISE+ teacher fields)
 *
 * All data fetched in batch (no N+1 per-row queries).
 */

import { GuardianRelationship, QualificationType } from '@roviq/common-types';
import { UDISE_STUDENT_HEADERS, UDISE_TEACHER_HEADERS } from '@roviq/compliance';
import {
  type DrizzleDB,
  guardianProfiles,
  staffProfiles,
  staffQualifications,
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

export async function generateUdiseDcfExport(
  db: DrizzleDB,
  tenantId: string,
  academicYearId: string,
): Promise<Buffer> {
  // ── Batch fetch all data upfront ───────────────────────

  const students = await withTenant(db, tenantId, async (tx) => {
    return tx.select().from(studentProfiles);
  });

  const academics = await withTenant(db, tenantId, async (tx) => {
    return tx
      .select()
      .from(studentAcademics)
      .where(eq(studentAcademics.academicYearId, academicYearId));
  });

  // All user profiles (platform-level, no RLS)
  const allProfiles = await withAdmin(db, async (tx) => tx.select().from(userProfiles));
  const profileMap = new Map(allProfiles.map((p) => [p.userId, p]));

  // All guardian links with names (single batch query)
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

  // Group guardian links by student
  const guardianMap = new Map<string, typeof allGuardianLinks>();
  for (const link of allGuardianLinks) {
    const existing = guardianMap.get(link.studentProfileId) ?? [];
    existing.push(link);
    guardianMap.set(link.studentProfileId, existing);
  }

  const academicMap = new Map(academics.map((a) => [a.studentProfileId, a]));

  // ── Build student rows (in-memory, no queries) ─────────

  const studentRows = students.map((student) => {
    const profile = profileMap.get(student.userId);
    const acad = academicMap.get(student.id);
    const guardians = guardianMap.get(student.id) ?? [];
    const father = guardians.find(
      (g) =>
        g.relationship === GuardianRelationship.FATHER ||
        g.relationship === GuardianRelationship.LEGAL_GUARDIAN,
    );
    const mother = guardians.find((g) => g.relationship === GuardianRelationship.MOTHER);

    return {
      'Student Name': `${resolveI18n(profile?.firstName)} ${resolveI18n(profile?.lastName)}`.trim(),
      "Father's Name": father
        ? `${resolveI18n(father.firstName)} ${resolveI18n(father.lastName)}`.trim()
        : '',
      "Mother's Name": mother
        ? `${resolveI18n(mother.firstName)} ${resolveI18n(mother.lastName)}`.trim()
        : '',
      'Date of Birth': profile?.dateOfBirth ?? '',
      Gender: profile?.gender ?? '',
      'Aadhaar Number': '',
      'Mother Tongue': profile?.motherTongue ?? '',
      'Social Category': student.socialCategory ?? 'general',
      'Minority Status': student.minorityType ?? '',
      'Is BPL': student.isBpl ? 'Yes' : 'No',
      'Is CWSN': student.isCwsn ? 'Yes' : 'No',
      'CWSN Type': student.cwsnType ?? '',
      'RTE Admitted': student.isRteAdmitted ? 'Yes' : 'No',
      Class: acad?.standardId ?? '',
      Section: acad?.sectionId ?? '',
      'Admission Number': student.admissionNumber,
      Stream: student.stream ?? '',
      'Medium of Instruction': '',
      'Previous Year Status': '',
      'APAAR ID': '',
      PEN: '',
    };
  });

  // ── Batch fetch teacher data ───────────────────────────

  const staffList = await withTenant(db, tenantId, async (tx) => {
    return tx.select().from(staffProfiles);
  });

  const allQuals = await withTenant(db, tenantId, async (tx) => {
    return tx.select().from(staffQualifications);
  });

  const qualMap = new Map<string, typeof allQuals>();
  for (const q of allQuals) {
    const existing = qualMap.get(q.staffProfileId) ?? [];
    existing.push(q);
    qualMap.set(q.staffProfileId, existing);
  }

  const teacherRows = staffList.map((staff) => {
    const profile = profileMap.get(staff.userId);
    const quals = qualMap.get(staff.id) ?? [];
    const academicQual = quals.find((q) => q.type === QualificationType.ACADEMIC);
    const professionalQual = quals.find((q) => q.type === QualificationType.PROFESSIONAL);

    return {
      'Teacher Name': `${resolveI18n(profile?.firstName)} ${resolveI18n(profile?.lastName)}`.trim(),
      'Aadhaar Number': '',
      'Date of Birth': profile?.dateOfBirth ?? '',
      Gender: profile?.gender ?? '',
      'Social Category': staff.socialCategory ?? '',
      'Nature of Appointment': staff.natureOfAppointment ?? '',
      'Date of Joining': staff.dateOfJoining ?? '',
      'Academic Qualification': academicQual?.degreeName ?? '',
      'Professional Qualification': professionalQual?.degreeName ?? '',
      'Trained for CWSN': staff.trainedForCwsn ? 'Yes' : 'No',
      'Is Disabled': staff.isDisabled ? 'Yes' : 'No',
      'Current Post Held': staff.designation ?? '',
    };
  });

  // ── Generate XLSX ──────────────────────────────────────

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(studentRows, { header: UDISE_STUDENT_HEADERS }),
    'Students',
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(teacherRows, { header: UDISE_TEACHER_HEADERS }),
    'Teachers',
  );

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
