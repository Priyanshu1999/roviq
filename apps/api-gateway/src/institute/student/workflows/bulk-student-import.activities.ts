/**
 * Activities for BulkStudentImportWorkflow (ROV-155, PRD §7.1).
 *
 * Each activity is idempotent where possible.
 * DrizzleDB + NATS client injected via closure at worker startup.
 */
import { Logger } from '@nestjs/common';
import { AcademicStatus, AdmissionType, Gender, SocialCategory } from '@roviq/common-types';
import {
  type DrizzleDB,
  memberships,
  phoneNumbers,
  roles,
  studentAcademics,
  studentProfiles,
  tenantSequences,
  userProfiles,
  users,
  withAdmin,
  withTenant,
} from '@roviq/database';
import { and, eq, sql } from 'drizzle-orm';
import Papa from 'papaparse';
import type {
  BulkStudentImportActivities,
  RowError,
  ValidatedRow,
} from './bulk-student-import.types';

const logger = new Logger('BulkStudentImportActivities');

// ── Validation helpers ────────────────────────────────────

/** Valid Indian mobile: exactly 10 digits starting with 6-9 */
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

/** Accepted date formats: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY */
function parseDate(value: string): string | null {
  const trimmed = value.trim();

  // YYYY-MM-DD (ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return trimmed;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const match = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const iso = `${year}-${month}-${day}`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return iso;
  }

  return null;
}

const VALID_GENDERS = new Set(['MALE', 'FEMALE', 'OTHER']);
const VALID_SOCIAL_CATEGORIES = new Set(Object.values(SocialCategory));
const VALID_ADMISSION_TYPES = new Set(Object.values(AdmissionType));
const VALID_BLOOD_GROUPS = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

// ── Per-field validation helpers ─────────────────────────

/** Validate first_name (required). */
function validateFirstName(
  mapped: Record<string, string>,
  rowNumber: number,
): { value: string | undefined; error: RowError | null } {
  const firstName = mapped.first_name?.trim();
  if (!firstName) {
    return {
      value: undefined,
      error: {
        rowNumber,
        field: 'first_name',
        reason: 'First name is required',
        originalValue: mapped.first_name,
      },
    };
  }
  return { value: firstName, error: null };
}

/** Validate date_of_birth (required, must parse). */
function validateDateOfBirth(
  mapped: Record<string, string>,
  rowNumber: number,
): { value: string | null; error: RowError | null } {
  const rawDob = mapped.date_of_birth?.trim();
  if (!rawDob) {
    return {
      value: null,
      error: {
        rowNumber,
        field: 'date_of_birth',
        reason: 'Date of birth is required',
        originalValue: rawDob,
      },
    };
  }
  const dateOfBirth = parseDate(rawDob);
  if (!dateOfBirth) {
    return {
      value: null,
      error: {
        rowNumber,
        field: 'date_of_birth',
        reason: 'Invalid date format. Expected DD/MM/YYYY or YYYY-MM-DD',
        originalValue: rawDob,
      },
    };
  }
  return { value: dateOfBirth, error: null };
}

/** Validate gender (required, must be in allowed set). */
function validateGender(
  mapped: Record<string, string>,
  rowNumber: number,
): { value: Gender | undefined; error: RowError | null } {
  const rawGender = mapped.gender?.trim().toUpperCase();
  if (!rawGender) {
    return {
      value: undefined,
      error: {
        rowNumber,
        field: 'gender',
        reason: 'Gender is required (MALE/FEMALE/OTHER)',
        originalValue: mapped.gender,
      },
    };
  }
  if (!VALID_GENDERS.has(rawGender)) {
    return {
      value: undefined,
      error: {
        rowNumber,
        field: 'gender',
        reason: `Invalid gender: "${rawGender}". Must be MALE, FEMALE, or OTHER`,
        originalValue: mapped.gender,
      },
    };
  }
  return { value: rawGender as Gender, error: null };
}

