/**
 * Activities for BulkStudentImportWorkflow (ROV-155, PRD §7.1).
 *
 * Each activity is idempotent where possible.
 * DrizzleDB + NATS client injected via closure at worker startup.
 */
import { Logger } from '@nestjs/common';
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

const VALID_GENDERS = new Set(['male', 'female', 'other']);
const VALID_SOCIAL_CATEGORIES = new Set(['general', 'sc', 'st', 'obc', 'ews']);
const VALID_ADMISSION_TYPES = new Set(['new', 'rte', 'lateral_entry', 're_admission', 'transfer']);
const VALID_BLOOD_GROUPS = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

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

  // ── Required fields ─────────────────────────────────
  const firstName = mapped.first_name?.trim();
  if (!firstName) {
    errors.push({
      rowNumber,
      field: 'first_name',
      reason: 'First name is required',
      originalValue: mapped.first_name,
    });
  }

  const rawDob = mapped.date_of_birth?.trim();
  let dateOfBirth: string | null = null;
  if (!rawDob) {
    errors.push({
      rowNumber,
      field: 'date_of_birth',
      reason: 'Date of birth is required',
      originalValue: rawDob,
    });
  } else {
    dateOfBirth = parseDate(rawDob);
    if (!dateOfBirth) {
      errors.push({
        rowNumber,
        field: 'date_of_birth',
        reason: 'Invalid date format. Expected DD/MM/YYYY or YYYY-MM-DD',
        originalValue: rawDob,
      });
    }
  }

  const rawGender = mapped.gender?.trim().toLowerCase();
  if (!rawGender) {
    errors.push({
      rowNumber,
      field: 'gender',
      reason: 'Gender is required (male/female/other)',
      originalValue: mapped.gender,
    });
  } else if (!VALID_GENDERS.has(rawGender)) {
    errors.push({
      rowNumber,
      field: 'gender',
      reason: `Invalid gender: "${rawGender}". Must be male, female, or other`,
      originalValue: mapped.gender,
    });
  }

  // ── Optional fields with enum validation ────────────
  const rawSocialCategory = mapped.social_category?.trim().toLowerCase();
  if (rawSocialCategory && !VALID_SOCIAL_CATEGORIES.has(rawSocialCategory)) {
    errors.push({
      rowNumber,
      field: 'social_category',
      reason: `Invalid social category: "${rawSocialCategory}". Must be general, sc, st, obc, or ews`,
      originalValue: mapped.social_category,
    });
  }

  const rawPhone = mapped.phone?.trim().replace(/[\s-]/g, '');
  // Strip +91 or 91 prefix only when input is longer than 10 digits (country code present)
  const phone = rawPhone && rawPhone.length > 10 ? rawPhone.replace(/^\+?91/, '') : rawPhone;
  if (phone && !INDIAN_MOBILE_REGEX.test(phone)) {
    errors.push({
      rowNumber,
      field: 'phone',
      reason: 'Invalid Indian mobile number. Must be 10 digits starting with 6-9',
      originalValue: mapped.phone,
    });
  }

  const rawAdmissionType = mapped.admission_type?.trim().toLowerCase();
  if (rawAdmissionType && !VALID_ADMISSION_TYPES.has(rawAdmissionType)) {
    errors.push({
      rowNumber,
      field: 'admission_type',
      reason: `Invalid admission type: "${rawAdmissionType}"`,
      originalValue: mapped.admission_type,
    });
  }

  const rawBloodGroup = mapped.blood_group?.trim().toUpperCase();
  if (rawBloodGroup && !VALID_BLOOD_GROUPS.has(rawBloodGroup)) {
    errors.push({
      rowNumber,
      field: 'blood_group',
      reason: `Invalid blood group: "${rawBloodGroup}". Must be A+/A-/B+/B-/AB+/AB-/O+/O-`,
      originalValue: mapped.blood_group,
    });
  }

  if (errors.length > 0) {
    return { row: null, errors };
  }

  return {
    row: {
      rowNumber,
      firstName: firstName!,
      lastName: mapped.last_name?.trim() || undefined,
      dateOfBirth: dateOfBirth!,
      gender: rawGender!,
      fatherName: mapped.father_name?.trim() || undefined,
      motherName: mapped.mother_name?.trim() || undefined,
      phone: phone || undefined,
      email: mapped.email?.trim() || undefined,
      socialCategory: rawSocialCategory || undefined,
      admissionType: rawAdmissionType || undefined,
      admissionNumber: mapped.admission_number?.trim() || undefined,
      standardId: mapped.standard_id?.trim() || undefined,
      sectionId: mapped.section_id?.trim() || undefined,
      religion: mapped.religion?.trim() || undefined,
      bloodGroup: rawBloodGroup || undefined,
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
  if (row.phone) {
    await withAdmin(db, async (tx) => {
      await tx
        .insert(phoneNumbers)
        .values({
          userId,
          countryCode: '+91',
          number: row.phone!,
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

      for (const row of rows) {
        try {
          // ── Dedup by admission number ──────────────────
          if (
            row.admissionNumber &&
            (await admissionNumberExists(db, tenantId, row.admissionNumber))
          ) {
            logger.log(
              `Row ${row.rowNumber}: Skipping — admission number ${row.admissionNumber} already exists`,
            );
            skipped++;
            continue;
          }

          // ── Dedup by phone → find or create user ───────
          let userId = row.phone ? await findUserByPhone(db, row.phone) : null;
          if (userId) {
            logger.log(`Row ${row.rowNumber}: Found existing user by phone ${row.phone}`);
          } else {
            userId = await createUser(db, row, tenantId);
          }

          // ── Create user_profile (idempotent) ───────────
          await withAdmin(db, async (tx) => {
            await tx
              .insert(userProfiles)
              .values({
                userId,
                firstName: row.firstName,
                lastName: row.lastName ?? null,
                gender: row.gender,
                dateOfBirth: row.dateOfBirth,
                bloodGroup: row.bloodGroup ?? null,
                religion: row.religion ?? null,
                nationality: 'Indian',
                createdBy: createdBy,
                updatedBy: createdBy,
              })
              .onConflictDoNothing();
          });

          // ── Create membership ──────────────────────────
          const newMemberships = await withTenant(db, tenantId, async (tx) => {
            return tx
              .insert(memberships)
              .values({
                userId,
                tenantId,
                roleId: studentRoleId,
                status: 'ACTIVE',
                abilities: [],
                createdBy: createdBy,
                updatedBy: createdBy,
              })
              .onConflictDoNothing()
              .returning({ id: memberships.id });
          });

          if (newMemberships.length === 0) {
            skipped++;
            continue;
          }

          const membershipId = newMemberships[0].id;

          // ── Admission number (provided or generated) ───
          const admissionNumber =
            row.admissionNumber ?? (await generateAdmissionNumber(db, tenantId));

          // ── Create student_profile ─────────────────────
          const targetStandardId = row.standardId ?? defaultStandardId;
          const targetSectionId = row.sectionId ?? defaultSectionId;

          const newProfiles = await withTenant(db, tenantId, async (tx) => {
            return tx
              .insert(studentProfiles)
              .values({
                userId,
                membershipId,
                tenantId,
                admissionNumber,
                admissionDate: new Date().toISOString().split('T')[0],
                admissionType: row.admissionType ?? 'new',
                academicStatus: 'enrolled',
                socialCategory: row.socialCategory ?? 'general',
                previousSchoolName: row.previousSchoolName ?? null,
                createdBy: createdBy,
                updatedBy: createdBy,
              })
              .returning({ id: studentProfiles.id });
          });

          // ── Create student_academics ───────────────────
          const rollNumber = await generateRollNumber(
            db,
            tenantId,
            targetSectionId,
            academicYearId,
          );

          await withTenant(db, tenantId, async (tx) => {
            await tx.insert(studentAcademics).values({
              studentProfileId: newProfiles[0].id,
              academicYearId,
              standardId: targetStandardId,
              sectionId: targetSectionId,
              rollNumber,
              tenantId,
              createdBy: createdBy,
              updatedBy: createdBy,
            });
          });

          created++;
          logger.log(
            `Row ${row.rowNumber}: Created student "${row.firstName}" (admission: ${admissionNumber})`,
          );

          // ── Emit student.admitted event (PRD §7.1 step 9) ──
          emitEvent('STUDENT.admitted', {
            tenantId,
            userId,
            studentProfileId: newProfiles[0].id,
            admissionNumber,
            rowNumber: row.rowNumber,
          });
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
