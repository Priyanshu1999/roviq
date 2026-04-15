/**
 * Guardian domain E2E tests — migrated from e2e/api-gateway-e2e/hurl/guardian/*.hurl
 *
 * (Files 01-02 were deleted in earlier cleanup; the set starts at 03.)
 *
 * Covers:
 *   03-create-guardian    — createGuardian persists fields, returns a profile
 *   04-link-guardian      — linkGuardianToStudent creates a relationship
 *   05-unlink-primary     — unlink primary without replacement → error
 *   07-revoke-access      — revokeGuardianAccess preserves the link (TC
 *                           history) but sets canPickup=false
 *   06-sibling-discovery  — myChildren as a guardian returns all linked
 *                           students (uses loginAsGuardian)
 *   08-my-profile         — myProfile returns the correct union branch based
 *                           on membership role
 *
 * Guardian names use i18nText — firstName is an `{ en: '...' }` object, not
 * a flat string (stale Hurl fields carried raw strings from pre-i18n era).
 */
import assert from 'node:assert';
import { Gender, GuardianRelationship } from '@roviq/common-types';
import { beforeAll, describe, expect, it } from 'vitest';

import { SEED } from '../../shared/seed';
import { loginAsGuardian, loginAsInstituteAdmin } from './helpers/auth';
import { gql } from './helpers/gql-client';

interface GuardianProfile {
  id: string;
  occupation: string | null;
}

interface GuardianLink {
  id: string;
  relationship: GuardianRelationship;
  isPrimaryContact: boolean;
  canPickup: boolean;
}