/** Validate social_category (optional, enum check). */
function validateSocialCategory(
  mapped: Record<string, string>,
  rowNumber: number,
): { value: SocialCategory | undefined; error: RowError | null } {
  const raw = mapped.social_category?.trim().toUpperCase();
  if (raw && !VALID_SOCIAL_CATEGORIES.has(raw as SocialCategory)) {
    return {
      value: undefined,
      error: {
        rowNumber,
        field: 'social_category',
        reason: `Invalid social category: "${raw}". Must be GENERAL, SC, ST, OBC, or EWS`,
        originalValue: mapped.social_category,
      },
    };
  }
  return { value: (raw as SocialCategory) || undefined, error: null };
}

/** Normalize and validate phone (optional, Indian mobile). */
function validatePhone(
  mapped: Record<string, string>,
  rowNumber: number,
): { value: string | undefined; error: RowError | null } {
  const rawPhone = mapped.phone?.trim().replace(/[\s-]/g, '');
  // Strip +91 or 91 prefix only when input is longer than 10 digits (country code present)
  const phone = rawPhone && rawPhone.length > 10 ? rawPhone.replace(/^\+?91/, '') : rawPhone;
  if (phone && !INDIAN_MOBILE_REGEX.test(phone)) {
    return {
      value: undefined,
      error: {
        rowNumber,
        field: 'phone',
        reason: 'Invalid Indian mobile number. Must be 10 digits starting with 6-9',
        originalValue: mapped.phone,
      },
    };
  }
  return { value: phone || undefined, error: null };
}

/** Validate admission_type (optional, enum check). */
function validateAdmissionType(
  mapped: Record<string, string>,
  rowNumber: number,
): { value: AdmissionType | undefined; error: RowError | null } {
  const raw = mapped.admission_type?.trim().toUpperCase();
  if (raw && !VALID_ADMISSION_TYPES.has(raw as AdmissionType)) {
    return {
      value: undefined,
      error: {
        rowNumber,
        field: 'admission_type',
        reason: `Invalid admission type: "${raw}"`,
        originalValue: mapped.admission_type,
      },
    };
  }
  return { value: (raw as AdmissionType) || undefined, error: null };
}

/** Validate blood_group (optional, enum check). */
function validateBloodGroup(
  mapped: Record<string, string>,
  rowNumber: number,
): { value: string | undefined; error: RowError | null } {
  const raw = mapped.blood_group?.trim().toUpperCase();
  if (raw && !VALID_BLOOD_GROUPS.has(raw)) {
    return {
      value: undefined,
      error: {
        rowNumber,
        field: 'blood_group',
        reason: `Invalid blood group: "${raw}". Must be A+/A-/B+/B-/AB+/AB-/O+/O-`,
        originalValue: mapped.blood_group,
      },
    };
  }
  return { value: raw || undefined, error: null };
}

/** Known internal field names that CSV columns can map to */
const KNOWN_FIELDS = new Set([
  'first_name',
  'last_name',
  'date_of_birth',
  'gender',
  'father_name',
  'mother_name',
  'phone',
  'email',
  'social_category',
  'admission_type',
  'admission_number',
  'standard_id',
  'section_id',
  'religion',
  'blood_group',
  'previous_school_name',
]);

// ── CSV parsing ───────────────────────────────────────────

/**
 * Apply field mapping: rename CSV columns → internal field names.
 * Unmapped columns whose names match known fields are kept as-is.
 */
function applyFieldMapping(
  raw: Record<string, string>,
  fieldMapping: Record<string, string>,
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [csvCol, value] of Object.entries(raw)) {
    const targetField = fieldMapping[csvCol];
    if (targetField && KNOWN_FIELDS.has(targetField)) {
      mapped[targetField] = value;
    } else {
      // Try snake_case version of the original header
      const snaked = csvCol
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      if (KNOWN_FIELDS.has(snaked)) {
        mapped[snaked] = value;
      }
    }
  }
  return mapped;
}

/**
 * Detect encoding by checking for UTF-8 BOM and trying to decode.
 * Falls back to ISO-8859-1 if UTF-8 decoding produces replacement chars.
 */
function decodeBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // Check for UTF-8 BOM (EF BB BF)
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const start = hasBom ? 3 : 0;

  // Try UTF-8 first
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(start));

  // If it contains replacement characters, try ISO-8859-1
  if (utf8.includes('\uFFFD')) {
    return new TextDecoder('iso-8859-1').decode(bytes.subarray(start));
  }

  return utf8;
}

