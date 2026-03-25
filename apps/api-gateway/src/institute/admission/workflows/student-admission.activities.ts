/**
 * Activities for StudentAdmissionWorkflow (ROV-159).
 *
 * Each activity is idempotent — checks "does this already exist?" before creating.
 * DrizzleDB + NATS client injected via closure at worker startup.
 */
import { Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
  admissionApplications,
  type DrizzleDB,
  enquiries,
  memberships,
  phoneNumbers,
  roles,
  sections,
  studentAcademics,
  studentProfiles,
  tenantSequences,
  userProfiles,
  users,
  withAdmin,
  withTenant,
} from '@roviq/database';
import { and, eq, sql } from 'drizzle-orm';
import type { StudentAdmissionActivities } from './student-admission.types';

const logger = new Logger('StudentAdmissionActivities');

export function createStudentAdmissionActivities(
  db: DrizzleDB,
  _natsClient: ClientProxy,
): StudentAdmissionActivities {
  return {
    async loadApplicationData(applicationId, tenantId) {
      logger.log(`Loading application ${applicationId}`);

      const apps = await withTenant(db, tenantId, async (tx) => {
        return tx
          .select()
          .from(admissionApplications)
          .where(eq(admissionApplications.id, applicationId))
          .limit(1);
      });

      if (apps.length === 0) throw new Error(`Application ${applicationId} not found`);
      const application = apps[0];

      let enquiry: Record<string, unknown> | null = null;
      const enquiryId = application.enquiryId;
      if (enquiryId) {
        const enqs = await withTenant(db, tenantId, async (tx) => {
          return tx.select().from(enquiries).where(eq(enquiries.id, enquiryId)).limit(1);
        });
        enquiry = (enqs[0] as unknown as Record<string, unknown>) ?? null;
      }

      return {
        application: application as unknown as Record<string, unknown>,
        enquiry,
      };
    },

    async validateSectionCapacity(tenantId, sectionId) {
      logger.log(`Validating capacity for section ${sectionId}`);

      const sectionRows = await withTenant(db, tenantId, async (tx) => {
        return tx
          .select({ currentStrength: sections.currentStrength, capacity: sections.capacity })
          .from(sections)
          .where(eq(sections.id, sectionId))
          .limit(1);
      });

      if (sectionRows.length === 0) throw new Error(`Section ${sectionId} not found`);

      const { currentStrength, capacity } = sectionRows[0];
      if (capacity && currentStrength >= capacity) {
        logger.warn(`Section ${sectionId} at capacity (${currentStrength}/${capacity})`);
        // Warning only — hard block is in the enrollment service
      }
    },

    async createUserAndMembership(tenantId, formData, createdBy) {
      const phone = (formData.parentPhone ?? formData.parent_phone) as string | undefined;

      // Find or create user — guaranteed string by end of block
      const userId = await (async (): Promise<string> => {
        if (phone) {
          const existing = await withAdmin(db, async (tx) => {
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

        // TODO: Replace with NATS call when Identity Service is ready
        const email = `admission-${Date.now()}@roviq.placeholder`;
        const username = `admission-${Date.now()}`;
        const newUsers = await withAdmin(db, async (tx) => {
          return tx
            .insert(users)
            .values({ email, username, passwordHash: '$placeholder-admission' })
            .returning({ id: users.id });
        });
        const newUserId = newUsers[0].id;

        if (phone) {
          await withAdmin(db, async (tx) => {
            await tx
              .insert(phoneNumbers)
              .values({
                userId: newUserId,
                countryCode: '+91',
                number: phone,
                isPrimary: true,
                label: 'personal',
              })
              .onConflictDoNothing();
          });
        }

        return newUserId;
      })();

      // Find student role
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

      if (studentRole.length === 0) throw new Error('Student role not found');

      // Create membership (idempotent)
      const newMemberships = await withTenant(db, tenantId, async (tx) => {
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
        const existing = await withTenant(db, tenantId, async (tx) => {
          return tx
            .select({ id: memberships.id })
            .from(memberships)
            .where(
              and(
                eq(memberships.userId, userId),
                eq(memberships.tenantId, tenantId),
                eq(memberships.roleId, studentRole[0].id),
              ),
            )
            .limit(1);
        });
        membershipId = existing[0].id;
      }

      return { userId, membershipId };
    },

    async createUserProfile(userId, formData, createdBy) {
      const firstName = (formData.firstName ??
        formData.first_name ??
        formData.studentName ??
        formData.student_name ??
        'Student') as string;
      const lastName = (formData.lastName ?? formData.last_name) as string | undefined;

      await withAdmin(db, async (tx) => {
        await tx
          .insert(userProfiles)
          .values({
            userId,
            firstName,
            lastName: lastName ?? null,
            gender: (formData.gender as string) ?? null,
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
      const existing = await withTenant(db, tenantId, async (tx) => {
        return tx
          .select({ id: studentProfiles.id, admissionNumber: studentProfiles.admissionNumber })
          .from(studentProfiles)
          .where(eq(studentProfiles.membershipId, membershipId))
          .limit(1);
      });

      if (existing.length > 0) {
        return { studentProfileId: existing[0].id, admissionNumber: existing[0].admissionNumber };
      }

      // Generate admission number
      await withTenant(db, tenantId, async (tx) => {
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

      const seqResult = await withTenant(db, tenantId, async (tx) => {
        const result = await tx.execute(
          sql`SELECT * FROM next_sequence_value(${tenantId}::uuid, 'adm_no')`,
        );
        return result.rows[0] as { next_val: string; formatted: string };
      });

      const admissionNumber = seqResult.formatted || `ADM-${seqResult.next_val}`;

      const rows = await withTenant(db, tenantId, async (tx) => {
        return tx
          .insert(studentProfiles)
          .values({
            userId,
            membershipId,
            tenantId,
            admissionNumber,
            admissionDate: new Date().toISOString().split('T')[0],
            admissionType: 'new',
            academicStatus: 'enrolled',
            socialCategory: (formData.socialCategory ??
              formData.social_category ??
              'general') as string,
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
      await withTenant(db, tenantId, async (tx) => {
        await tx
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
          .onConflictDoNothing();

        // Increment section strength
        await tx
          .update(sections)
          .set({ currentStrength: sql`${sections.currentStrength} + 1` })
          .where(eq(sections.id, sectionId));
      });
    },

    async linkGuardians(_tenantId, _studentProfileId, formData, _createdBy) {
      // TODO: Create guardian_student_links when guardian module is implemented
      const parentName = formData.parentName ?? formData.parent_name;
      if (parentName) {
        logger.log(`[STUB] Would link guardian: ${parentName}`);
      }
    },

    async updateApplicationEnrolled(applicationId, tenantId, studentProfileId, updatedBy) {
      await withTenant(db, tenantId, async (tx) => {
        await tx
          .update(admissionApplications)
          .set({
            status: 'enrolled',
            studentProfileId,
            updatedBy,
          })
          .where(eq(admissionApplications.id, applicationId));
      });
    },

    async emitStudentAdmittedEvent(
      tenantId,
      studentProfileId,
      _membershipId,
      _standardId,
      sectionId,
    ) {
      // TODO: Use NATS JetStream client when available in activity context
      logger.log(
        `[STUB] NATS emit student.admitted: student=${studentProfileId}, section=${sectionId}, tenant=${tenantId}`,
      );
    },

    async applyPreviousSchoolData(tenantId, studentProfileId, formData, updatedBy) {
      const previousSchool = (formData.previousSchool ?? formData.previous_school) as
        | string
        | undefined;
      if (!previousSchool) return;

      await withTenant(db, tenantId, async (tx) => {
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
