/**
 * Activities for TCIssuanceWorkflow (ROV-161, PRD §5.1-5.2).
 *
 * Each activity is idempotent. DrizzleDB + NATS injected via closure.
 * The populateTcData activity snapshots all 20 CBSE TC fields.
 */
import { Logger } from '@nestjs/common';
import {
  AcademicStatus,
  GuardianRelationship,
  SocialCategory,
  TcStatus,
} from '@roviq/common-types';
import {
  type DrizzleDB,
  guardianProfiles,
  studentAcademics,
  studentGuardianLinks,
  studentProfiles,
  tcRegister,
  tenantSequences,
  userProfiles,
  withAdmin,
  withTenant,
} from '@roviq/database';
import { eq, sql } from 'drizzle-orm';
import type { CbseTcData, TCIssuanceActivities } from './tc-issuance.types';

const logger = new Logger('TCIssuanceActivities');

// ── Date to words helper ──────────────────────────────────

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function numberToWords(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim();
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} Hundred ${numberToWords(n % 100)}`.trim();
  return `${numberToWords(Math.floor(n / 1000))} Thousand ${numberToWords(n % 1000)}`.trim();
}

/** Convert YYYY-MM-DD to words. Parses date parts directly to avoid timezone issues. */
function dateToWords(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateStr;
  const [, yearStr, monthStr, dayStr] = match;
  const day = numberToWords(Number.parseInt(dayStr, 10));
  const month = MONTHS[Number.parseInt(monthStr, 10) - 1];
  const year = numberToWords(Number.parseInt(yearStr, 10));
  return `${day} ${month} ${year}`;
}

// ── NATS emitter type ─────────────────────────────────────

interface NatsEmitter {
  emit(
    pattern: string,
    data: unknown,
  ): { subscribe: (opts: { error?: (err: unknown) => void }) => void };
}

// ── TC data helpers (extracted for readability) ───────────

/** PRD §5.2 field 7: compute "Whether failed, once/twice/N times" */
function computeFailureStatus(academics: Array<{ promotionStatus: string | null }>): string {
  const detained = academics.filter((a) => a.promotionStatus === 'detained');
  if (detained.length === 0) return 'No';
  if (detained.length === 1) return 'Yes, once';
  if (detained.length === 2) return 'Yes, twice';
  return `Yes, ${detained.length} times`;
}

/** Resolve an i18nText jsonb value to a single display string (en → first → ''). */
function resolveI18n(value: Record<string, string> | null | undefined): string {
  if (!value) return '';
  return value.en ?? Object.values(value)[0] ?? '';
}

/** Extract father/guardian and mother names from guardian links */
function extractGuardianNames(
  links: Array<{
    relationship: string;
    firstName: Record<string, string>;
    lastName: Record<string, string> | null;
  }>,
): { fatherName: string | null; motherName: string | null } {
  const father = links.find(
    (g) =>
      g.relationship === GuardianRelationship.FATHER ||
      g.relationship === GuardianRelationship.LEGAL_GUARDIAN,
  );
  const mother = links.find((g) => g.relationship === GuardianRelationship.MOTHER);
  return {
    fatherName: father
      ? `${resolveI18n(father.firstName)} ${resolveI18n(father.lastName)}`.trim()
      : null,
    motherName: mother
      ? `${resolveI18n(mother.firstName)} ${resolveI18n(mother.lastName)}`.trim()
      : null,
  };
}

/** PRD §5.2 field 14: extract NCC/Scout/Guide from class_roles */
function extractNccScoutDetails(classRoles: unknown): string {
  const roles = Array.isArray(classRoles) ? (classRoles as string[]) : [];
  const items = roles.filter(
    (r) =>
      r.toLowerCase().includes('ncc') ||
      r.toLowerCase().includes('scout') ||
      r.toLowerCase().includes('guide'),
  );
  return items.length > 0 ? items.join(', ') : 'None';
}

/** Build the immutable 20-field CBSE TC data snapshot */
function buildCbseTcData(params: {
  userProfile:
    | {
        firstName: Record<string, string>;
        lastName: Record<string, string> | null;
        dateOfBirth: string | null;
        nationality: string | null;
      }
    | undefined;
  student: { socialCategory: string; isRteAdmitted: boolean };
  fatherName: string | null;
  motherName: string | null;
  whetherFailed: string;
  latestAcademic: { promotionStatus: string | null; standardId: string } | null;
  nccScoutGuide: string;
  allDuesPaid: string;
  reason: string;
}): CbseTcData {
  const {
    userProfile,
    student,
    fatherName,
    motherName,
    whetherFailed,
    latestAcademic,
    nccScoutGuide,
    allDuesPaid,
    reason,
  } = params;
  const promotionStatus = latestAcademic?.promotionStatus ?? 'pending';
  const today = new Date().toISOString().split('T')[0];

  return {
    studentName:
      `${resolveI18n(userProfile?.firstName)} ${resolveI18n(userProfile?.lastName)}`.trim(),
    motherName,
    fatherOrGuardianName: fatherName,
    nationality: userProfile?.nationality ?? 'Indian',
    socialCategory: student.socialCategory ?? SocialCategory.GENERAL,
    dateOfBirthFigures: userProfile?.dateOfBirth ?? null,
    dateOfBirthWords: userProfile?.dateOfBirth ? dateToWords(userProfile.dateOfBirth) : null,
    whetherFailed,
    subjectsStudied: 'As per curriculum',
    classLastStudied: latestAcademic?.standardId ?? null,
    lastExamResult: 'As per school records',
    qualifiedForPromotion:
      promotionStatus === 'promoted' ? 'Yes' : promotionStatus === 'detained' ? 'No' : 'Pending',
    feesPaidUpTo: allDuesPaid,
    feeConcession: student.isRteAdmitted ? 'RTE Section 12(1)(c)' : 'None',
    nccScoutGuide,
    dateOfLeaving: today,
    reasonForLeaving: reason,
    totalWorkingDays: 'As per records',
    totalPresentDays: 'As per records',
    generalConduct: 'Good',
    remarks: '',
    dateOfIssue: null,
  };
}

// ── Activity factory ──────────────────────────────────────

export function createTCIssuanceActivities(
  db: DrizzleDB,
  natsClient: NatsEmitter | null,
): TCIssuanceActivities {
  function emitEvent(pattern: string, data: unknown): void {
    if (!natsClient) return;
    natsClient.emit(pattern, data).subscribe({
      error: (err) => logger.warn(`Failed to emit ${pattern}: ${err}`),
    });
  }

  return {
    async validateRequest(tenantId, tcRegisterId, studentProfileId) {
      logger.log(`Validating TC request: ${tcRegisterId} for student ${studentProfileId}`);

      // Verify student is enrolled
      const student = await withTenant(db, tenantId, async (tx) => {
        return tx
          .select({ academicStatus: studentProfiles.academicStatus })
          .from(studentProfiles)
          .where(eq(studentProfiles.id, studentProfileId))
          .limit(1);
      });

      if (student.length === 0) throw new Error('Student profile not found');
      if (student[0].academicStatus !== AcademicStatus.ENROLLED) {
        throw new Error(`Student is not enrolled (status: ${student[0].academicStatus})`);
      }

      // Update status to clearance_pending
      await withTenant(db, tenantId, async (tx) => {
        await tx
          .update(tcRegister)
          .set({
            status: TcStatus.CLEARANCE_PENDING,
            clearances: {
              accounts: { cleared: false },
              library: { cleared: false },
              lab: { cleared: false },
              transport: { cleared: false },
            },
          })
          .where(eq(tcRegister.id, tcRegisterId));
      });

      logger.log(`TC ${tcRegisterId}: status → clearance_pending`);
    },

    async checkDepartmentClearance(tenantId, tcRegisterId, department) {
      logger.log(`Checking ${department} clearance for TC ${tcRegisterId}`);

      // TODO: Real clearance checks via NATS to Finance/Library/Lab/Transport services
      // For now, auto-clear all departments (stub)
      const cleared = true;
      const now = new Date().toISOString();

      // Update the specific department in clearances JSONB using parameterized values
      const clearanceValue = JSON.stringify({ cleared, at: now });
      const jsonPath = `{${department}}`;
      await withTenant(db, tenantId, async (tx) => {
        await tx.execute(
          sql`UPDATE tc_register SET clearances = jsonb_set(
            COALESCE(clearances, '{}'),
            ${jsonPath}::text[],
            ${clearanceValue}::jsonb
          ) WHERE id = ${tcRegisterId}`,
        );
      });

      // Check if all departments are now cleared
      const tc = await withTenant(db, tenantId, async (tx) => {
        return tx
          .select({ clearances: tcRegister.clearances })
          .from(tcRegister)
          .where(eq(tcRegister.id, tcRegisterId))
          .limit(1);
      });

      const clearances = (tc[0]?.clearances ?? {}) as Record<string, { cleared: boolean }>;
      const allCleared = Object.values(clearances).every((c) => c.cleared);

      if (allCleared) {
        await withTenant(db, tenantId, async (tx) => {
          await tx
            .update(tcRegister)
            .set({ status: TcStatus.CLEARANCE_COMPLETE })
            .where(eq(tcRegister.id, tcRegisterId));
        });
        logger.log(`TC ${tcRegisterId}: all departments cleared → clearance_complete`);
      }

      return { department, cleared, notes: cleared ? 'Auto-cleared (stub)' : 'Dues pending' };
    },

    async populateTcData(tenantId, tcRegisterId, studentProfileId) {
      logger.log(`Populating TC data for TC ${tcRegisterId}`);

      // Fetch student_profile
      const sp = await withTenant(db, tenantId, async (tx) => {
        return tx
          .select()
          .from(studentProfiles)
          .where(eq(studentProfiles.id, studentProfileId))
          .limit(1);
      });
      if (sp.length === 0) throw new Error('Student profile not found');
      const student = sp[0];

      // Fetch user_profile
      const up = await withAdmin(db, async (tx) => {
        return tx
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.userId, student.userId))
          .limit(1);
      });

      // Fetch guardian names via JOIN
      const guardianLinks = await withAdmin(db, async (tx) => {
        return tx
          .select({
            relationship: studentGuardianLinks.relationship,
            firstName: userProfiles.firstName,
            lastName: userProfiles.lastName,
          })
          .from(studentGuardianLinks)
          .innerJoin(
            guardianProfiles,
            eq(studentGuardianLinks.guardianProfileId, guardianProfiles.id),
          )
          .innerJoin(userProfiles, eq(guardianProfiles.userId, userProfiles.userId))
          .where(eq(studentGuardianLinks.studentProfileId, studentProfileId));
      });

      // Fetch academics
      const academics = await withTenant(db, tenantId, async (tx) => {
        return tx
          .select()
          .from(studentAcademics)
          .where(eq(studentAcademics.studentProfileId, studentProfileId));
      });

      // Fetch TC reason + clearances
      const tcRow = await withTenant(db, tenantId, async (tx) => {
        return tx
          .select({ reason: tcRegister.reason, clearances: tcRegister.clearances })
          .from(tcRegister)
          .where(eq(tcRegister.id, tcRegisterId))
          .limit(1);
      });

      // Build snapshot using extracted helpers
      const { fatherName, motherName } = extractGuardianNames(guardianLinks);
      const latestAcademic = academics.length > 0 ? academics[academics.length - 1] : null;
      const clearances = (tcRow[0]?.clearances ?? {}) as Record<string, { cleared: boolean }>;

      const tcData = buildCbseTcData({
        userProfile: up[0],
        student,
        fatherName,
        motherName,
        whetherFailed: computeFailureStatus(academics),
        latestAcademic,
        nccScoutGuide: extractNccScoutDetails(latestAcademic?.classRoles),
        allDuesPaid: clearances.accounts?.cleared ? 'Yes' : 'No',
        reason: tcRow[0]?.reason ?? 'Transfer',
      });

      // Persist snapshot
      await withTenant(db, tenantId, async (tx) => {
        await tx
          .update(tcRegister)
          .set({
            tcData: tcData as unknown as Record<string, unknown>,
            status: TcStatus.GENERATED,
            generatedAt: new Date(),
          })
          .where(eq(tcRegister.id, tcRegisterId));
      });

      logger.log(`TC ${tcRegisterId}: 20 CBSE fields populated → status=generated`);
      return { tcData };
    },

    async recordApproval(tenantId, tcRegisterId, approvedBy) {
      logger.log(`Recording approval for TC ${tcRegisterId} by ${approvedBy}`);

      await withTenant(db, tenantId, async (tx) => {
        await tx
          .update(tcRegister)
          .set({
            status: TcStatus.APPROVED,
            approvedBy,
            approvedAt: new Date(),
          })
          .where(eq(tcRegister.id, tcRegisterId));
      });

      logger.log(`TC ${tcRegisterId}: status → approved`);
    },

    async issueTC(tenantId, tcRegisterId, studentProfileId, academicYearId) {
      logger.log(`Issuing TC ${tcRegisterId}`);

      // Generate TC serial number
      const tcSerialNumber = await withTenant(db, tenantId, async (tx) => {
        const seqName = `tc_no:${academicYearId}`;
        await tx
          .insert(tenantSequences)
          .values({
            tenantId,
            sequenceName: seqName,
            currentValue: 0n,
            formatTemplate: 'TC/{value:04d}',
          })
          .onConflictDoNothing();

        const result = await tx.execute(
          sql`SELECT * FROM next_sequence_value(${tenantId}::uuid, ${seqName})`,
        );
        const row = result.rows[0] as { next_val: string; formatted: string };
        return row.formatted || `TC/${row.next_val}`;
      });

      const today = new Date().toISOString().split('T')[0];

      // TODO: Generate PDF with Handlebars template + QR code
      // Stub: use placeholder PDF URL
      const pdfUrl = `/api/storage/tc/${tenantId}/${tcRegisterId}.pdf`;
      const qrVerificationUrl = `/tc/verify/${tcSerialNumber}`;

      // Update tc_register: status, serial, PDF URL, and set dateOfIssue inside tc_data (single UPDATE)
      await withTenant(db, tenantId, async (tx) => {
        await tx
          .update(tcRegister)
          .set({
            status: TcStatus.ISSUED,
            tcSerialNumber,
            issuedAt: new Date(),
            pdfUrl,
            qrVerificationUrl,
            tcData: sql`jsonb_set(COALESCE(tc_data, '{}'), '{dateOfIssue}', to_jsonb(${today}::text))`,
          })
          .where(eq(tcRegister.id, tcRegisterId));
      });

      // Update student_profile: mark transferred_out (PRD §5.1 Step 5)
      await withTenant(db, tenantId, async (tx) => {
        await tx
          .update(studentProfiles)
          .set({
            tcIssued: true,
            tcNumber: tcSerialNumber,
            tcIssuedDate: today,
            dateOfLeaving: today,
            academicStatus: AcademicStatus.TRANSFERRED_OUT,
          })
          .where(eq(studentProfiles.id, studentProfileId));
      });

      // Emit tc.issued event
      emitEvent('TC.issued', {
        tcId: tcRegisterId,
        studentProfileId,
        tcSerialNumber,
        tenantId,
      });

      logger.log(`TC ${tcRegisterId}: issued as ${tcSerialNumber}, student → transferred_out`);

      return { pdfUrl, qrVerificationUrl, tcSerialNumber };
    },
  };
}