/**
 * Validate a single mapped row and return a ValidatedRow or errors.
 */
function validateRow(
  mapped: Record<string, string>,
  rowNumber: number,
): { row: ValidatedRow | null; errors: RowError[] } {
  const errors: RowError[] = [];

  // Run each field validator and collect errors + cleaned values
  const firstName = validateFirstName(mapped, rowNumber);
  const dateOfBirth = validateDateOfBirth(mapped, rowNumber);
  const gender = validateGender(mapped, rowNumber);
  const socialCategory = validateSocialCategory(mapped, rowNumber);
  const phone = validatePhone(mapped, rowNumber);
  const admissionType = validateAdmissionType(mapped, rowNumber);
  const bloodGroup = validateBloodGroup(mapped, rowNumber);

  const validations = [
    firstName,
    dateOfBirth,
    gender,
    socialCategory,
    phone,
    admissionType,
    bloodGroup,
  ];
  for (const v of validations) {
    if (v.error) errors.push(v.error);
  }

  if (errors.length > 0) {
    return { row: null, errors };
  }

  return {
    row: {
      rowNumber,
      firstName: firstName.value ?? '',
      lastName: mapped.last_name?.trim() || undefined,
      dateOfBirth: dateOfBirth.value ?? '',
      gender: gender.value as Gender,
      fatherName: mapped.father_name?.trim() || undefined,
      motherName: mapped.mother_name?.trim() || undefined,
      phone: phone.value,
      email: mapped.email?.trim() || undefined,
      socialCategory: socialCategory.value,
      admissionType: admissionType.value,
      admissionNumber: mapped.admission_number?.trim() || undefined,
      standardId: mapped.standard_id?.trim() || undefined,
      sectionId: mapped.section_id?.trim() || undefined,
      religion: mapped.religion?.trim() || undefined,
      bloodGroup: bloodGroup.value,
      previousSchoolName: mapped.previous_school_name?.trim() || undefined,
    },
    errors: [],
  };
}

// ── Activity factory ──────────────────────────────────────

/**
 * NATS client shape — minimal interface for event emission.
 * Using a narrow type instead of ClientProxy to allow null when NATS is not yet wired.
 */
interface NatsEmitter {
  emit(
    pattern: string,
    data: unknown,
  ): { subscribe: (opts: { error?: (err: unknown) => void }) => void };
}

// ── Extracted DB helpers for insertBatch ──────────────────

/** Find existing user by phone number. Returns userId or null. */
async function findUserByPhone(db: DrizzleDB, phone: string): Promise<string | null> {
  const existing = await withAdmin(db, async (tx) => {
    return tx
      .select({ userId: phoneNumbers.userId })
      .from(phoneNumbers)
      .where(and(eq(phoneNumbers.countryCode, '+91'), eq(phoneNumbers.number, phone)))
      .limit(1);
  });
  return existing.length > 0 ? existing[0].userId : null;
}

/** Check if admission number already exists for this tenant. */
async function admissionNumberExists(
  db: DrizzleDB,
  tenantId: string,
  admNo: string,
): Promise<boolean> {
  const existing = await withTenant(db, tenantId, async (tx) => {
    return tx
      .select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(eq(studentProfiles.admissionNumber, admNo))
      .limit(1);
  });
  return existing.length > 0;
}

/** Create a new user + phone record. Returns the new userId. */
async function createUser(db: DrizzleDB, row: ValidatedRow, tenantId: string): Promise<string> {
  const email = row.email ?? `student-${Date.now()}-${row.rowNumber}@roviq.placeholder`;
  const username = `student-${tenantId.slice(0, 8)}-${Date.now()}-${row.rowNumber}`;

  const newUsers = await withAdmin(db, async (tx) => {
    return tx
      .insert(users)
      .values({ email, username, passwordHash: '$placeholder-bulk-import' })
      .returning({ id: users.id });
  });
  const userId = newUsers[0].id;

  // Create phone_number record if provided
  const phoneNumber = row.phone;
  if (phoneNumber) {
    await withAdmin(db, async (tx) => {
      await tx
        .insert(phoneNumbers)
        .values({
          userId,
          countryCode: '+91',
          number: phoneNumber,
          isPrimary: true,
          label: 'personal',
        })
        .onConflictDoNothing();
    });
  }

  return userId;
}

