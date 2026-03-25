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
import { DefaultRoles, getRequestContext } from '@roviq/common-types';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  guardianProfiles,
  memberships,
  phoneNumbers,
  roles,
  studentGuardianLinks,
  studentProfiles,
  userProfiles,
  users,
  withAdmin,
  withTenant,
} from '@roviq/database';
import { and, eq, sql } from 'drizzle-orm';
import type { CreateGuardianInput } from './dto/create-guardian.input';
import type {
  LinkGuardianInput,
  RevokeGuardianAccessInput,
  UnlinkGuardianInput,
} from './dto/link-guardian.input';

@Injectable()
export class GuardianService {
  private readonly logger = new Logger(GuardianService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

  private get tenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context required');
    return tenantId;
  }

  private get userId(): string {
    return getRequestContext().userId;
  }

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }

  async findById(id: string) {
    const tenantId = this.tenantId;
    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx.select().from(guardianProfiles).where(eq(guardianProfiles.id, id)).limit(1);
    });
    if (rows.length === 0) throw new NotFoundException(`Guardian profile ${id} not found`);
    return rows[0];
  }

  async list() {
    const tenantId = this.tenantId;
    return withTenant(this.db, tenantId, async (tx) => {
      return tx.select().from(guardianProfiles).limit(100);
    });
  }

  async create(input: CreateGuardianInput) {
    const tenantId = this.tenantId;
    const actorId = this.userId;

    // Create user (NATS stub)
    const email = input.email ?? `guardian-${Date.now()}@roviq.placeholder`;
    const username = `guardian-${tenantId.slice(0, 8)}-${Date.now()}`;

    const newUser = await withAdmin(this.db, async (tx) => {
      const rows = await tx
        .insert(users)
        .values({ email, username, passwordHash: '$placeholder-guardian' })
        .returning({ id: users.id });
      return rows[0];
    });

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
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(eq(roles.tenantId, tenantId), sql`${roles.name}->>'en' = ${DefaultRoles.Parent}`),
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

    return profile;
  }

  async update(
    id: string,
    data: { occupation?: string; organization?: string; educationLevel?: string; version: number },
  ) {
    const tenantId = this.tenantId;
    const actorId = this.userId;

    const updated = await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(guardianProfiles)
        .set({
          ...(data.occupation != null && { occupation: data.occupation }),
          ...(data.organization != null && { organization: data.organization }),
          ...(data.educationLevel != null && { educationLevel: data.educationLevel }),
          updatedBy: actorId,
          version: sql`${guardianProfiles.version} + 1`,
        })
        .where(and(eq(guardianProfiles.id, id), eq(guardianProfiles.version, data.version)))
        .returning();

      if (rows.length === 0) throw new ConflictException('Guardian profile version mismatch');
      return rows[0];
    });

    return updated;
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
        .select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, input.studentProfileId))
        .limit(1);
    });
    if (student.length === 0)
      throw new NotFoundException('Student profile not found in this institute');

    // Validate guardian exists in this tenant
    const guardian = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ id: guardianProfiles.id })
        .from(guardianProfiles)
        .where(eq(guardianProfiles.id, input.guardianProfileId))
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
