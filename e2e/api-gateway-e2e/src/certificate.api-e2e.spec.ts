/**
 * Certificate domain E2E tests — migrated from e2e/api-gateway-e2e/hurl/certificate/*.hurl
 *
 * Covers the Hurl scenarios that are reachable against the running stack
 * WITHOUT a TCIssuanceWorkflow worker (ROV-232):
 *
 *   01-request-tc             — requestTC returns a TC row in REQUESTED status
 *                               (workflow is enqueued but never consumed; the
 *                               mutation response is self-contained)
 *   07-tc-blocks-non-admin    — teacher token on requestTC → FORBIDDEN
 *
 * Plus negative/shape coverage the Hurl files could not express:
 *   - Reject flow: rejectTC transitions REQUESTED → CANCELLED with reason
 *   - listTCs returns the tenant's TCs and supports `status` filter
 *
 * Skipped (documented below, pointing to ROV-232 where relevant):
 *   02-tc-clearance           — polls for CLEARANCE_COMPLETE; the workflow
 *                               activities that populate tc_register.clearances
 *                               require the TCIssuanceWorkflow worker
 *   03-tc-approve             — approveTC only accepts GENERATED (worker-set)
 *   04-tc-issue               — issueTC only accepts APPROVED (worker-set)
 *   05-duplicate-tc           — requestDuplicateTC requires an ISSUED original
 *                               TC, which can never be reached without the worker
 *   06-bonafide-certificate   — requires a certificate_templates row, but no
 *                               templates are seeded and there is no public
 *                               mutation to create one
 *
 * When ROV-232 lands and the TCIssuanceWorkflow worker is registered, the
 * TC state-machine describe blocks should be unskipped and rewritten to poll
 * for status transitions instead of asserting the intermediate statuses
 * directly.
 */
import assert from 'node:assert';
import { TcStatus } from '@roviq/common-types';
import { beforeAll, describe, expect, it } from 'vitest';

import { SEED } from '../../shared/seed-fixtures';
import { loginAsInstituteAdmin, loginAsTeacher } from './helpers/auth';
import { gql } from './helpers/gql-client';

interface TCNode {
  id: string;
  status: TcStatus;
  reason: string;
  tcSerialNumber: string;
  studentProfileId: string;
  isDuplicate: boolean;
  originalTcId: string | null;
  pdfUrl: string | null;
}

const REQUEST_TC = /* GraphQL */ `
  mutation RequestTC($input: RequestTCInput!) {
    requestTC(input: $input) {
      id
      status
      reason
      tcSerialNumber
      studentProfileId
      isDuplicate
      originalTcId
      pdfUrl
    }
  }
`;

const REJECT_TC = /* GraphQL */ `
  mutation RejectTC($id: ID!, $reason: String!) {
    rejectTC(id: $id, reason: $reason) {
      id
      status
    }
  }
`;

const LIST_TCS = /* GraphQL */ `
  query ListTCs($filter: ListTCFilterInput) {
    listTCs(filter: $filter) {
      id
      status
      studentProfileId
    }
  }
`;