/** Find the 'student' role for a tenant. Returns roleId or null. */
async function findStudentRoleId(db: DrizzleDB, tenantId: string): Promise<string | null> {
  const studentRole = await withTenant(db, tenantId, async (tx) => {
    return tx
      .select({ id: roles.id })
      .from(roles)
      .where(
        and(
          eq(roles.tenantId, tenantId),
          sql`${roles.name}->>'en' = 'student' OR ${roles.name}->>'en' = 'Student'`,
        ),
      )
      .limit(1);
  });
  return studentRole.length > 0 ? studentRole[0].id : null;
}

/** Generate next admission number via tenant_sequences. */
async function generateAdmissionNumber(db: DrizzleDB, tenantId: string): Promise<string> {
  const seqResult = await withTenant(db, tenantId, async (tx) => {
    await tx
      .insert(tenantSequences)
      .values({
        tenantId,
        sequenceName: 'adm_no',
        currentValue: 0n,
        formatTemplate: '{prefix}{value:04d}',
      })
      .onConflictDoNothing();

    const result = await tx.execute(
      sql`SELECT * FROM next_sequence_value(${tenantId}::uuid, 'adm_no')`,
    );
    return result.rows[0] as { next_val: string; formatted: string };
  });
  return seqResult.formatted || `ADM-${seqResult.next_val}`;
}

/** Generate next roll number for a section+year via tenant_sequences. */
async function generateRollNumber(
  db: DrizzleDB,
  tenantId: string,
  sectionId: string,
  academicYearId: string,
): Promise<string> {
  const rollSeqName = `roll_no:${sectionId}:${academicYearId}`;
  const rollResult = await withTenant(db, tenantId, async (tx) => {
    await tx
      .insert(tenantSequences)
      .values({
        tenantId,
        sequenceName: rollSeqName,
        currentValue: 0n,
        formatTemplate: '{value:04d}',
      })
      .onConflictDoNothing();

    const result = await tx.execute(
      sql`SELECT * FROM next_sequence_value(${tenantId}::uuid, ${rollSeqName})`,
    );
    return result.rows[0] as { next_val: string; formatted: string };
  });
  return rollResult.formatted || String(rollResult.next_val);
}

// ── Per-row insert helpers for insertBatch ───────────────

/** Params shared across all rows in a single batch insert call. */
interface InsertRowContext {
  db: DrizzleDB;
  tenantId: string;
  academicYearId: string;
  defaultStandardId: string;
  defaultSectionId: string;
  createdBy: string;
  studentRoleId: string;
  emitEvent: (pattern: string, data: unknown) => void;
}

/** Create user_profile record (idempotent via onConflictDoNothing). */
async function upsertUserProfile(
  db: DrizzleDB,
  userId: string,
  row: ValidatedRow,
  createdBy: string,
): Promise<void> {
  await withAdmin(db, async (tx) => {
    await tx
      .insert(userProfiles)
      .values({
        userId,
        firstName: { en: row.firstName },
        lastName: row.lastName ? { en: row.lastName } : null,
        gender: row.gender,
        dateOfBirth: row.dateOfBirth,
        bloodGroup: row.bloodGroup ?? null,
        religion: row.religion ?? null,
        nationality: 'Indian',
        createdBy,
        updatedBy: createdBy,
      })
      .onConflictDoNothing();
  });
}

/** Create membership for the student. Returns membershipId, or null if already exists. */
async function createMembership(
  db: DrizzleDB,
  tenantId: string,
  userId: string,
  studentRoleId: string,
  createdBy: string,
): Promise<string | null> {
  const newMemberships = await withTenant(db, tenantId, async (tx) => {
    return tx
      .insert(memberships)
      .values({
        userId,
        tenantId,
        roleId: studentRoleId,
        status: 'ACTIVE',
        abilities: [],
        createdBy,
        updatedBy: createdBy,
      })
      .onConflictDoNothing()
      .returning({ id: memberships.id });
  });
  return newMemberships.length > 0 ? newMemberships[0].id : null;
}

