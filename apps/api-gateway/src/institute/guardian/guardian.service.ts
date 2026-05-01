/**
 * Guardian service (ROV-157, PRD §3.2-3.3).
 *
 * Handles guardian CRUD, student-guardian linking with primary contact enforcement,
 * sibling discovery, and divorce/access revocation.
 */

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type { EventPattern } from '@roviq/nats-jetstream';
import { DefaultRoles, type GuardianEducationLevel } from '@roviq/common-types';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  guardianProfiles,
  guardianProfilesLive,
  memberships,
  phoneNumbers,
  rolesLive,
  sectionsLive,
  standardsLive,
  studentAcademicsLive,
  studentGuardianLinks,
  studentProfilesLive,
  userProfiles,
  withAdmin,
  withTenant,
} from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { IdentityService } from '../../auth/identity.service';
import type { CreateGuardianInput } from './dto/create-guardian.input';
import type {
  LinkGuardianInput,
  RevokeGuardianAccessInput,
  UnlinkGuardianInput,
} from './dto/link-guardian.input';
import type { ListGuardiansFilterInput } from './dto/list-guardians-filter.input';

@Injectable()
export class GuardianService {
  private readonly logger = new Logger(GuardianService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
    private readonly identityService: IdentityService,
  ) {}

  private get tenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context required');
    return tenantId;
  }

  private get userId(): string {
    return getRequestContext().userId;
  }

  private emitEvent(pattern: EventPattern, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }

  /**
   * Central SELECT shape for the list/detail queries — joins user_profiles
   * so every row carries the guardian's display name + photo + gender.
   * Also LEFT JOINs phone_numbers to surface the guardian's primary phone
   * number, and computes a linked-students count via scalar subquery so
   * the list page can render the "Linked students" column without N+1.
   * Mirrors the `student.service.ts` helper pattern: one place to maintain,
   * avoids column drift between `findById` and `list`.
   */
  private guardianSelect() {
    return {
      id: guardianProfilesLive.id,
      userId: guardianProfilesLive.userId,
      membershipId: guardianProfilesLive.membershipId,
      occupation: guardianProfilesLive.occupation,
      organization: guardianProfilesLive.organization,
      designation: guardianProfilesLive.designation,
      educationLevel: guardianProfilesLive.educationLevel,
      version: guardianProfilesLive.version,
      createdAt: guardianProfilesLive.createdAt,
      updatedAt: guardianProfilesLive.updatedAt,
      // user_profile join
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
      profileImageUrl: userProfiles.profileImageUrl,
      gender: userProfiles.gender,
      // phone_numbers join (primary phone only)
      primaryPhone: phoneNumbers.number,
      // Scalar subquery: count of linked students (excludes soft-deleted links).
      // Cast to int so Drizzle returns `number`, not `string` (PG COUNT returns bigint).
      linkedStudentCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${studentGuardianLinks}
        WHERE ${studentGuardianLinks.guardianProfileId} = ${guardianProfilesLive.id}
      )`.as('linked_student_count'),
    } as const;
  }

  async findById(id: string) {
    const tenantId = this.tenantId;
    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select(this.guardianSelect())
        .from(guardianProfilesLive)
        .innerJoin(userProfiles, eq(userProfiles.userId, guardianProfilesLive.userId))
        .leftJoin(
          phoneNumbers,
          and(
            eq(phoneNumbers.userId, guardianProfilesLive.userId),
            eq(phoneNumbers.isPrimary, true),
          ),
        )
        .where(eq(guardianProfilesLive.id, id))
        .limit(1);
    });
    if (rows.length === 0) throw new NotFoundException(`Guardian profile ${id} not found`);
    return rows[0];
  }

  async list(filter?: ListGuardiansFilterInput) {
    const tenantId = this.tenantId;
    const search = filter?.search?.trim();

    return withTenant(this.db, tenantId, async (tx) => {
      const baseQuery = tx
        .select(this.guardianSelect())
        .from(guardianProfilesLive)
        .innerJoin(userProfiles, eq(userProfiles.userId, guardianProfilesLive.userId))
        .leftJoin(
          phoneNumbers,
          and(
            eq(phoneNumbers.userId, guardianProfilesLive.userId),
            eq(phoneNumbers.isPrimary, true),
          ),
        );

      // Search matches either user_profiles.search_vector (name tokens in
      // en + hi) OR the primary phone number (ilike substring match). The
      // OR lets clerks search by partial phone digits without switching
      // between name/phone filter modes.
      const searchClause = search
        ? or(
            sql`${userProfiles.searchVector} @@ plainto_tsquery('simple', ${search})`,
            ilike(phoneNumbers.number, `%${search}%`),
          )
        : undefined;

      return searchClause ? baseQuery.where(searchClause).limit(200) : baseQuery.limit(200);
    });
  }

  /**
   * Returns all students linked to a single guardian, joined with each
   * student's display name + admission number + current standard/section.
   * Used by the "Linked Children" tab on the guardian detail page (ROV-169).
   * Primary contact links appear first. Only resolves current-year
   * enrollment (studentAcademics row joined to the active academic year).
   */
  async listLinkedStudents(guardianProfileId: string) {
    const tenantId = this.tenantId;
    return withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({
          linkId: studentGuardianLinks.id,
          studentProfileId: studentGuardianLinks.studentProfileId,
          admissionNumber: studentProfilesLive.admissionNumber,
          firstName: userProfiles.firstName,
          lastName: userProfiles.lastName,
          profileImageUrl: userProfiles.profileImageUrl,
          currentStandardName: standardsLive.name,
          currentSectionName: sectionsLive.name,
          relationship: studentGuardianLinks.relationship,
          isPrimaryContact: studentGuardianLinks.isPrimaryContact,
          isEmergencyContact: studentGuardianLinks.isEmergencyContact,
          canPickup: studentGuardianLinks.canPickup,
          livesWith: studentGuardianLinks.livesWith,
        })
        .from(studentGuardianLinks)
        .innerJoin(
          studentProfilesLive,
          eq(studentProfilesLive.id, studentGuardianLinks.studentProfileId),
        )
        .innerJoin(userProfiles, eq(userProfiles.userId, studentProfilesLive.userId))
        .leftJoin(
          studentAcademicsLive,
          and(
            eq(studentAcademicsLive.studentProfileId, studentProfilesLive.id),
            eq(
              studentAcademicsLive.academicYearId,
              sql`(SELECT id FROM academic_years WHERE tenant_id = ${tenantId} AND is_active = true LIMIT 1)`,
            ),
          ),
        )
        .leftJoin(standardsLive, eq(standardsLive.id, studentAcademicsLive.standardId))
        .leftJoin(sectionsLive, eq(sectionsLive.id, studentAcademicsLive.sectionId))
        .where(eq(studentGuardianLinks.guardianProfileId, guardianProfileId))
        .orderBy(sql`${studentGuardianLinks.isPrimaryContact} DESC`);
    });
  }

  /**
   * Returns all guardians linked to a single student, joined with each
   * guardian's display name + photo + occupation. Used by the Guardians tab
   * on the student detail page (ROV-167). Primary contact appears first.
   */
  async listForStudent(studentProfileId: string) {
    const tenantId = this.tenantId;
    return withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({
          linkId: studentGuardianLinks.id,
          guardianProfileId: studentGuardianLinks.guardianProfileId,
          userId: guardianProfilesLive.userId,
          firstName: userProfiles.firstName,
          lastName: userProfiles.lastName,
          profileImageUrl: userProfiles.profileImageUrl,
          occupation: guardianProfilesLive.occupation,
          organization: guardianProfilesLive.organization,
          relationship: studentGuardianLinks.relationship,
          isPrimaryContact: studentGuardianLinks.isPrimaryContact,
          isEmergencyContact: studentGuardianLinks.isEmergencyContact,
          canPickup: studentGuardianLinks.canPickup,
          livesWith: studentGuardianLinks.livesWith,
        })
        .from(studentGuardianLinks)
        .innerJoin(
          guardianProfilesLive,
          eq(guardianProfilesLive.id, studentGuardianLinks.guardianProfileId),
        )
        .innerJoin(userProfiles, eq(userProfiles.userId, guardianProfilesLive.userId))
        .where(eq(studentGuardianLinks.studentProfileId, studentProfileId))
        .orderBy(sql`${studentGuardianLinks.isPrimaryContact} DESC`);
    });
  }

  async create(input: CreateGuardianInput) {
    const tenantId = this.tenantId;
    const actorId = this.userId;

    const suffix = crypto.randomUUID().slice(0, 12);
    const email = input.email ?? `guardian-${suffix}@roviq.placeholder`;
    const username = `guardian-${tenantId.slice(0, 8)}-${suffix}`;
    const phone = input.phone ? { countryCode: '+91', number: input.phone } : undefined;

    const { userId: newUserId } = await this.identityService.createUser({
      email,
      username,
      phone,
    });
    const newUser = { id: newUserId };

    if (input.phone) {
      const phone = input.phone;
      await withAdmin(this.db, async (tx) => {
        await tx
          .insert(phoneNumbers)
          .values({
            userId: newUser.id,
            countryCode: '+91',
            number: phone,
            isPrimary: true,
            label: 'personal',
          })
          .onConflictDoNothing();
      });
    }

    // Create user_profile
    await withAdmin(this.db, async (tx) => {
      await tx
        .insert(userProfiles)
        .values({
          userId: newUser.id,
          firstName: input.firstName,
          lastName: input.lastName ?? null,
          gender: input.gender ?? null,
          nationality: 'Indian',
          createdBy: actorId,
          updatedBy: actorId,
        })
        .onConflictDoNothing();
    });

    // Find parent role using DefaultRoles constant
    const guardianRole = await withTenant(this.db, tenantId, async (tx) => {
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

    if (guardianRole.length === 0)
      throw new NotFoundException('Parent role not found for this institute');

    // Create membership
    const newMembership = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .insert(memberships)
        .values({
          userId: newUser.id,
          tenantId,
          roleId: guardianRole[0].id,
          status: 'ACTIVE',
          abilities: [],
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning({ id: memberships.id });
    });

    // Create guardian_profile
    const profile = await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .insert(guardianProfiles)
        .values({
          userId: newUser.id,
          membershipId: newMembership[0].id,
          tenantId,
          occupation: input.occupation ?? null,
          organization: input.organization ?? null,
          educationLevel: input.educationLevel ?? null,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();
      return rows[0];
    });

    // If student_id provided, link immediately
    if (input.studentProfileId && input.relationship) {
      await this.linkToStudent({
        guardianProfileId: profile.id,
        studentProfileId: input.studentProfileId,
        relationship: input.relationship,
        isPrimaryContact: input.isPrimaryContact ?? false,
      });
    }

    // Re-fetch via findById so the response includes the joined name/photo
    // columns populated from user_profiles (mirrors student.service pattern).
    return this.findById(profile.id);
  }

  async update(
    id: string,
    data: {
      firstName?: Record<string, string>;
      lastName?: Record<string, string>;
      occupation?: string;
      organization?: string;
      designation?: string;
      educationLevel?: GuardianEducationLevel;
      version: number;
    },
  ) {
    const tenantId = this.tenantId;
    const actorId = this.userId;

    // Bump version + write guardian_profiles columns inside the tenant scope.
    const updatedRows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .update(guardianProfiles)
        .set({
          ...(data.occupation != null && { occupation: data.occupation }),
          ...(data.organization != null && { organization: data.organization }),
          ...(data.designation != null && { designation: data.designation }),
          ...(data.educationLevel != null && { educationLevel: data.educationLevel }),
          updatedBy: actorId,
          version: sql`${guardianProfiles.version} + 1`,
        })
        .where(and(eq(guardianProfiles.id, id), eq(guardianProfiles.version, data.version)))
        .returning({ id: guardianProfiles.id, userId: guardianProfiles.userId });
    });

    if (updatedRows.length === 0) {
      throw new ConflictException('Guardian profile version mismatch');
    }

    // Name fields live on the platform-level `user_profiles` table, which
    // requires `withAdmin()` (no RLS on users/user_profiles). Only write the
    // keys the caller actually supplied so we never clobber an unsupplied
    // locale column.
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const guardianUserId = updatedRows[0].userId;
      await withAdmin(this.db, async (tx) => {
        await tx
          .update(userProfiles)
          .set({
            ...(data.firstName !== undefined && { firstName: data.firstName }),
            ...(data.lastName !== undefined && { lastName: data.lastName }),
            updatedBy: actorId,
          })
          .where(eq(userProfiles.userId, guardianUserId));
      });
    }

    // Re-fetch through the joined select so the response carries the
    // updated row AND the user_profiles display fields in one object.
    return this.findById(id);
  }

  async delete(id: string) {
    const tenantId = this.tenantId;
    const actorId = this.userId;

    // Check: guardian is not the only guardian for any student
    const links = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ studentProfileId: studentGuardianLinks.studentProfileId })
        .from(studentGuardianLinks)
        .where(eq(studentGuardianLinks.guardianProfileId, id));
    });

    for (const link of links) {
      const otherGuardians = await withTenant(this.db, tenantId, async (tx) => {
        return tx
          .select({ id: studentGuardianLinks.id })
          .from(studentGuardianLinks)
          .where(
            and(
              eq(studentGuardianLinks.studentProfileId, link.studentProfileId),
              sql`${studentGuardianLinks.guardianProfileId} != ${id}`,
            ),
          )
          .limit(1);
      });

      if (otherGuardians.length === 0) {
        throw new BadRequestException(
          'Cannot delete guardian who is the only guardian for a student. Unlink or assign another guardian first.',
        );
      }
    }

    await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(guardianProfiles)
        .set({ deletedAt: new Date(), deletedBy: actorId })
        .where(and(eq(guardianProfiles.id, id), sql`${guardianProfiles.deletedAt} IS NULL`))
        .returning();
      if (rows.length === 0) throw new NotFoundException(`Guardian ${id} not found`);
    });

    return true;
  }

  // ── Guardian-Student Linking ──────────────────────────

  async linkToStudent(input: LinkGuardianInput) {
    const tenantId = this.tenantId;

    // Validate student exists in this tenant
    const student = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ id: studentProfilesLive.id })
        .from(studentProfilesLive)
        .where(eq(studentProfilesLive.id, input.studentProfileId))
        .limit(1);
    });
    if (student.length === 0)
      throw new NotFoundException('Student profile not found in this institute');

    // Validate guardian exists in this tenant
    const guardian = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ id: guardianProfilesLive.id })
        .from(guardianProfilesLive)
        .where(eq(guardianProfilesLive.id, input.guardianProfileId))
        .limit(1);
    });
    if (guardian.length === 0)
      throw new NotFoundException('Guardian profile not found in this institute');

    // If setting as primary contact, clear any existing primary for this student
    if (input.isPrimaryContact) {
      await withTenant(this.db, tenantId, async (tx) => {
        await tx
          .update(studentGuardianLinks)
          .set({ isPrimaryContact: false })
          .where(
            and(
              eq(studentGuardianLinks.studentProfileId, input.studentProfileId),
              eq(studentGuardianLinks.isPrimaryContact, true),
            ),
          );
      });
    }

    // Create the link (unique constraint prevents duplicates)
    const link = await withTenant(this.db, tenantId, async (tx) => {
      try {
        const rows = await tx
          .insert(studentGuardianLinks)
          .values({
            tenantId,
            studentProfileId: input.studentProfileId,
            guardianProfileId: input.guardianProfileId,
            relationship: input.relationship,
            isPrimaryContact: input.isPrimaryContact ?? false,
            isEmergencyContact: input.isEmergencyContact ?? false,
            canPickup: input.canPickup ?? true,
            livesWith: input.livesWith ?? true,
          })
          .returning();
        return rows[0];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('uq_student_guardian')) {
          throw new ConflictException('This guardian is already linked to this student');
        }
        throw error;
      }
    });

    this.emitEvent('GUARDIAN.linked', {
      guardianProfileId: input.guardianProfileId,
      studentProfileId: input.studentProfileId,
      relationship: input.relationship,
      tenantId,
    });

    return link;
  }

  async unlinkFromStudent(input: UnlinkGuardianInput) {
    const tenantId = this.tenantId;

    // Find the link
    const link = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select()
        .from(studentGuardianLinks)
        .where(
          and(
            eq(studentGuardianLinks.studentProfileId, input.studentProfileId),
            eq(studentGuardianLinks.guardianProfileId, input.guardianProfileId),
          ),
        )
        .limit(1);
    });
    if (link.length === 0) throw new NotFoundException('Guardian-student link not found');

    // If removing primary contact, require replacement
    if (link[0].isPrimaryContact && !input.newPrimaryGuardianId) {
      throw new BadRequestException(
        'Cannot unlink primary contact without providing newPrimaryGuardianId',
      );
    }

    // Check: not the last guardian for this student
    const allLinks = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ id: studentGuardianLinks.id })
        .from(studentGuardianLinks)
        .where(eq(studentGuardianLinks.studentProfileId, input.studentProfileId));
    });

    if (allLinks.length <= 1) {
      throw new BadRequestException('Cannot unlink the last guardian from a student');
    }

    // Delete the link
    await withTenant(this.db, tenantId, async (tx) => {
      await tx.delete(studentGuardianLinks).where(eq(studentGuardianLinks.id, link[0].id));
    });

    // If new primary provided, set it
    if (input.newPrimaryGuardianId) {
      const newPrimaryId = input.newPrimaryGuardianId;
      await withTenant(this.db, tenantId, async (tx) => {
        await tx
          .update(studentGuardianLinks)
          .set({ isPrimaryContact: true })
          .where(
            and(
              eq(studentGuardianLinks.studentProfileId, input.studentProfileId),
              eq(studentGuardianLinks.guardianProfileId, newPrimaryId),
            ),
          );
      });
    }

    return true;
  }

  /**
   * Divorce/separation: revoke guardian access without deleting the link.
   * Sets can_pickup=false, is_primary_contact=false. Link preserved for TC history.
   * Only institute_admin can call this (CASL enforced at resolver level).
   */
  async revokeAccess(input: RevokeGuardianAccessInput) {
    const tenantId = this.tenantId;

    const updated = await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(studentGuardianLinks)
        .set({
          canPickup: false,
          isPrimaryContact: false,
        })
        .where(
          and(
            eq(studentGuardianLinks.studentProfileId, input.studentProfileId),
            eq(studentGuardianLinks.guardianProfileId, input.guardianProfileId),
          ),
        )
        .returning();

      if (rows.length === 0) throw new NotFoundException('Guardian-student link not found');
      return rows[0];
    });

    this.logger.log(
      `Guardian access revoked: guardian=${input.guardianProfileId}, student=${input.studentProfileId}, reason=${input.reason ?? 'not specified'}`,
    );

    return updated;
  }

  /** Get all students linked to a guardian (sibling discovery for parent dashboard) */
  async getLinkedStudents(guardianProfileId: string) {
    const tenantId = this.tenantId;
    return withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({
          linkId: studentGuardianLinks.id,
          studentProfileId: studentGuardianLinks.studentProfileId,
          relationship: studentGuardianLinks.relationship,
          isPrimaryContact: studentGuardianLinks.isPrimaryContact,
          canPickup: studentGuardianLinks.canPickup,
        })
        .from(studentGuardianLinks)
        .where(eq(studentGuardianLinks.guardianProfileId, guardianProfileId));
    });
  }
}
