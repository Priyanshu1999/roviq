/**
 * Consent domain E2E tests — migrated from e2e/api-gateway-e2e/hurl/consent/*.hurl
 *
 * Hurl versions were intentional stubs — they documented that Hurl cannot
 * authenticate as a guardian (createGuardian creates a user with a
 * placeholder password). This Vitest version uses `loginAsGuardian()` (Phase
 * B1) to exercise the full DPDP Act 2023 flow:
 *
 *   03-grant-consent      — guardian grants consent for a purpose; returns
 *                           ConsentRecordModel with isGranted=true, grantedAt set
 *   04-withdraw-consent   — guardian withdraws consent; APPENDS a new row
 *                           (append-only) with isGranted=false, withdrawnAt set
 *   05-consent-status     — myConsentStatus returns the current state
 *                           (latest row per purpose)
 *   06-append-only schema — ConsentRecordModel has no updatedAt (immutable)
 *
 * Plus negative-path coverage the Hurl stubs partially attempted:
 *   - Admin token on grantConsent → FORBIDDEN (no guardian profile on membership)
 */
import assert from 'node:assert';
import { beforeAll, describe, expect, it } from 'vitest';

import { SEED } from '../../shared/seed';
import { loginAsGuardian, loginAsInstituteAdmin } from './helpers/auth';
import { gql } from './helpers/gql-client';

interface ConsentRecord {
  id: string;
  purpose: string;
  isGranted: boolean;
  grantedAt: string | null;
  withdrawnAt: string | null;
  verificationMethod: string | null;
  createdAt: string;
}

interface ConsentStatus {
  studentProfileId: string;
  purpose: string;
  isGranted: boolean;
  lastUpdatedAt: string;
}

describe('Consent E2E', () => {
  let guardianToken: string;
  let adminToken: string;
  const studentProfileId = SEED.STUDENT_PROFILE_1.id;
  // Purpose is constrained by CHECK (chk_consent_purpose) to a fixed
  // enumeration — timestamped variants are rejected by the DB. Use a
  // canonical value; append-only semantics handle repeated test runs
  // by stacking rows (myConsentStatus returns the latest).
  const purpose = 'whatsapp_communication';

  beforeAll(async () => {
    guardianToken = (await loginAsGuardian()).accessToken;
    adminToken = (await loginAsInstituteAdmin()).accessToken;
  });

  // ─────────────────────────────────────────────────────
  // 03-grant-consent — guardian grants consent
  // ─────────────────────────────────────────────────────
  describe('grantConsent', () => {
    it('guardian can grant consent for a student they are linked to', async () => {
      const res = await gql<{ grantConsent: ConsentRecord }>(
        `mutation GrantConsent($input: GrantConsentInput!) {
          grantConsent(input: $input) {
            id purpose isGranted grantedAt withdrawnAt verificationMethod createdAt
          }
        }`,
        {
          input: {
            studentProfileId,
            purpose,
            verificationMethod: 'in_person_id_check',
          },
        },
        guardianToken,
      );

      expect(res.errors).toBeUndefined();
      const record = res.data?.grantConsent;
      assert(record);
      expect(record.id).toBeTruthy();
      expect(record.purpose).toBe(purpose);
      expect(record.isGranted).toBe(true);
      expect(record.grantedAt).toBeTruthy();
      expect(record.withdrawnAt).toBeNull();
      expect(record.verificationMethod).toBe('in_person_id_check');
    });

    it('rejects admin token — membership has no guardian profile', async () => {
      const res = await gql(
        `mutation GrantConsent($input: GrantConsentInput!) {
          grantConsent(input: $input) { id }
        }`,
        {
          input: {
            studentProfileId,
            purpose: `admin_reject_${Date.now()}`,
            verificationMethod: 'in_person_id_check',
          },
        },
        adminToken,
      );

      expect(res.errors).toBeDefined();
      expect(res.errors?.length).toBeGreaterThan(0);
      // Service throws ForbiddenException with a message containing "guardian".
      expect(res.errors?.[0].message.toLowerCase()).toContain('guardian');
    });
  });

  // ─────────────────────────────────────────────────────
  // 04-withdraw-consent — APPEND-ONLY: new row, not UPDATE
  // ─────────────────────────────────────────────────────
  describe('withdrawConsent', () => {
    it('guardian withdrawal produces a second record with withdrawnAt set', async () => {
      const res = await gql<{ withdrawConsent: ConsentRecord }>(
        `mutation WithdrawConsent($input: WithdrawConsentInput!) {
          withdrawConsent(input: $input) {
            id purpose isGranted grantedAt withdrawnAt createdAt
          }
        }`,
        {
          input: {
            studentProfileId,
            purpose,
          },
        },
        guardianToken,
      );

      expect(res.errors).toBeUndefined();
      const record = res.data?.withdrawConsent;
      assert(record);
      expect(record.purpose).toBe(purpose);
      expect(record.isGranted).toBe(false);
      expect(record.withdrawnAt).toBeTruthy();
      // Guard the append-only invariant: grantedAt must be null on the
      // withdrawal row (the earlier grant row has it set separately).
      expect(record.grantedAt).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────
  // 05-consent-status — latest row per purpose
  // ─────────────────────────────────────────────────────
  describe('myConsentStatus', () => {
    it('returns the latest (withdrawn) state after grant + withdrawal', async () => {
      const res = await gql<{ myConsentStatus: ConsentStatus[] }>(
        `query { myConsentStatus { studentProfileId purpose isGranted lastUpdatedAt } }`,
        undefined,
        guardianToken,
      );

      expect(res.errors).toBeUndefined();
      const statuses = res.data?.myConsentStatus ?? [];
      // Find our just-created purpose — should reflect the LATEST row (withdrawn).
      const ours = statuses.find((s) => s.purpose === purpose);
      expect(ours, `consent status for ${purpose} not found`).toBeDefined();
      assert(ours);
      expect(ours.studentProfileId).toBe(studentProfileId);
      expect(ours.isGranted).toBe(false);
      expect(ours.lastUpdatedAt).toBeTruthy();
    });

    it('rejects admin token — no guardian profile on membership', async () => {
      const res = await gql(
        `query { myConsentStatus { purpose isGranted } }`,
        undefined,
        adminToken,
      );
      expect(res.errors).toBeDefined();
      expect(res.errors?.[0].message.toLowerCase()).toContain('guardian');
    });
  });

  // ─────────────────────────────────────────────────────
  // 06-append-only schema — introspect to confirm no updatedAt field
  // ─────────────────────────────────────────────────────
  describe('ConsentRecordModel schema', () => {
    it('exposes append-only fields and does NOT expose updatedAt', async () => {
      type IntrospectResponse = {
        __type: { name: string; fields: Array<{ name: string }> } | null;
      };
      const res = await gql<IntrospectResponse>(
        `{ __type(name: "ConsentRecordModel") { name fields { name } } }`,
        undefined,
        guardianToken,
      );
      expect(res.errors).toBeUndefined();
      const type = res.data?.__type;
      assert(type);
      expect(type.name).toBe('ConsentRecordModel');

      const fieldNames = type.fields.map((f) => f.name);
      expect(fieldNames).toEqual(
        expect.arrayContaining([
          'id',
          'purpose',
          'isGranted',
          'grantedAt',
          'withdrawnAt',
          'createdAt',
        ]),
      );
      // Immutability contract: consent_records is append-only at both RLS
      // and service-layer levels. Surfacing an updatedAt field would
      // imply mutability, which would violate the DPDP audit trail.
      expect(fieldNames).not.toContain('updatedAt');
    });
  });
});