/** Create student_profile + student_academics and emit event. */
async function createStudentRecords(
  ctx: InsertRowContext,
  row: ValidatedRow,
  userId: string,
  membershipId: string,
): Promise<void> {
  const admissionNumber =
    row.admissionNumber ?? (await generateAdmissionNumber(ctx.db, ctx.tenantId));

  const targetStandardId = row.standardId ?? ctx.defaultStandardId;
  const targetSectionId = row.sectionId ?? ctx.defaultSectionId;

  const newProfiles = await withTenant(ctx.db, ctx.tenantId, async (tx) => {
    return tx
      .insert(studentProfiles)
      .values({
        userId,
        membershipId,
        tenantId: ctx.tenantId,
        admissionNumber,
        admissionDate: new Date().toISOString().split('T')[0],
        admissionType: row.admissionType ?? AdmissionType.NEW,
        academicStatus: AcademicStatus.ENROLLED,
        socialCategory: row.socialCategory ?? SocialCategory.GENERAL,
        previousSchoolName: row.previousSchoolName ?? null,
        createdBy: ctx.createdBy,
        updatedBy: ctx.createdBy,
      })
      .returning({ id: studentProfiles.id });
  });

  const rollNumber = await generateRollNumber(
    ctx.db,
    ctx.tenantId,
    targetSectionId,
    ctx.academicYearId,
  );

  await withTenant(ctx.db, ctx.tenantId, async (tx) => {
    await tx.insert(studentAcademics).values({
      studentProfileId: newProfiles[0].id,
      academicYearId: ctx.academicYearId,
      standardId: targetStandardId,
      sectionId: targetSectionId,
      rollNumber,
      tenantId: ctx.tenantId,
      createdBy: ctx.createdBy,
      updatedBy: ctx.createdBy,
    });
  });

  logger.log(
    `Row ${row.rowNumber}: Created student "${row.firstName}" (admission: ${admissionNumber})`,
  );

  ctx.emitEvent('STUDENT.admitted', {
    tenantId: ctx.tenantId,
    userId,
    studentProfileId: newProfiles[0].id,
    admissionNumber,
    rowNumber: row.rowNumber,
  });
}

/**
 * Process a single row for insertion. Returns 'created', 'skipped', or throws on failure.
 */
async function insertSingleRow(
  ctx: InsertRowContext,
  row: ValidatedRow,
): Promise<'created' | 'skipped'> {
  // Dedup by admission number
  if (
    row.admissionNumber &&
    (await admissionNumberExists(ctx.db, ctx.tenantId, row.admissionNumber))
  ) {
    logger.log(
      `Row ${row.rowNumber}: Skipping — admission number ${row.admissionNumber} already exists`,
    );
    return 'skipped';
  }

  // Dedup by phone -> find or create user
  let userId = row.phone ? await findUserByPhone(ctx.db, row.phone) : null;
  if (userId) {
    logger.log(`Row ${row.rowNumber}: Found existing user by phone ${row.phone}`);
  } else {
    userId = await createUser(ctx.db, row, ctx.tenantId);
  }

  // Create user_profile (idempotent)
  await upsertUserProfile(ctx.db, userId, row, ctx.createdBy);

  // Create membership
  const membershipId = await createMembership(
    ctx.db,
    ctx.tenantId,
    userId,
    ctx.studentRoleId,
    ctx.createdBy,
  );
  if (!membershipId) {
    return 'skipped';
  }

  // Create student profile + academics + emit event
  await createStudentRecords(ctx, row, userId, membershipId);
  return 'created';
}

// ── Activity factory ──────────────────────────────────────

/**
 * Create activity implementations bound to DrizzleDB + NATS client.
 * Called at Temporal worker startup — activities close over the connections.
 */
