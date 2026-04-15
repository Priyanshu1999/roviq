/**
 * Phase E — subscription coverage across all three scopes.
 *
 * Companion to [subscriptions.api-e2e.spec.ts](./subscriptions.api-e2e.spec.ts)
 * which covers institute-scope config/branding + cross-tenant isolation.
 * This file adds the post-Phase-B subscriptions that now have working
 * emitters + `resolve` functions:
 *
 *   Institute scope
 *     - instituteUpdated           (INSTITUTE.updated — B3 + resolver fix)
 *     - studentUpdated             (STUDENT.updated — B4)
 *     - studentsInTenantUpdated    (STUDENT.updated, tenant-wide list refresh)
 *
 *   Reseller scope
 *     - resellerInstituteCreated          (INSTITUTE.created, resellerId filter)
 *     - resellerInstituteStatusChanged    (INSTITUTE.status_changed, resellerId filter)
 *
 *   Platform scope
 *     - adminInstituteApprovalRequested   (INSTITUTE.approval_requested, unfiltered)
 *     - adminInstituteCreated             (INSTITUTE.created, unfiltered)
 *
 * Ws-ticket exchange is exercised transitively — `subscribeOnce()` always
 * fetches one via `/api/auth/ws-ticket` before opening the socket, so a
 * passing test across all three scopes is also a ws-ticket ack test.
 *
 * Scope exclusions (tracked elsewhere, not covered here):
 *   - instituteSetupProgress — blocked on ROV-232 Temporal workers
 *   - Scope-filter isolation (reseller A vs B, institute A vs B) — ROV-229
 *   - Factory isolation (drop SEED-mutation pattern) — ROV-230
 */
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { SocialCategory } from '@roviq/common-types';
import type { Mutation } from '@roviq/graphql/generated';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED } from '../../shared/seed';
import { loginAsInstituteAdmin, loginAsPlatformAdmin, loginAsReseller } from './helpers/auth';
import { gql } from './helpers/gql-client';
import { subscribeOnce } from './helpers/ws-client';

type Envelope<K extends string, V> = { [key in K]: V };

/**
 * Give the ws client time to complete `connection_init` and register the
 * subscription with the server before the mutation fires. Without this,
 * fast mutations race the server's iterator registration and the event is
 * missed. Matches the 200ms pattern in subscriptions.api-e2e.spec.ts.
 */
const WS_REGISTRATION_DELAY_MS = 200;

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