describe('Guardian E2E', () => {
  let adminToken: string;
  const studentProfileId = SEED.STUDENT_PROFILE_1.id;

  // Captured by 03 and reused by 04, 05, 07
  let newGuardianId: string;

  beforeAll(async () => {
    adminToken = (await loginAsInstituteAdmin()).accessToken;
  });

  // ─────────────────────────────────────────────────────
  // 03-create-guardian
  // ─────────────────────────────────────────────────────
  describe('createGuardian', () => {
    it('creates a guardian profile with the given fields persisted', async () => {
      const res = await gql<{ createGuardian: GuardianProfile }>(
        `mutation CreateGuardian($input: CreateGuardianInput!) {
          createGuardian(input: $input) { id occupation }
        }`,
        {
          input: {
            firstName: { en: 'Suresh' },
            lastName: { en: 'Kumar' },
            gender: Gender.MALE,
            phone: '9876502001',
            occupation: 'Government Officer',
          },
        },
        adminToken,
      );
      expect(res.errors).toBeUndefined();
      const guardian = res.data?.createGuardian;
      assert(guardian);
      expect(guardian.id).toBeTruthy();
      expect(guardian.occupation).toBe('Government Officer');
      newGuardianId = guardian.id;
    });
  });

  // ─────────────────────────────────────────────────────
  // 04-link-guardian
  // ─────────────────────────────────────────────────────
  describe('linkGuardianToStudent', () => {
    it('creates a student-guardian link with the expected fields', async () => {
      const res = await gql<{ linkGuardianToStudent: GuardianLink }>(
        `mutation LinkGuardian($input: LinkGuardianInput!) {
          linkGuardianToStudent(input: $input) {
            id relationship isPrimaryContact canPickup
          }
        }`,
        {
          input: {
            guardianProfileId: newGuardianId,
            studentProfileId,
            relationship: GuardianRelationship.FATHER,
            // Student_1 already has the seeded guardian1 as primary contact;
            // this new link must not claim primary. Otherwise we violate the
            // partial-unique index on (student_profile_id, is_primary=true).
            isPrimaryContact: false,
            canPickup: true,
          },
        },
        adminToken,
      );
      expect(res.errors).toBeUndefined();
      const link = res.data?.linkGuardianToStudent;
      assert(link);
      expect(link.id).toBeTruthy();
      expect(link.relationship).toBe(GuardianRelationship.FATHER);
      expect(link.isPrimaryContact).toBe(false);
      expect(link.canPickup).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────
  // 05-unlink-primary — negative path
  // ─────────────────────────────────────────────────────
  describe('unlinkGuardianFromStudent', () => {
    it('rejects unlinking the PRIMARY guardian without a replacement', async () => {
      // The seeded guardian1 is the primary contact for Student_1. Trying to
      // unlink without `newPrimaryGuardianId` must error out to preserve the
      // invariant that every student has exactly one primary contact.
      const res = await gql(
        `mutation UnlinkGuardian($input: UnlinkGuardianInput!) {
          unlinkGuardianFromStudent(input: $input)
        }`,
        {
          input: {
            guardianProfileId: SEED.GUARDIAN_PROFILE_1.id,
            studentProfileId,
          },
        },
        adminToken,
      );
      expect(res.errors).toBeDefined();
      assert(res.errors);
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.errors[0].message.toLowerCase()).toContain('primary');
    });
  });

  // ─────────────────────────────────────────────────────
  // 07-revoke-access — divorce scenario, preserve TC history
  // ─────────────────────────────────────────────────────
  describe('revokeGuardianAccess', () => {
    it('sets canPickup=false and isPrimaryContact=false but keeps the link row', async () => {
      // Use the guardian created in 03 (non-primary — we can revoke without
      // tripping the primary-invariant check).
      const res = await gql<{
        revokeGuardianAccess: { id: string; canPickup: boolean; isPrimaryContact: boolean };
      }>(
        `mutation RevokeAccess($input: RevokeGuardianAccessInput!) {
          revokeGuardianAccess(input: $input) {
            id canPickup isPrimaryContact
          }
        }`,
        {
          input: {
            guardianProfileId: newGuardianId,
            studentProfileId,
            reason: 'Court order - custody change',
          },
        },
        adminToken,
      );
      expect(res.errors).toBeUndefined();
      const link = res.data?.revokeGuardianAccess;
      assert(link);
      expect(link.id).toBeTruthy();
      expect(link.canPickup).toBe(false);
      expect(link.isPrimaryContact).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────
  // 06-sibling-discovery — guardian-side query
  // ─────────────────────────────────────────────────────
  describe('myChildren (as guardian)', () => {
    it('returns the students linked to the logged-in guardian', async () => {
      const guardian = await loginAsGuardian();
      type Response = {
        myChildren:
          | {
              __typename: 'MyGuardianProfile';
              type: string;
              children: Array<{
                studentProfileId: string;
                relationship: GuardianRelationship;
                isPrimaryContact: boolean;
              }>;
            }
          | { __typename: string };
      };
      const res = await gql<Response>(
        `query {
          myChildren {
            __typename
            ... on MyGuardianProfile {
              type
              children { studentProfileId relationship isPrimaryContact }
            }
          }
        }`,
        undefined,
        guardian.accessToken,
      );
      expect(res.errors).toBeUndefined();
      const profile = res.data?.myChildren;
      assert(profile);
      expect(profile.__typename).toBe('MyGuardianProfile');
      // The seeded guardian1 is linked to student1 as the primary contact.
      if (profile.__typename === 'MyGuardianProfile') {
        expect(profile.children.length).toBeGreaterThanOrEqual(1);
        const link = profile.children.find((c) => c.studentProfileId === studentProfileId);
        expect(link, 'seeded guardian must be linked to SEED.STUDENT_PROFILE_1').toBeDefined();
        assert(link);
        expect(link.isPrimaryContact).toBe(true);
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // 08-my-profile — union-type query
  // ─────────────────────────────────────────────────────
  describe('myProfile', () => {
    it('returns the guardian-specific branch when the caller is a guardian', async () => {
      const guardian = await loginAsGuardian();
      type Response = {
        myProfile: { __typename: string };
      };
      const res = await gql<Response>(
        `query {
          myProfile {
            __typename
            ... on MyGuardianProfile { type userProfile { firstName } children { studentProfileId } }
            ... on MyStaffProfile { type userProfile { firstName lastName } staffProfile }
            ... on MyStudentProfile { type userProfile { firstName } studentProfile }
          }
        }`,
        undefined,
        guardian.accessToken,
      );
      expect(res.errors).toBeUndefined();
      expect(res.data?.myProfile.__typename).toBe('MyGuardianProfile');
    });
  });
});