export function createBulkStudentImportActivities(
  db: DrizzleDB,
  natsClient: NatsEmitter | null,
): BulkStudentImportActivities {
  /** Emit a NATS event if client is available. */
  function emitEvent(pattern: string, data: unknown): void {
    if (!natsClient) return;
    natsClient.emit(pattern, data).subscribe({
      error: (err) => logger.warn(`Failed to emit ${pattern}: ${err}`),
    });
  }

  return {
    async parseCsv(fileUrl, fieldMapping) {
      logger.log(`Parsing CSV from: ${fileUrl}`);

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download CSV: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const csvText = decodeBuffer(buffer);

      const parsed = Papa.parse<Record<string, string>>(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      const totalRows = parsed.data.length;
      const validRows: ValidatedRow[] = [];
      const errors: RowError[] = [];

      for (const parseError of parsed.errors) {
        errors.push({
          rowNumber: (parseError.row ?? 0) + 1,
          field: '_parse',
          reason: parseError.message,
        });
      }

      for (let i = 0; i < parsed.data.length; i++) {
        const rawRow = parsed.data[i];
        const mapped = applyFieldMapping(rawRow, fieldMapping);
        const result = validateRow(mapped, i + 1);

        if (result.row) {
          validRows.push(result.row);
        }
        errors.push(...result.errors);
      }

      logger.log(
        `CSV parsed: ${totalRows} total, ${validRows.length} valid, ${errors.length} errors`,
      );
      return { validRows, errors, totalRows };
    },

    async insertBatch(
      tenantId,
      academicYearId,
      defaultStandardId,
      defaultSectionId,
      createdBy,
      rows,
    ) {
      logger.log(`Inserting batch of ${rows.length} rows for tenant ${tenantId}`);

      let created = 0;
      let skipped = 0;
      const errors: RowError[] = [];

      // Look up student role once per batch (same tenant)
      const studentRoleId = await findStudentRoleId(db, tenantId);
      if (!studentRoleId) {
        for (const row of rows) {
          errors.push({
            rowNumber: row.rowNumber,
            field: '_system',
            reason: 'Student role not found for this institute',
          });
        }
        return { created, skipped, errors };
      }

      const ctx: InsertRowContext = {
        db,
        tenantId,
        academicYearId,
        defaultStandardId,
        defaultSectionId,
        createdBy,
        studentRoleId,
        emitEvent,
      };

      for (const row of rows) {
        try {
          const result = await insertSingleRow(ctx, row);
          if (result === 'created') {
            created++;
          } else {
            skipped++;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(`Row ${row.rowNumber}: Insert failed — ${message}`);
          errors.push({
            rowNumber: row.rowNumber,
            field: '_system',
            reason: `Insert failed: ${message}`,
          });
        }
      }

      logger.log(`Batch complete: ${created} created, ${skipped} skipped, ${errors.length} errors`);
      return { created, skipped, errors };
    },

    async generateReport(tenantId, errors, totalRows, created, skippedCount) {
      logger.log(`Generating import report for tenant ${tenantId}`);

      // Build error CSV
      const csvRows = errors.map((e) => ({
        row_number: e.rowNumber,
        field: e.field,
        error: e.reason,
        original_value: e.originalValue ?? '',
      }));

      const csvContent = Papa.unparse(csvRows);

      // Build full report content with summary header
      const reportContent = [
        `# Bulk Import Report`,
        `# Total rows: ${totalRows}`,
        `# Created: ${created}`,
        `# Skipped: ${skippedCount}`,
        `# Errors: ${errors.length}`,
        `#`,
        csvContent,
      ].join('\n');

      // Upload to MinIO/S3
      // TODO: Replace with actual MinIO client when storage service is built.
      // The reportContent will be uploaded as the CSV file body.
      const reportKey = `imports/${tenantId}/report-${Date.now()}.csv`;
      logger.log(`[STUB] Would upload ${reportContent.length} bytes to MinIO: ${reportKey}`);
      logger.log(
        `Report summary: ${totalRows} total, ${created} created, ${skippedCount} skipped, ${errors.length} errors`,
      );

      // Return stub URL — actual MinIO upload will be wired when storage service is available
      const reportUrl = `/api/storage/${reportKey}`;

      return { reportUrl };
    },
  };
}
