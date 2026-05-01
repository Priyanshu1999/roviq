/**
 * Activities for StudentAdmissionWorkflow (ROV-159).
 *
 * Each activity is idempotent — checks "does this already exist?" before creating.
 * DrizzleDB + NATS client injected via closure at worker startup.
 */
import { Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
  AcademicStatus,
  AdmissionApplicationStatus,
  AdmissionType,
  DefaultRoles,
  Gender,
  GuardianRelationship,
  SocialCategory,
} from '@roviq/common-types';
import {
  admissionApplications,
  admissionApplicationsLive,
  type DrizzleDB,
  enquiriesLive,
  guardianProfiles,
  guardianProfilesLive,
  memberships,
  membershipsLive,
  mkAdminCtx,
  mkInstituteCtx,
  phoneNumbers,
  rolesLive,
  sections,
  sectionsLive,
  studentAcademics,
  studentGuardianLinks,
  studentProfiles,
  studentProfilesLive,
  tenantSequences,
  userProfiles,
  users,
  withAdmin,
  withTenant,
} from '@roviq/database';
import type { EventPattern } from '@roviq/nats-jetstream';
import { and, eq, sql } from 'drizzle-orm';
import type { IdentityService } from '../../../auth/identity.service';
import type {
  ApplicationPayload,
  EnquiryPayload,
  StudentAdmissionActivities,
} from './student-admission.types';

const logger = new Logger('StudentAdmissionActivities');

/**
 * Narrow interface over ClientProxy so the factory accepts either the
 * NestJS microservice client or `null` (for tests / callers that haven't
 * wired NATS yet — mirrors the bulk-student-import pattern).
 */
interface NatsEmitter {
  emit(
    pattern: string,
    data: unknown,
  ): { subscribe: (opts: { error?: (err: unknown) => void }) => void };
}

