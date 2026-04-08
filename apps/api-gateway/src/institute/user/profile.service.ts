/**
 * Self-service profile service (ROV-157).
 *
 * Resolves the current user's profile based on membership type:
 * - Student membership → student_profile + user_profile + academics
 * - Staff membership → staff_profile + user_profile
 * - Guardian membership → guardian_profile + user_profile + linked children
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DefaultRoles, getRequestContext } from '@roviq/common-types';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  guardianProfiles,
  memberships,
  phoneNumbers,
  roles,
  staffProfiles,
  studentAcademics,
  studentGuardianLinks,
  studentProfiles,
  userProfiles,
  withAdmin,
  withTenant,
} from '@roviq/database';
import { and, eq } from 'drizzle-orm';
import type { UpdateMyProfileInput } from './dto/update-my-profile.input';

@Injectable()
export class ProfileService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  private get tenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context required');
    return tenantId;
  }

  /**
   * Detect membership type by looking up the role name, then return
   * the appropriate profile shape.
   */
  async getMyProfile(userId: string, membershipId: string) {
    const tenantId = this.tenantId;

    // Get the role associated with this membership
    const membership = await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .select({ roleId: memberships.roleId, userId: memberships.userId })
        .from(memberships)
        .where(eq(memberships.id, membershipId))
        .limit(1);
      return rows[0];
    });

    if (!membership) throw new NotFoundException('Membership not found');

    const role = await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .select({ name: roles.name })
        .from(roles)
        .where(eq(roles.id, membership.roleId))
        .limit(1);
      return rows[0];
    });

    const roleName = (role?.name as Record<string, string>)?.en ?? '';

    // Get common user_profile
    const profile = await withAdmin(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);
      return rows[0] ?? null;
    });

    if (!profile) throw new NotFoundException('User profile not found');

    const userProfileData = {
      id: profile.id,
      userId: profile.userId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      gender: profile.gender,
      dateOfBirth: profile.dateOfBirth,
      bloodGroup: profile.bloodGroup,
      nationality: profile.nationality,
      profileImageUrl: profile.profileImageUrl,
    };

    // ── Student profile ────────────────────────────────
    if (roleName === DefaultRoles.Student) {
      const studentProfile = await withTenant(this.db, tenantId, async (tx) => {
        return tx.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).limit(1);
      });

      let academics = null;
      if (studentProfile[0]) {
        const academicRows = await withTenant(this.db, tenantId, async (tx) => {
          return tx
            .select()
            .from(studentAcademics)
            .where(eq(studentAcademics.studentProfileId, studentProfile[0].id))
            .limit(1);
        });
        academics = academicRows[0] ?? null;
      }

      return {
        type: 'student',
        userProfile: userProfileData,
        studentProfile: studentProfile[0] ?? null,
        academics,
      };
    }

    // ── Staff profile ──────────────────────────────────
    if (roleName === DefaultRoles.Teacher) {
      const staffProfile = await withTenant(this.db, tenantId, async (tx) => {
        return tx.select().from(staffProfiles).where(eq(staffProfiles.userId, userId)).limit(1);
      });

      return {
        type: 'staff',
        userProfile: userProfileData,
        staffProfile: staffProfile[0] ?? null,
      };
    }

    // ── Guardian profile ───────────────────────────────
    if (roleName === DefaultRoles.Parent) {
      const guardianProfile = await withTenant(this.db, tenantId, async (tx) => {
        return tx
          .select()
          .from(guardianProfiles)
          .where(eq(guardianProfiles.userId, userId))
          .limit(1);
      });

      let children: Array<{
        studentProfileId: string;
        relationship: string;
        isPrimaryContact: boolean;
        firstName?: Record<string, string> | null;
        lastName?: Record<string, string> | null;
      }> = [];

      if (guardianProfile[0]) {
        // Single JOIN query instead of N+1 per child
        children = await withAdmin(this.db, async (tx) => {
          return tx
            .select({
              studentProfileId: studentGuardianLinks.studentProfileId,
              relationship: studentGuardianLinks.relationship,
              isPrimaryContact: studentGuardianLinks.isPrimaryContact,
              firstName: userProfiles.firstName,
              lastName: userProfiles.lastName,
            })
            .from(studentGuardianLinks)
            .innerJoin(
              studentProfiles,
              eq(studentGuardianLinks.studentProfileId, studentProfiles.id),
            )
            .innerJoin(userProfiles, eq(studentProfiles.userId, userProfiles.userId))
            .where(eq(studentGuardianLinks.guardianProfileId, guardianProfile[0].id));
        });
      }

      return {
        type: 'guardian',
        userProfile: userProfileData,
        guardianProfile: guardianProfile[0] ?? null,
        children,
      };
    }

    // Fallback
    return {
      type: 'unknown',
      userProfile: userProfileData,
    };
  }

  /**
   * Self-service update: phone, address, photo — NOT name, DOB, or identity docs.
   */
  async updateMyProfile(userId: string, input: UpdateMyProfileInput) {
    // Update user_profile fields
    const updatedProfile = await withAdmin(this.db, async (tx) => {
      const rows = await tx
        .update(userProfiles)
        .set({
          ...(input.profileImageUrl != null && { profileImageUrl: input.profileImageUrl }),
          ...(input.nationality != null && { nationality: input.nationality }),
          ...(input.religion != null && { religion: input.religion }),
          ...(input.motherTongue != null && { motherTongue: input.motherTongue }),
          updatedBy: userId,
        })
        .where(eq(userProfiles.userId, userId))
        .returning();

      if (rows.length === 0) throw new NotFoundException('User profile not found');
      return rows[0];
    });

    // Update phone if provided
    if (input.phone) {
      const phone = input.phone;
      await withAdmin(this.db, async (tx) => {
        const existing = await tx
          .select({ id: phoneNumbers.id })
          .from(phoneNumbers)
          .where(and(eq(phoneNumbers.userId, userId), eq(phoneNumbers.isPrimary, true)))
          .limit(1);

        if (existing.length > 0) {
          await tx
            .update(phoneNumbers)
            .set({ number: phone })
            .where(eq(phoneNumbers.id, existing[0].id));
        } else {
          await tx.insert(phoneNumbers).values({
            userId,
            countryCode: '+91',
            number: phone,
            isPrimary: true,
            label: 'personal',
          });
        }
      });
    }

    return updatedProfile;
  }
}
