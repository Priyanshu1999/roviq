/**
 * Admission domain E2E tests — migrated from e2e/api-gateway-e2e/hurl/admission/*.hurl
 *
 * Covers (in order):
 *   01-create-enquiry         — create + basic fields + isDuplicate=false
 *   02-list-enquiries         — list + status filter + search
 *   03-convert-to-application — enquiry → application, status=submitted
 *   04-application-lifecycle  — SUBMITTED → DOCUMENTS_PENDING → … → FEE_PAID
 *                               (ENROLLED requires StudentAdmissionWorkflow
 *                               worker — ROV-232; approveApplication is
 *                               asserted up to workflow start only)
 *   05-admission-statistics   — funnel + ratios
 *   06-rte-application        — isRteApplication preserved through status change
 *   07-dedup-enquiry          — same (phone + class) → isDuplicate=true
 *
 * Plus subscription coverage Hurl could not express:
 *   - enquiryCreated fires after createEnquiry
 *   - applicationStatusUpdated fires after updateApplication
 *
 * Tests share login state via `beforeAll`. Later tests reuse ids captured by
 * earlier tests within the same describe block.
 */
import assert from 'node:assert';
import {
  AdmissionApplicationStatus,
  EnquirySource,
  EnquiryStatus,
  Gender,
} from '@roviq/common-types';
import type { ApplicationModel, EnquiryModel } from '@roviq/graphql/generated';
import { beforeAll, describe, expect, it } from 'vitest';

import { SEED } from '../../shared/seed';
import { loginAsInstituteAdmin } from './helpers/auth';
import { gql } from './helpers/gql-client';
import { subscribeOnce } from './helpers/ws-client';