export function createStudentAdmissionActivities(
  db: DrizzleDB,
  natsClient: ClientProxy | NatsEmitter | null,
  identityService: IdentityService,
): StudentAdmissionActivities {
  function emitEvent(pattern: EventPattern, data: unknown): void {
    if (!natsClient) return;
    natsClient.emit(pattern, data).subscribe({
      error: (err: unknown) => logger.warn(`Failed to emit ${pattern}: ${String(err)}`),
    });
  }

  return {
    async loadApplicationData(applicationId, tenantId) {
      logger.log(`Loading application ${applicationId}`);

      const apps = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
        return tx
          .select({
            id: admissionApplicationsLive.id,
            enquiryId: admissionApplicationsLive.enquiryId,
            academicYearId: admissionApplicationsLive.academicYearId,
            standardId: admissionApplicationsLive.standardId,
            sectionId: admissionApplicationsLive.sectionId,
            formData: admissionApplicationsLive.formData,
            status: admissionApplicationsLive.status,
            isRteApplication: admissionApplicationsLive.isRteApplication,
            studentProfileId: admissionApplicationsLive.studentProfileId,
          })
          .from(admissionApplicationsLive)
          .where(eq(admissionApplicationsLive.id, applicationId))
          .limit(1);
      });

      if (apps.length === 0) throw new Error(`Application ${applicationId} not found`);

      // Construct an explicit typed payload — only the fields the workflow
      // reads, using JSON-primitive types so Temporal's serialiser
      // round-trips them faithfully without custom codecs.
      const row = apps[0];
      const application: ApplicationPayload = {
        id: row.id,
        enquiryId: row.enquiryId,
        academicYearId: row.academicYearId,
        standardId: row.standardId,
        sectionId: row.sectionId,
        formData: row.formData,
        status: row.status,
        isRteApplication: row.isRteApplication,
        studentProfileId: row.studentProfileId,
      };

      let enquiry: EnquiryPayload | null = null;
      const { enquiryId } = row;
      if (enquiryId) {
        const enqs = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
          return tx
            .select({
              id: enquiriesLive.id,
              parentPhone: enquiriesLive.parentPhone,
              parentName: enquiriesLive.parentName,
              source: enquiriesLive.source,
            })
            .from(enquiriesLive)
            .where(eq(enquiriesLive.id, enquiryId))
            .limit(1);
        });
        enquiry = enqs[0] ?? null;
      }

      return { application, enquiry };
    },

    async validateSectionCapacity(tenantId, sectionId) {
      logger.log(`Validating capacity for section ${sectionId}`);

      const sectionRows = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
        return tx
          .select({
            currentStrength: sectionsLive.currentStrength,
            capacity: sectionsLive.capacity,
          })
          .from(sectionsLive)
          .where(eq(sectionsLive.id, sectionId))
          .limit(1);
      });

      if (sectionRows.length === 0) throw new Error(`Section ${sectionId} not found`);

      const { currentStrength, capacity } = sectionRows[0];
      if (capacity && currentStrength >= capacity) {
        logger.warn(`Section ${sectionId} at capacity (${currentStrength}/${capacity})`);
        // Warning only — hard block is in the enrollment service
      }
    },

    async createUserAndMembership(tenantId, formData, createdBy, seed) {
      const phone = (formData.parentPhone ?? formData.parent_phone) as string | undefined;

      // Find or create user — guaranteed string by end of block
      const userId = await (async (): Promise<string> => {
        if (phone) {
          const existing = await withAdmin(db, mkAdminCtx(), async (tx) => {
            return tx
              .select({ userId: phoneNumbers.userId })
              .from(phoneNumbers)
              .where(and(eq(phoneNumbers.countryCode, '+91'), eq(phoneNumbers.number, phone)))
              .limit(1);
          });
          if (existing.length > 0) {
            logger.log(`Found existing user by phone: ${existing[0].userId}`);
            return existing[0].userId;
          }
        }

        // Deterministic placeholder email derived from the stable applicationId
        // seed so every Temporal retry resolves the same user. Check for an
        // existing row by email *before* calling IdentityService — without this
        // guard, a retry would re-enter createUser() and throw a unique-
        // constraint violation on `users.email`.
        const email = `admission-${seed}@roviq.placeholder`;
        const username = `admission-${seed}`;

        const existingByEmail = await withAdmin(db, mkAdminCtx(), async (tx) => {
          return tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
        });
        if (existingByEmail.length > 0) {
          logger.log(`Found existing placeholder user by email: ${existingByEmail[0].id}`);
          return existingByEmail[0].id;
        }

        const { userId: newUserId } = await identityService.createUser({
          email,
          username,
          phone: phone ? { countryCode: '+91', number: phone } : undefined,
        });
        emitEvent('USER.admission_created', {
          tenantId,
          userId: newUserId,
          email,
          username,
          phone: phone ?? null,
        });

        return newUserId;
      })();

      // Find student role
      const studentRole = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
        return tx
          .select({ id: rolesLive.id })
          .from(rolesLive)
          .where(
            and(
              eq(rolesLive.tenantId, tenantId),
              sql`${rolesLive.name}->>'en' = 'student' OR ${rolesLive.name}->>'en' = 'Student'`,
            ),
          )
          .limit(1);
      });

      if (studentRole.length === 0) throw new Error('Student role not found');

      // Create membership (idempotent)
      const newMemberships = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
        return tx
          .insert(memberships)
          .values({
            userId,
            tenantId,
            roleId: studentRole[0].id,
            status: 'ACTIVE',
            abilities: [],
            createdBy,
            updatedBy: createdBy,
          })
          .onConflictDoNothing()
          .returning({ id: memberships.id });
      });

      let membershipId: string;
      if (newMemberships.length > 0) {
        membershipId = newMemberships[0].id;
      } else {
        const existing = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
          return tx
            .select({ id: membershipsLive.id })
            .from(membershipsLive)
            .where(
              and(
                eq(membershipsLive.userId, userId),
                eq(membershipsLive.tenantId, tenantId),
                eq(membershipsLive.roleId, studentRole[0].id),
              ),
            )
            .limit(1);
        });
        membershipId = existing[0].id;
      }

      return { userId, membershipId };
    },

    async createUserProfile(userId, formData, createdBy) {
      const firstNameStr = (formData.firstName ??
        formData.first_name ??
        formData.studentName ??
        formData.student_name ??
        'Student') as string;
      const lastNameStr = (formData.lastName ?? formData.last_name) as string | undefined;

      await withAdmin(db, mkAdminCtx(), async (tx) => {
        await tx
          .insert(userProfiles)
          .values({
            userId,
            firstName: { en: firstNameStr },
            lastName: lastNameStr ? { en: lastNameStr } : null,
            gender: (formData.gender as Gender) ?? null,
            dateOfBirth: ((formData.dateOfBirth ?? formData.date_of_birth) as string) ?? null,
            nationality: 'Indian',
            createdBy,
            updatedBy: createdBy,
          })
          .onConflictDoNothing();
      });
    },

    async createStudentProfile(
      tenantId,
      userId,
      membershipId,
      _standardId,
      formData,
      isRte,
      createdBy,
    ) {
      // Check if already created (idempotent)
      const existing = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
        return tx
          .select({
            id: studentProfilesLive.id,
            admissionNumber: studentProfilesLive.admissionNumber,
          })
          .from(studentProfilesLive)
          .where(eq(studentProfilesLive.membershipId, membershipId))
          .limit(1);
      });

      if (existing.length > 0) {
        return { studentProfileId: existing[0].id, admissionNumber: existing[0].admissionNumber };
      }

      // Generate admission number
      await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
        await tx
          .insert(tenantSequences)
          .values({
            tenantId,
            sequenceName: 'adm_no',
            currentValue: 0n,
            formatTemplate: '{prefix}{value:04d}',
          })
          .onConflictDoNothing();
      });

      const seqResult = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
        const result = await tx.execute(
          sql`SELECT * FROM next_sequence_value(${tenantId}::uuid, 'adm_no')`,
        );
        return result.rows[0] as { next_val: string; formatted: string };
      });

      const admissionNumber = seqResult.formatted || `ADM-${seqResult.next_val}`;

      const rows = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
        return tx
          .insert(studentProfiles)
          .values({
            userId,
            membershipId,
            tenantId,
            admissionNumber,
            admissionDate: new Date().toISOString().split('T')[0],
            admissionType: AdmissionType.NEW,
            academicStatus: AcademicStatus.ENROLLED,
            socialCategory: (formData.socialCategory ??
              formData.social_category ??
              SocialCategory.GENERAL) as SocialCategory,
            isRteAdmitted: isRte,
            createdBy,
            updatedBy: createdBy,
          })
          .returning({ id: studentProfiles.id });
      });

      return { studentProfileId: rows[0].id, admissionNumber };
    },

    async createStudentAcademics(
      tenantId,
      studentProfileId,
      academicYearId,
      standardId,
      sectionId,
      createdBy,
    ) {
      // Temporal retries activities, so this must be idempotent. The seat
      // count on `sections.current_strength` is only bumped when the
      // student_academics row is *actually inserted* — guarding the bump on
      // `RETURNING { id }` length means a retry whose insert is skipped by
      // `onConflictDoNothing` skips the bump too, preventing double-counts.
      await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
        const inserted = await tx
          .insert(studentAcademics)
          .values({
            studentProfileId,
            academicYearId,
            standardId,
            sectionId,
            tenantId,
            createdBy,
            updatedBy: createdBy,
          })
          .onConflictDoNothing()
          .returning({ id: studentAcademics.id });

        if (inserted.length > 0) {
          await tx
            .update(sections)
            .set({ currentStrength: sql`${sections.currentStrength} + 1` })
            .where(eq(sections.id, sectionId));
        }
      });
    },

    async linkGuardians(tenantId, studentProfileId, formData, createdBy, seed) {
      const parentPhone = (formData.parentPhone ?? formData.parent_phone) as string | undefined;
      const parentName = (formData.parentName ?? formData.parent_name) as string | undefined;
      const relationshipRaw = (formData.parentRelation ?? formData.parent_relation) as
        | string
        | undefined;

      if (!parentPhone) {
        logger.warn(
          `No parent phone in formData for student ${studentProfileId} — cannot link guardian`,
        );
        return;
      }

      // Find the guardian user by phone; create a placeholder if absent.
      const guardianUserId = await (async (): Promise<string> => {
        const existing = await withAdmin(db, mkAdminCtx(), async (tx) => {
          return tx
            .select({ userId: phoneNumbers.userId })
            .from(phoneNumbers)
            .where(and(eq(phoneNumbers.countryCode, '+91'), eq(phoneNumbers.number, parentPhone)))
            .limit(1);
        });
        if (existing.length > 0) return existing[0].userId;

        // Check by deterministic placeholder email before creating — a Temporal
        // retry would otherwise fail with a unique-constraint violation on
        // `users.email` when IdentityService tries to insert the same row again.
        const email = `guardian-${seed}@roviq.placeholder`;
        const username = `guardian-${seed}`;

        const existingByEmail = await withAdmin(db, mkAdminCtx(), async (tx) => {
          return tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
        });
        if (existingByEmail.length > 0) {
          logger.log(`Found existing placeholder guardian by email: ${existingByEmail[0].id}`);
          return existingByEmail[0].id;
        }

        const { userId: newId } = await identityService.createUser({
          email,
          username,
          phone: { countryCode: '+91', number: parentPhone },
        });
        return newId;
      })();

      // Upsert the guardian's user_profile so the display name is populated.
      if (parentName) {
        await withAdmin(db, mkAdminCtx(), async (tx) => {
          await tx
            .insert(userProfiles)
            .values({
              userId: guardianUserId,
              firstName: { en: parentName },
              nationality: 'Indian',
              createdBy,
              updatedBy: createdBy,
            })
            .onConflictDoNothing();
        });
      }

      // Find the tenant's Parent role.
      const parentRole = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
        return tx
          .select({ id: rolesLive.id })
          .from(rolesLive)
          .where(
            and(
              eq(rolesLive.tenantId, tenantId),
              sql`${rolesLive.name}->>'en' = ${DefaultRoles.Parent}`,
            ),
          )
          .limit(1);
      });
      if (parentRole.length === 0) {
        logger.warn(`Parent role not found for tenant ${tenantId} — cannot link guardian`);
        return;
      }

      // Find-or-create the guardian's membership for this tenant.
      const membershipId = await (async (): Promise<string> => {
        const existing = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
          return tx
            .select({ id: membershipsLive.id })
            .from(membershipsLive)
            .where(
              and(
                eq(membershipsLive.userId, guardianUserId),
                eq(membershipsLive.tenantId, tenantId),
                eq(membershipsLive.roleId, parentRole[0].id),
              ),
            )
            .limit(1);
        });
        if (existing.length > 0) return existing[0].id;

        const created = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
          return tx
            .insert(memberships)
            .values({
              userId: guardianUserId,
              tenantId,
              roleId: parentRole[0].id,
              status: 'ACTIVE',
              abilities: [],
              createdBy,
              updatedBy: createdBy,
            })
            .returning({ id: memberships.id });
        });
        return created[0].id;
      })();

      // Find-or-create the guardian_profile (one per membership, enforced by a
      // unique constraint on guardian_profiles.membership_id).
      const guardianProfileId = await (async (): Promise<string> => {
        const existing = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
          return tx
            .select({ id: guardianProfilesLive.id })
            .from(guardianProfilesLive)
            .where(eq(guardianProfilesLive.membershipId, membershipId))
            .limit(1);
        });
        if (existing.length > 0) return existing[0].id;

        const created = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
          return tx
            .insert(guardianProfiles)
            .values({
              userId: guardianUserId,
              membershipId,
              tenantId,
              createdBy,
              updatedBy: createdBy,
            })
            .returning({ id: guardianProfiles.id });
        });
        return created[0].id;
      })();

      const relationship = (Object.values(GuardianRelationship) as string[]).includes(
        (relationshipRaw ?? '').toUpperCase(),
      )
        ? ((relationshipRaw as string).toUpperCase() as GuardianRelationship)
        : GuardianRelationship.FATHER;

      // Create the student↔guardian link (idempotent — uq_student_guardian
      // prevents duplicates). Promote to primary contact when the student has
      // none, so downstream communications have a deterministic recipient.
      const existingPrimary = await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
        return tx
          .select({ id: studentGuardianLinks.id })
          .from(studentGuardianLinks)
          .where(
            and(
              eq(studentGuardianLinks.studentProfileId, studentProfileId),
              eq(studentGuardianLinks.isPrimaryContact, true),
            ),
          )
          .limit(1);
      });
      const shouldBePrimary = existingPrimary.length === 0;

      await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
        await tx
          .insert(studentGuardianLinks)
          .values({
            tenantId,
            studentProfileId,
            guardianProfileId,
            relationship,
            isPrimaryContact: shouldBePrimary,
            isEmergencyContact: shouldBePrimary,
            canPickup: true,
            livesWith: true,
          })
          .onConflictDoNothing();
      });

      emitEvent('GUARDIAN.linked', {
        tenantId,
        guardianProfileId,
        studentProfileId,
        relationship,
      });

      logger.log(
        `Linked guardian ${guardianProfileId} to student ${studentProfileId} as ${relationship}`,
      );
    },

    async updateApplicationEnrolled(applicationId, tenantId, studentProfileId, updatedBy) {
      await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
        await tx
          .update(admissionApplications)
          .set({
            status: AdmissionApplicationStatus.ENROLLED,
            studentProfileId,
            updatedBy,
          })
          .where(eq(admissionApplications.id, applicationId));
      });
    },

    async emitStudentAdmittedEvent(
      tenantId,
      studentProfileId,
      membershipId,
      standardId,
      sectionId,
    ) {
      emitEvent('STUDENT.admitted', {
        tenantId,
        studentProfileId,
        membershipId,
        standardId,
        sectionId,
      });
      logger.log(`student.admitted emitted: student=${studentProfileId} tenant=${tenantId}`);
    },

    async applyPreviousSchoolData(tenantId, studentProfileId, formData, updatedBy) {
      const previousSchool = (formData.previousSchool ?? formData.previous_school) as
        | string
        | undefined;
      if (!previousSchool) return;

      await withTenant(db, mkInstituteCtx(tenantId), async (tx) => {
        await tx
          .update(studentProfiles)
          .set({
            previousSchoolName: previousSchool,
            previousSchoolBoard:
              ((formData.previousBoard ?? formData.previous_board) as string) ?? null,
            updatedBy,
          })
          .where(eq(studentProfiles.id, studentProfileId));
      });
    },
  };
}