describe('Subscriptions — Phase E (all 3 scopes)', () => {
  // ─────────────────────────────────────────────────────────────
  // Institute scope
  // ─────────────────────────────────────────────────────────────
  describe('Institute-scope', () => {
    let instituteToken: string;
    let instituteId: string;
    let instituteVersion: number;
    let originalCode: string | null;

    let studentId: string;
    let studentVersion: number;
    let originalSocialCategory: SocialCategory | null;

    beforeAll(async () => {
      instituteToken = (await loginAsInstituteAdmin()).accessToken;

      const instRes = await gql<{
        myInstitute: { id: string; code: string | null; version: number };
      }>(`query { myInstitute { id code version } }`, undefined, instituteToken);
      assert(instRes.data?.myInstitute);
      instituteId = instRes.data.myInstitute.id;
      instituteVersion = instRes.data.myInstitute.version;
      originalCode = instRes.data.myInstitute.code;

      const studentRes = await gql<{
        getStudent: { id: string; version: number; socialCategory: SocialCategory | null };
      }>(
        `query ($id: ID!) { getStudent(id: $id) { id version socialCategory } }`,
        { id: SEED.STUDENT_PROFILE_1.id },
        instituteToken,
      );
      const node = studentRes.data?.getStudent;
      assert(node, `Seed student ${SEED.STUDENT_PROFILE_1.id} not found`);
      studentId = node.id;
      studentVersion = node.version;
      originalSocialCategory = node.socialCategory;
    });

    afterAll(async () => {
      // Restore the institute's code so re-runs are stable. Re-read the
      // version because the test itself mutated it.
      const cur = await gql<{ myInstitute: { version: number } }>(
        `query { myInstitute { version } }`,
        undefined,
        instituteToken,
      );
      if (cur.data?.myInstitute) {
        await gql(
          `mutation ($id: ID!, $input: UpdateInstituteInfoInput!) {
            updateInstituteInfo(id: $id, input: $input) { id }
          }`,
          {
            id: instituteId,
            input: { version: cur.data.myInstitute.version, code: originalCode ?? undefined },
          },
          instituteToken,
        );
      }

      // Restore student socialCategory.
      const curStudent = await gql<{ getStudent: { version: number } }>(
        `query ($id: ID!) { getStudent(id: $id) { version } }`,
        { id: studentId },
        instituteToken,
      );
      const latest = curStudent.data?.getStudent;
      if (latest) {
        await gql(
          `mutation ($id: ID!, $input: UpdateStudentInput!) {
            updateStudent(id: $id, input: $input) { id }
          }`,
          {
            id: studentId,
            input: { version: latest.version, socialCategory: originalSocialCategory },
          },
          instituteToken,
        );
      }
    });

    it('instituteUpdated fires after updateInstituteInfo', async () => {
      const newCode = `E2E-${randomUUID().slice(0, 6)}`;

      const eventPromise = subscribeOnce<
        Envelope<'instituteUpdated', { id: string; code: string | null }>
      >(`subscription { instituteUpdated { id code } }`, {}, instituteToken);
      await wait(WS_REGISTRATION_DELAY_MS);

      const res = await gql<Pick<Mutation, 'updateInstituteInfo'>>(
        `mutation ($id: ID!, $input: UpdateInstituteInfoInput!) {
          updateInstituteInfo(id: $id, input: $input) { id code version }
        }`,
        { id: instituteId, input: { version: instituteVersion, code: newCode } },
        instituteToken,
      );
      if (res.errors) {
        throw new Error(`updateInstituteInfo failed: ${JSON.stringify(res.errors)}`);
      }
      const returnedVersion = res.data?.updateInstituteInfo?.version;
      assert(typeof returnedVersion === 'number');
      instituteVersion = returnedVersion;

      const event = await eventPromise;
      expect(event.instituteUpdated.id).toBe(instituteId);
      expect(event.instituteUpdated.code).toBe(newCode);
    });

    it('studentUpdated fires after updateStudent', async () => {
      const target =
        originalSocialCategory === SocialCategory.OBC ? SocialCategory.ST : SocialCategory.OBC;

      const eventPromise = subscribeOnce<
        Envelope<'studentUpdated', { id: string; socialCategory: SocialCategory | null }>
      >(
        `subscription ($sid: ID!) { studentUpdated(studentId: $sid) { id socialCategory } }`,
        { sid: studentId },
        instituteToken,
      );
      await wait(WS_REGISTRATION_DELAY_MS);

      const res = await gql<Pick<Mutation, 'updateStudent'>>(
        `mutation ($id: ID!, $input: UpdateStudentInput!) {
          updateStudent(id: $id, input: $input) { id version socialCategory }
        }`,
        { id: studentId, input: { version: studentVersion, socialCategory: target } },
        instituteToken,
      );
      if (res.errors) throw new Error(`updateStudent failed: ${JSON.stringify(res.errors)}`);
      const v = res.data?.updateStudent?.version;
      assert(typeof v === 'number');
      studentVersion = v;

      const event = await eventPromise;
      expect(event.studentUpdated.id).toBe(studentId);
      expect(event.studentUpdated.socialCategory).toBe(target);
    });

    it('studentsInTenantUpdated fires on the same STUDENT.updated channel', async () => {
      const target =
        originalSocialCategory === SocialCategory.GEN ? SocialCategory.OBC : SocialCategory.GEN;

      const eventPromise = subscribeOnce<Envelope<'studentsInTenantUpdated', { id: string }>>(
        `subscription { studentsInTenantUpdated { id } }`,
        {},
        instituteToken,
      );
      await wait(WS_REGISTRATION_DELAY_MS);

      const res = await gql<Pick<Mutation, 'updateStudent'>>(
        `mutation ($id: ID!, $input: UpdateStudentInput!) {
          updateStudent(id: $id, input: $input) { id version }
        }`,
        { id: studentId, input: { version: studentVersion, socialCategory: target } },
        instituteToken,
      );
      if (res.errors) throw new Error(`updateStudent failed: ${JSON.stringify(res.errors)}`);
      const v = res.data?.updateStudent?.version;
      assert(typeof v === 'number');
      studentVersion = v;

      const event = await eventPromise;
      expect(event.studentsInTenantUpdated.id).toBe(studentId);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Reseller scope
  // ─────────────────────────────────────────────────────────────
  describe('Reseller-scope', () => {
    let resellerToken: string;
    let adminToken: string;

    beforeAll(async () => {
      resellerToken = (await loginAsReseller()).accessToken;
      adminToken = (await loginAsPlatformAdmin()).accessToken;
    });

    it('resellerInstituteCreated fires after adminCreateInstitute for this reseller', async () => {
      // `resellerInstituteCreated` listens on INSTITUTE.created and filters
      // by `resellerId`. Only `adminCreateInstitute` emits INSTITUTE.created —
      // `resellerCreateInstituteRequest` emits INSTITUTE.approval_requested.
      const slug = `e2e-sub-${randomUUID().slice(0, 8)}`;

      const eventPromise = subscribeOnce<
        Envelope<'resellerInstituteCreated', { id: string; slug: string }>
      >(`subscription { resellerInstituteCreated { id slug } }`, {}, resellerToken);
      await wait(WS_REGISTRATION_DELAY_MS);

      const res = await gql<Pick<Mutation, 'adminCreateInstitute'>>(
        `mutation ($input: AdminCreateInstituteInput!) {
          adminCreateInstitute(input: $input) { id slug }
        }`,
        {
          input: {
            name: { en: 'Phase E — Admin → Reseller' },
            slug,
            resellerId: SEED.RESELLER.id,
          },
        },
        adminToken,
      );
      if (res.errors) {
        throw new Error(`adminCreateInstitute failed: ${JSON.stringify(res.errors)}`);
      }
      const created = res.data?.adminCreateInstitute;
      assert(created);

      const event = await eventPromise;
      expect(event.resellerInstituteCreated.id).toBe(created.id);
      expect(event.resellerInstituteCreated.slug).toBe(slug);

      await gql(
        `mutation ($id: ID!) { adminDeleteInstitute(id: $id) }`,
        { id: created.id },
        adminToken,
      );
    });

    it('resellerInstituteStatusChanged fires after adminApproveInstitute', async () => {
      const slug = `e2e-sub-${randomUUID().slice(0, 8)}`;
      const createRes = await gql<Pick<Mutation, 'resellerCreateInstituteRequest'>>(
        `mutation ($input: ResellerCreateInstituteRequestInput!) {
          resellerCreateInstituteRequest(input: $input) { id }
        }`,
        { input: { name: { en: 'Phase E — Reseller Status Change' }, slug } },
        resellerToken,
      );
      if (createRes.errors) throw new Error(`seed failed: ${JSON.stringify(createRes.errors)}`);
      const instituteId = createRes.data?.resellerCreateInstituteRequest.id;
      assert(instituteId);

      const eventPromise = subscribeOnce<
        Envelope<'resellerInstituteStatusChanged', { id: string; status: string }>
      >(`subscription { resellerInstituteStatusChanged { id status } }`, {}, resellerToken);
      await wait(WS_REGISTRATION_DELAY_MS);

      const approveRes = await gql(
        `mutation ($id: ID!) { adminApproveInstitute(id: $id) { id status } }`,
        { id: instituteId },
        adminToken,
      );
      if (approveRes.errors) {
        throw new Error(`adminApproveInstitute failed: ${JSON.stringify(approveRes.errors)}`);
      }

      const event = await eventPromise;
      expect(event.resellerInstituteStatusChanged.id).toBe(instituteId);
      expect(event.resellerInstituteStatusChanged.status).toBe('PENDING');

      await gql(
        `mutation ($id: ID!) { adminDeleteInstitute(id: $id) }`,
        { id: instituteId },
        adminToken,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Platform scope
  // ─────────────────────────────────────────────────────────────
  describe('Platform-scope', () => {
    let adminToken: string;
    let resellerToken: string;

    beforeAll(async () => {
      adminToken = (await loginAsPlatformAdmin()).accessToken;
      resellerToken = (await loginAsReseller()).accessToken;
    });

    it('adminInstituteCreated fires after adminCreateInstitute', async () => {
      const slug = `e2e-sub-${randomUUID().slice(0, 8)}`;

      const eventPromise = subscribeOnce<
        Envelope<'adminInstituteCreated', { id: string; slug: string }>
      >(`subscription { adminInstituteCreated { id slug } }`, {}, adminToken);
      await wait(WS_REGISTRATION_DELAY_MS);

      const res = await gql<Pick<Mutation, 'adminCreateInstitute'>>(
        `mutation ($input: AdminCreateInstituteInput!) {
          adminCreateInstitute(input: $input) { id slug }
        }`,
        {
          input: {
            name: { en: 'Phase E — Admin Create' },
            slug,
            resellerId: SEED.RESELLER.id,
          },
        },
        adminToken,
      );
      if (res.errors) {
        throw new Error(`adminCreateInstitute failed: ${JSON.stringify(res.errors)}`);
      }
      const created = res.data?.adminCreateInstitute;
      assert(created);

      const event = await eventPromise;
      expect(event.adminInstituteCreated.id).toBe(created.id);
      expect(event.adminInstituteCreated.slug).toBe(slug);

      await gql(
        `mutation ($id: ID!) { adminDeleteInstitute(id: $id) }`,
        { id: created.id },
        adminToken,
      );
    });

    it('adminInstituteApprovalRequested fires after resellerCreateInstituteRequest', async () => {
      const slug = `e2e-sub-${randomUUID().slice(0, 8)}`;

      const eventPromise = subscribeOnce<
        Envelope<'adminInstituteApprovalRequested', { id: string; slug: string; status: string }>
      >(`subscription { adminInstituteApprovalRequested { id slug status } }`, {}, adminToken);
      await wait(WS_REGISTRATION_DELAY_MS);

      const res = await gql<Pick<Mutation, 'resellerCreateInstituteRequest'>>(
        `mutation ($input: ResellerCreateInstituteRequestInput!) {
          resellerCreateInstituteRequest(input: $input) { id }
        }`,
        { input: { name: { en: 'Phase E — Approval Requested' }, slug } },
        resellerToken,
      );
      if (res.errors) {
        throw new Error(`resellerCreateInstituteRequest failed: ${JSON.stringify(res.errors)}`);
      }
      const created = res.data?.resellerCreateInstituteRequest;
      assert(created);

      const event = await eventPromise;
      expect(event.adminInstituteApprovalRequested.id).toBe(created.id);
      expect(event.adminInstituteApprovalRequested.slug).toBe(slug);
      expect(event.adminInstituteApprovalRequested.status).toBe('PENDING_APPROVAL');

      await gql(
        `mutation ($id: ID!) { adminDeleteInstitute(id: $id) }`,
        { id: created.id },
        adminToken,
      );
    });
  });
});