// NOTE: Admission module is not yet feature-complete — several mutations
// (createApplication formData validator, approveApplication workflow wiring)
// still have pre-existing gaps. The spec is drafted as a migration target,
// but the whole suite is skipped until the module is finished. Do not delete
// e2e/api-gateway-e2e/hurl/admission/ until this spec is unskipped and passes.
describe.skip('Admission E2E (blocked: module incomplete — formData validator, admission worker per ROV-232)', () => {
  let accessToken: string;
  let academicYearId: string;
  let standardId: string;

  beforeAll(async () => {
    const admin = await loginAsInstituteAdmin();
    accessToken = admin.accessToken;
    academicYearId = SEED.ACADEMIC_YEAR_INST1.id;

    const standardsRes = await gql<{ standards: Array<{ id: string }> }>(
      `query Standards($academicYearId: ID!) { standards(academicYearId: $academicYearId) { id } }`,
      { academicYearId },
      accessToken,
    );
    expect(standardsRes.errors).toBeUndefined();
    const standards = standardsRes.data?.standards ?? [];
    expect(standards.length).toBeGreaterThanOrEqual(1);
    standardId = standards[0].id;
  });

  // ─────────────────────────────────────────────────────
  // 01-create-enquiry
  // ─────────────────────────────────────────────────────
  describe('createEnquiry', () => {
    it('creates an enquiry with all fields persisted and isDuplicate=false', async () => {
      // Deterministic but per-run phone — prevents collision with 07-dedup and
      // avoids state carryover between runs.
      const phone = `98765${String(Date.now()).slice(-5)}`;

      const res = await gql<{ createEnquiry: EnquiryModel }>(
        `mutation CreateEnquiry($input: CreateEnquiryInput!) {
          createEnquiry(input: $input) {
            id studentName parentName parentPhone classRequested source status
            isDuplicate gender dateOfBirth createdAt
          }
        }`,
        {
          input: {
            studentName: 'Priya Sharma',
            parentName: 'Rajesh Sharma',
            parentPhone: phone,
            classRequested: 'Nursery',
            source: EnquirySource.WALK_IN,
            gender: Gender.FEMALE,
            dateOfBirth: '2020-03-15',
          },
        },
        accessToken,
      );

      expect(res.errors).toBeUndefined();
      const e = res.data?.createEnquiry;
      assert(e);
      expect(e.id).toBeTruthy();
      expect(e.studentName).toBe('Priya Sharma');
      expect(e.parentPhone).toBe(phone);
      expect(e.status).toBe(EnquiryStatus.NEW);
      expect(e.source).toBe(EnquirySource.WALK_IN);
      expect(e.isDuplicate).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────
  // Subscription coverage (Vitest-only — Hurl cannot express WebSocket)
  // ─────────────────────────────────────────────────────
  describe('enquiryCreated subscription', () => {
    it('fires after createEnquiry for the same tenant', async () => {
      type Envelope = {
        enquiryCreated: { id: string; studentName: string; isDuplicate: boolean };
      };

      const eventPromise = subscribeOnce<Envelope>(
        `subscription { enquiryCreated { id studentName isDuplicate } }`,
        {},
        accessToken,
      );

      // Allow the ws-client to complete connection_init before publishing.
      await new Promise((r) => setTimeout(r, 200));

      const phone = `97654${String(Date.now()).slice(-5)}`;
      const res = await gql<{ createEnquiry: { id: string } }>(
        `mutation CreateEnquiry($input: CreateEnquiryInput!) {
          createEnquiry(input: $input) { id }
        }`,
        {
          input: {
            studentName: 'Subscription Trigger',
            parentName: 'Sub Parent',
            parentPhone: phone,
            classRequested: 'LKG',
          },
        },
        accessToken,
      );
      expect(res.errors).toBeUndefined();
      const createdId = res.data?.createEnquiry.id;
      assert(createdId);

      const event = await eventPromise;
      expect(event.enquiryCreated.id).toBe(createdId);
      expect(event.enquiryCreated.studentName).toBe('Subscription Trigger');
      expect(event.enquiryCreated.isDuplicate).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────
  // 02-list-enquiries
  // ─────────────────────────────────────────────────────
  describe('listEnquiries', () => {
    const LIST_QUERY = `
      query ListEnquiries($filter: EnquiryFilterInput) {
        listEnquiries(filter: $filter) {
          edges { node { id studentName status classRequested } }
          totalCount
          pageInfo { hasNextPage }
        }
      }
    `;

    it('returns a paginated connection with at least one enquiry', async () => {
      const res = await gql<{
        listEnquiries: {
          edges: Array<{ node: { id: string } }>;
          totalCount: number;
          pageInfo: { hasNextPage: boolean };
        };
      }>(LIST_QUERY, {}, accessToken);
      expect(res.errors).toBeUndefined();
      assert(res.data);
      expect(res.data.listEnquiries.totalCount).toBeGreaterThanOrEqual(1);
      expect(res.data.listEnquiries.edges.length).toBeGreaterThanOrEqual(1);
    });

    it('filters by status=NEW', async () => {
      const res = await gql<{ listEnquiries: { totalCount: number } }>(
        LIST_QUERY,
        { filter: { status: EnquiryStatus.NEW } },
        accessToken,
      );
      expect(res.errors).toBeUndefined();
      expect(res.data?.listEnquiries.totalCount).toBeGreaterThanOrEqual(1);
    });

    it('searches by student name', async () => {
      const res = await gql<{ listEnquiries: unknown }>(
        LIST_QUERY,
        { filter: { search: 'Priya' } },
        accessToken,
      );
      expect(res.errors).toBeUndefined();
      expect(res.data?.listEnquiries).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────
  // 03-convert-to-application
  // ─────────────────────────────────────────────────────
  describe('convertEnquiryToApplication', () => {
    it('creates a SUBMITTED application linked back to the enquiry', async () => {
      // Fresh enquiry so we don't consume the one captured in 01.
      const enquiryRes = await gql<{ createEnquiry: { id: string } }>(
        `mutation($input: CreateEnquiryInput!) { createEnquiry(input: $input) { id } }`,
        {
          input: {
            studentName: 'Convert Source',
            parentName: 'Convert Parent',
            parentPhone: `91234${String(Date.now()).slice(-5)}`,
            classRequested: 'Class 1',
          },
        },
        accessToken,
      );
      expect(enquiryRes.errors).toBeUndefined();
      const enquiryId = enquiryRes.data?.createEnquiry.id;
      assert(enquiryId);

      const res = await gql<{
        convertEnquiryToApplication: {
          id: string;
          status: AdmissionApplicationStatus;
          enquiryId: string | null;
        };
      }>(
        `mutation Convert($enquiryId: ID!, $standardId: ID!, $academicYearId: ID!) {
          convertEnquiryToApplication(
            enquiryId: $enquiryId
            standardId: $standardId
            academicYearId: $academicYearId
          ) { id status enquiryId }
        }`,
        { enquiryId, standardId, academicYearId },
        accessToken,
      );
      expect(res.errors).toBeUndefined();
      const app = res.data?.convertEnquiryToApplication;
      assert(app);
      expect(app.id).toBeTruthy();
      expect(app.status).toBe(AdmissionApplicationStatus.SUBMITTED);
      expect(app.enquiryId).toBe(enquiryId);
    });
  });

  // ─────────────────────────────────────────────────────
  // 04-application-lifecycle
  // ─────────────────────────────────────────────────────
  describe('application lifecycle', () => {
    const UPDATE = `
      mutation UpdateApp($id: ID!, $input: UpdateApplicationInput!) {
        updateApplication(id: $id, input: $input) {
          id status offeredAt offerAcceptedAt
        }
      }
    `;

    it('walks SUBMITTED → DOCUMENTS_PENDING → DOCUMENTS_VERIFIED → OFFER_MADE → OFFER_ACCEPTED → FEE_PENDING → FEE_PAID', async () => {
      // Create application directly (skipping the enquiry step — tested in 03).
      const createRes = await gql<{
        createApplication: { id: string; status: AdmissionApplicationStatus };
      }>(
        `mutation CreateApp($input: CreateApplicationInput!) {
          createApplication(input: $input) { id status }
        }`,
        {
          input: {
            academicYearId,
            standardId,
            formData: { studentName: 'Lifecycle Test', parentPhone: '9999888877' },
          },
        },
        accessToken,
      );
      expect(createRes.errors).toBeUndefined();
      const appId = createRes.data?.createApplication.id;
      assert(appId);
      expect(createRes.data?.createApplication.status).toBe(AdmissionApplicationStatus.SUBMITTED);

      const transitions: Array<{
        to: AdmissionApplicationStatus;
        expectTimestamp?: 'offeredAt' | 'offerAcceptedAt';
      }> = [
        { to: AdmissionApplicationStatus.DOCUMENTS_PENDING },
        { to: AdmissionApplicationStatus.DOCUMENTS_VERIFIED },
        { to: AdmissionApplicationStatus.OFFER_MADE, expectTimestamp: 'offeredAt' },
        { to: AdmissionApplicationStatus.OFFER_ACCEPTED, expectTimestamp: 'offerAcceptedAt' },
        { to: AdmissionApplicationStatus.FEE_PENDING },
        { to: AdmissionApplicationStatus.FEE_PAID },
      ];

      for (const step of transitions) {
        const res = await gql<{ updateApplication: ApplicationModel }>(
          UPDATE,
          { id: appId, input: { status: step.to } },
          accessToken,
        );
        expect(res.errors, `transition to ${step.to} failed`).toBeUndefined();
        expect(res.data?.updateApplication.status).toBe(step.to);
        if (step.expectTimestamp) {
          expect(
            res.data?.updateApplication[step.expectTimestamp],
            `${step.expectTimestamp} should be set after ${step.to}`,
          ).toBeTruthy();
        }
      }
    });

    it('approveApplication triggers StudentAdmissionWorkflow (enrolled transition requires worker — ROV-232)', async () => {
      // We can assert the mutation itself returns successfully and sets the
      // status to ENROLLED at the service layer (post-workflow-start). The
      // full end-to-end (worker picks up, activities run, student record
      // created) is blocked on the worker addition tracked in ROV-232.
      // Until then, this test confirms the trigger endpoint works; the
      // background workflow will accumulate in Temporal's queue.
      const createRes = await gql<{ createApplication: { id: string } }>(
        `mutation CreateApp($input: CreateApplicationInput!) {
          createApplication(input: $input) { id }
        }`,
        {
          input: {
            academicYearId,
            standardId,
            formData: { studentName: 'Approve Test', parentPhone: '9111000022' },
          },
        },
        accessToken,
      );
      expect(createRes.errors).toBeUndefined();
      const appId = createRes.data?.createApplication.id;
      assert(appId);

      // Fast-forward through states to FEE_PAID.
      for (const status of [
        AdmissionApplicationStatus.DOCUMENTS_PENDING,
        AdmissionApplicationStatus.DOCUMENTS_VERIFIED,
        AdmissionApplicationStatus.OFFER_MADE,
        AdmissionApplicationStatus.OFFER_ACCEPTED,
        AdmissionApplicationStatus.FEE_PENDING,
        AdmissionApplicationStatus.FEE_PAID,
      ]) {
        const r = await gql(UPDATE, { id: appId, input: { status } }, accessToken);
        expect(r.errors, `transition to ${status} failed`).toBeUndefined();
      }

      const approveRes = await gql<{
        approveApplication: { id: string; status: AdmissionApplicationStatus };
      }>(
        `mutation Approve($id: ID!) { approveApplication(id: $id) { id status } }`,
        { id: appId },
        accessToken,
      );
      expect(approveRes.errors).toBeUndefined();
      expect(approveRes.data?.approveApplication.status).toBe(AdmissionApplicationStatus.ENROLLED);
    });
  });

  // ─────────────────────────────────────────────────────
  // applicationStatusUpdated subscription
  // ─────────────────────────────────────────────────────
  describe('applicationStatusUpdated subscription', () => {
    it('fires after updateApplication with the new status', async () => {
      // Seed an application to mutate.
      const createRes = await gql<{ createApplication: { id: string } }>(
        `mutation CreateApp($input: CreateApplicationInput!) {
          createApplication(input: $input) { id }
        }`,
        {
          input: {
            academicYearId,
            standardId,
            formData: { studentName: 'Sub Trigger App', parentPhone: '9444333222' },
          },
        },
        accessToken,
      );
      expect(createRes.errors).toBeUndefined();
      const appId = createRes.data?.createApplication.id;
      assert(appId);

      type Envelope = {
        applicationStatusUpdated: {
          applicationId: string;
          newStatus: AdmissionApplicationStatus;
        };
      };
      const eventPromise = subscribeOnce<Envelope>(
        `subscription {
          applicationStatusUpdated { applicationId newStatus }
        }`,
        {},
        accessToken,
      );
      await new Promise((r) => setTimeout(r, 200));

      const updateRes = await gql(
        `mutation($id: ID!, $input: UpdateApplicationInput!) {
          updateApplication(id: $id, input: $input) { id status }
        }`,
        { id: appId, input: { status: AdmissionApplicationStatus.DOCUMENTS_PENDING } },
        accessToken,
      );
      expect(updateRes.errors).toBeUndefined();

      const event = await eventPromise;
      expect(event.applicationStatusUpdated.applicationId).toBe(appId);
      expect(event.applicationStatusUpdated.newStatus).toBe(
        AdmissionApplicationStatus.DOCUMENTS_PENDING,
      );
    });
  });

  // ─────────────────────────────────────────────────────
  // 05-admission-statistics
  // ─────────────────────────────────────────────────────
  describe('admissionStatistics', () => {
    it('returns funnel counts, per-source breakdown, and conversion ratios', async () => {
      const res = await gql<{
        admissionStatistics: {
          totalEnquiries: number;
          totalApplications: number;
          funnel: Array<{ stage: string; count: number }>;
          bySource: Array<{ source: string; enquiryCount: number }>;
          enquiryToApplicationRate: number;
          applicationToEnrolledRate: number;
        };
      }>(
        `query {
          admissionStatistics {
            totalEnquiries
            totalApplications
            funnel { stage count }
            bySource { source enquiryCount }
            enquiryToApplicationRate
            applicationToEnrolledRate
          }
        }`,
        {},
        accessToken,
      );

      expect(res.errors).toBeUndefined();
      const stats = res.data?.admissionStatistics;
      assert(stats);
      expect(stats.totalEnquiries).toBeGreaterThanOrEqual(0);
      expect(stats.totalApplications).toBeGreaterThanOrEqual(0);
      expect(stats.funnel.length).toBeGreaterThanOrEqual(1);
      expect(stats.enquiryToApplicationRate).toBeGreaterThanOrEqual(0);
      expect(stats.applicationToEnrolledRate).toBeGreaterThanOrEqual(0);
    });
  });

  // ─────────────────────────────────────────────────────
  // 06-rte-application
  // ─────────────────────────────────────────────────────
  describe('RTE application', () => {
    it('preserves isRteApplication=true through a status change', async () => {
      const createRes = await gql<{
        createApplication: {
          id: string;
          status: AdmissionApplicationStatus;
          isRteApplication: boolean;
        };
      }>(
        `mutation CreateApp($input: CreateApplicationInput!) {
          createApplication(input: $input) { id status isRteApplication }
        }`,
        {
          input: {
            academicYearId,
            standardId,
            formData: { studentName: 'RTE Student', parentPhone: '9111222333' },
            isRteApplication: true,
          },
        },
        accessToken,
      );
      expect(createRes.errors).toBeUndefined();
      const app = createRes.data?.createApplication;
      assert(app);
      expect(app.isRteApplication).toBe(true);
      expect(app.status).toBe(AdmissionApplicationStatus.SUBMITTED);

      const updateRes = await gql<{
        updateApplication: { status: AdmissionApplicationStatus; isRteApplication: boolean };
      }>(
        `mutation UpdateApp($id: ID!, $input: UpdateApplicationInput!) {
          updateApplication(id: $id, input: $input) { status isRteApplication }
        }`,
        { id: app.id, input: { status: AdmissionApplicationStatus.DOCUMENTS_PENDING } },
        accessToken,
      );
      expect(updateRes.errors).toBeUndefined();
      expect(updateRes.data?.updateApplication.isRteApplication).toBe(true);
      expect(updateRes.data?.updateApplication.status).toBe(
        AdmissionApplicationStatus.DOCUMENTS_PENDING,
      );
    });
  });

  // ─────────────────────────────────────────────────────
  // 07-dedup-enquiry
  // ─────────────────────────────────────────────────────
  describe('enquiry dedup', () => {
    it('flags a second enquiry with the same (phone, classRequested) as isDuplicate=true', async () => {
      const dedupPhone = `94445${String(Date.now()).slice(-5)}`;

      // First enquiry — should be unique.
      const firstRes = await gql<{ createEnquiry: { id: string; isDuplicate: boolean } }>(
        `mutation($input: CreateEnquiryInput!) { createEnquiry(input: $input) { id isDuplicate } }`,
        {
          input: {
            studentName: 'Dedup Child A',
            parentName: 'Dedup Parent',
            parentPhone: dedupPhone,
            classRequested: 'LKG',
          },
        },
        accessToken,
      );
      expect(firstRes.errors).toBeUndefined();
      expect(firstRes.data?.createEnquiry.isDuplicate).toBe(false);

      // Same phone + class — should be flagged.
      const secondRes = await gql<{ createEnquiry: { id: string; isDuplicate: boolean } }>(
        `mutation($input: CreateEnquiryInput!) { createEnquiry(input: $input) { id isDuplicate } }`,
        {
          input: {
            studentName: 'Dedup Child B',
            parentName: 'Dedup Parent',
            parentPhone: dedupPhone,
            classRequested: 'LKG',
          },
        },
        accessToken,
      );
      expect(secondRes.errors).toBeUndefined();
      expect(secondRes.data?.createEnquiry.id).toBeTruthy();
      expect(secondRes.data?.createEnquiry.isDuplicate).toBe(true);
    });
  });
});