describe('Certificate E2E', () => {
  let adminToken: string;
  let teacherToken: string;
  const studentProfileId = SEED.STUDENT_PROFILE_1.id;
  const academicYearId = SEED.ACADEMIC_YEAR_INST1.id;

  beforeAll(async () => {
    adminToken = (await loginAsInstituteAdmin()).accessToken;
    teacherToken = (await loginAsTeacher()).accessToken;
  });

  // ─────────────────────────────────────────────────────
  // 01-request-tc
  // ─────────────────────────────────────────────────────
  describe('requestTC', () => {
    it('creates a tc_register row in REQUESTED status for an enrolled student', async () => {
      const res = await gql<{ requestTC: TCNode }>(
        REQUEST_TC,
        {
          input: {
            studentProfileId,
            academicYearId,
            reason: 'Transfer to another city',
          },
        },
        adminToken,
      );
      expect(res.errors).toBeUndefined();
      const tc = res.data?.requestTC;
      assert(tc);
      expect(tc.id).toBeTruthy();
      expect(tc.status).toBe(TcStatus.REQUESTED);
      expect(tc.reason).toBe('Transfer to another city');
      // Serial is a "TC-REQ-<ts>" placeholder until the issuance step allocates
      // the tenant-sequence number; must be non-empty.
      expect(tc.tcSerialNumber).toBeTruthy();
      expect(tc.studentProfileId).toBe(studentProfileId);
      expect(tc.isDuplicate).toBe(false);
      expect(tc.originalTcId).toBeNull();
      expect(tc.pdfUrl).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────
  // Reject path — not a Hurl file, but exercises the only
  // state transition reachable without the worker.
  // ─────────────────────────────────────────────────────
  describe('rejectTC', () => {
    it('transitions a REQUESTED TC to CANCELLED (schema has no REJECTED terminal)', async () => {
      const created = await gql<{ requestTC: TCNode }>(
        REQUEST_TC,
        {
          input: {
            studentProfileId,
            academicYearId,
            reason: 'About to be rejected',
          },
        },
        adminToken,
      );
      expect(created.errors).toBeUndefined();
      const tcId = created.data?.requestTC.id;
      assert(tcId);

      const rejected = await gql<{ rejectTC: { id: string; status: TcStatus } }>(
        REJECT_TC,
        { id: tcId, reason: 'Insufficient documentation' },
        adminToken,
      );
      expect(rejected.errors).toBeUndefined();
      expect(rejected.data?.rejectTC.id).toBe(tcId);
      expect(rejected.data?.rejectTC.status).toBe(TcStatus.CANCELLED);
    });
  });

  // ─────────────────────────────────────────────────────
  // listTCs — verify tenant scoping + status filter
  // ─────────────────────────────────────────────────────
  describe('listTCs', () => {
    it('returns the tenant TCs and supports status filter', async () => {
      const all = await gql<{ listTCs: Array<{ id: string; status: TcStatus }> }>(
        LIST_TCS,
        {},
        adminToken,
      );
      expect(all.errors).toBeUndefined();
      assert(all.data);
      expect(Array.isArray(all.data.listTCs)).toBe(true);
      // Must contain at least the TCs we created above.
      expect(all.data.listTCs.length).toBeGreaterThan(0);

      const cancelled = await gql<{ listTCs: Array<{ id: string; status: TcStatus }> }>(
        LIST_TCS,
        { filter: { status: TcStatus.CANCELLED } },
        adminToken,
      );
      expect(cancelled.errors).toBeUndefined();
      assert(cancelled.data);
      for (const row of cancelled.data.listTCs) {
        expect(row.status).toBe(TcStatus.CANCELLED);
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // 07-tc-blocks-non-admin
  // ─────────────────────────────────────────────────────
  describe('CASL enforcement', () => {
    it('rejects requestTC from a teacher token with FORBIDDEN', async () => {
      const res = await gql<{ requestTC: TCNode }>(
        REQUEST_TC,
        {
          input: {
            studentProfileId,
            academicYearId,
            reason: 'Unauthorized attempt',
          },
        },
        teacherToken,
      );
      expect(res.errors).toBeDefined();
      expect(res.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });
  });

  // ─────────────────────────────────────────────────────
  // 02-tc-clearance — requires workflow activities to
  // populate tc_register.clearances and advance status.
  // Blocked on ROV-232 (no TCIssuanceWorkflow worker).
  // ─────────────────────────────────────────────────────
  describe.skip('TC clearance (ROV-232 — TCIssuanceWorkflow worker not registered)', () => {
    it('workflow populates clearances JSONB and advances to CLEARANCE_COMPLETE', () => {
      // Intentionally blank — unskip when ROV-232 ships a registered worker,
      // then port file 02's poll loop using a waitFor helper.
    });
  });

  // ─────────────────────────────────────────────────────
  // 03-tc-approve — approveTC only accepts TcStatus.GENERATED
  // which is set by the workflow. Blocked on ROV-232.
  // ─────────────────────────────────────────────────────
  describe.skip('TC approve (ROV-232 — requires GENERATED status from worker)', () => {
    it('principal approval transitions GENERATED → APPROVED', () => {
      // Unskip alongside the clearance flow.
    });
  });

  // ─────────────────────────────────────────────────────
  // 04-tc-issue — issueTC only accepts TcStatus.APPROVED.
  // Blocked on ROV-232.
  // ─────────────────────────────────────────────────────
  describe.skip('TC issue (ROV-232 — requires APPROVED status from worker)', () => {
    it('issues TC serial + PDF + marks student TRANSFERRED_OUT', () => {
      // Unskip alongside the clearance + approve flow.
    });
  });

  // ─────────────────────────────────────────────────────
  // 05-duplicate-tc — requestDuplicateTC requires an
  // original TC in ISSUED status. Blocked on ROV-232.
  // ─────────────────────────────────────────────────────
  describe.skip('Duplicate TC (ROV-232 — requires an ISSUED original TC)', () => {
    it('creates a duplicate TC with isDuplicate=true and originalTcId set', () => {
      // Unskip once issueTC is reachable end-to-end.
    });
  });

  // ─────────────────────────────────────────────────────
  // 06-bonafide-certificate — requires a certificate_templates
  // row. No templates are seeded today and there is no public
  // mutation to create one at test time, so the flow is
  // unreachable from an external client.
  // ─────────────────────────────────────────────────────
  describe.skip('Bonafide certificate (blocked: no seeded certificate_templates + no create mutation)', () => {
    it('requests + issues a bonafide certificate from a template', () => {
      // Unskip once either (a) templates are seeded with stable IDs in
      // scripts/seed.ts + e2e/shared/seed.ts, or (b) a createCertificateTemplate
      // mutation is added to the institute scope.
    });
  });
});
