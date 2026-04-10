/**
 * Cross-scope guard rejection — table-driven integration tests.
 *
 * Boots the full Nest app once and asserts every representative operation
 * rejects the two "wrong" scope tokens with a FORBIDDEN error. Scope guards
 * fire before DB lookups, so fake UUIDs are fine for membership / tenant /
 * reseller identifiers.
 *
 * This expands the proof-of-concept rejection tests in
 * `integration-app.integration.spec.ts` to cover every platform, reseller,
 * and a representative sample of institute resolvers — closing the G2 gap.
 */

import {
  createInstituteToken,
  createIntegrationApp,
  createPlatformToken,
  createResellerToken,
  gqlRequest,
  type IntegrationAppResult,
} from '@roviq/testing/integration';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_IDS } from '../../../../scripts/seed-ids';
import { AppModule } from '../app/app.module';

// Scope guard fires before any DB lookup — these IDs never need to exist.
const FAKE = {
  USER: '00000000-0000-4000-a000-000000000fff',
  MEMBERSHIP: '00000000-0000-4000-a000-000000000ffe',
  ROLE: '00000000-0000-4000-a000-000000000ffd',
  TENANT: '00000000-0000-4000-a000-000000000ffc',
  RESELLER: '00000000-0000-4000-a000-000000000ffb',
} as const;

interface Op {
  readonly name: string;
  readonly query: string;
}

// @PlatformScope operations — one representative query per resolver class.
//
// Skipped resolvers:
// - AdminResellerResolver: mutations only (adminSuspendReseller,
//   adminDeleteReseller). Scope guard fires identically for mutations and
//   queries, so coverage is exercised by the other platform resolvers.
// - AdminInstituteSubscriptionResolver: @Subscription only — cannot be
//   exercised via an HTTP POST request.
const PLATFORM_OPS: readonly Op[] = [
  // AdminInstituteResolver
  {
    name: 'adminListInstitutes',
    query: 'query { adminListInstitutes { totalCount } }',
  },
  // AdminInstituteResolver — statistics query on the same class
  {
    name: 'adminInstituteStatistics',
    query: 'query { adminInstituteStatistics { totalInstitutes } }',
  },
  // AdminInstituteGroupResolver
  {
    name: 'adminListInstituteGroups',
    query: 'query { adminListInstituteGroups { totalCount } }',
  },
  // AdminUserResolver
  {
    name: 'adminListUsers',
    query: 'query { adminListUsers { totalCount } }',
  },
  // AuditResolver — platform-scoped @Query adminAuditLogs
  {
    name: 'adminAuditLogs',
    query: 'query { adminAuditLogs { totalCount } }',
  },
  // AuditResolver — platform-scoped @Query authEvents (separate method, same class)
  {
    name: 'authEvents',
    query: 'query { authEvents { __typename } }',
  },
];

// @ResellerScope operations — one representative query per resolver class.
// The EE billing reseller resolver uses explicit `{ name: '...' }` on its
// @Query decorators — the test MUST use those schema names.
//
// Skipped resolvers:
// - ResellerBillingSubscriptions: @Subscription only — cannot be exercised
//   via HTTP POST.
// - ResellerInstituteSubscriptionResolver: @Subscription only.
const RESELLER_OPS: readonly Op[] = [
  // ResellerInstituteResolver
  {
    name: 'resellerListInstitutes',
    query: 'query { resellerListInstitutes { totalCount } }',
  },
  // ResellerInstituteResolver — statistics on the same class
  {
    name: 'resellerInstituteStatistics',
    query: 'query { resellerInstituteStatistics { totalInstitutes } }',
  },
  // ResellerInstituteGroupResolver
  {
    name: 'resellerListInstituteGroups',
    query: 'query { resellerListInstituteGroups }',
  },
  // ResellerUserResolver
  {
    name: 'resellerListUsers',
    query: 'query { resellerListUsers { totalCount } }',
  },
  // AuditResolver — reseller-scoped @Query
  {
    name: 'resellerAuditLogs',
    query: 'query { resellerAuditLogs { totalCount } }',
  },
  // ResellerBillingResolver — ee billing, `{ name: 'subscriptionPlans' }`
  {
    name: 'subscriptionPlans',
    query: 'query { subscriptionPlans { __typename } }',
  },
  // ResellerBillingResolver — `{ name: 'resellerBillingDashboard' }`
  {
    name: 'resellerBillingDashboard',
    query: 'query { resellerBillingDashboard { __typename } }',
  },
  // ResellerBillingResolver — `{ name: 'unverifiedPayments' }`
  {
    name: 'unverifiedPayments',
    query: 'query { unverifiedPayments { __typename } }',
  },
];

// @InstituteScope operations — one representative query per resolver class.
//
// Skipped resolvers (all have every @Query gated by a required arg that the
// schema validator rejects BEFORE the scope guard fires, producing a
// GRAPHQL_VALIDATION_FAILED error instead of the FORBIDDEN we need):
// - SectionResolver: `sections(standardId: ID!)` / `section(id: ID!)`
// - StandardResolver: `standards(academicYearId: ID!)` / `standard(id: ID!)`
// - StudentAcademicResolver: `listStudentAcademics(studentProfileId: ID!)`
// - StudentBulkImportResolver: `getBulkImportProgress(workflowId: String!)`
// Subscription-only resolvers (cannot POST to an @Subscription):
// - InstituteSubscriptionResolver
// - InstituteBillingSubscriptions
const INSTITUTE_OPS: readonly Op[] = [
  // NotificationConfigResolver
  {
    name: 'notificationConfigs',
    query: 'query { notificationConfigs { __typename } }',
  },
  // SubjectResolver
  {
    name: 'subjects',
    query: 'query { subjects { __typename } }',
  },
  // StaffResolver
  {
    name: 'listStaff',
    query: 'query { listStaff { __typename } }',
  },
  // StaffResolver — statistics query on the same class
  {
    name: 'staffStatistics',
    query: 'query { staffStatistics { __typename } }',
  },
  // EnquiryResolver
  {
    name: 'listEnquiries',
    query: 'query { listEnquiries { totalCount } }',
  },
  // ApplicationResolver
  {
    name: 'listApplications',
    query: 'query { listApplications { totalCount } }',
  },
  // ApplicationResolver — statistics on the same class
  {
    name: 'admissionStatistics',
    query: 'query { admissionStatistics { __typename } }',
  },
  // BotResolver
  {
    name: 'listBots',
    query: 'query { listBots { __typename } }',
  },
  // StudentResolver
  {
    name: 'listStudents',
    query: 'query { listStudents { totalCount } }',
  },
  // StudentResolver — statistics on the same class
  {
    name: 'studentStatistics',
    query: 'query { studentStatistics { __typename } }',
  },
  // CertificateResolver
  {
    name: 'listCertificates',
    query: 'query { listCertificates { __typename } }',
  },
  // TCResolver
  {
    name: 'listTCs',
    query: 'query { listTCs { __typename } }',
  },
  // ComplianceExportResolver
  {
    name: 'listExportReports',
    query: 'query { listExportReports { __typename } }',
  },
  // ProfileResolver
  {
    name: 'myProfile',
    query: 'query { myProfile { __typename } }',
  },
  // GuardianResolver
  {
    name: 'listGuardians',
    query: 'query { listGuardians { __typename } }',
  },
  // GroupResolver
  {
    name: 'listGroups',
    query: 'query { listGroups { __typename } }',
  },
  // InstituteResolver
  {
    name: 'institutes',
    query: 'query { institutes { totalCount } }',
  },
  // AcademicYearResolver
  {
    name: 'academicYears',
    query: 'query { academicYears { __typename } }',
  },
  // AcademicYearResolver — another @Query on the same class
  {
    name: 'activeAcademicYear',
    query: 'query { activeAcademicYear { __typename } }',
  },
  // InstituteGroupResolver
  {
    name: 'instituteGroups',
    query: 'query { instituteGroups { totalCount } }',
  },
  // AuditResolver — institute-scoped @Query
  {
    name: 'auditLogs',
    query: 'query { auditLogs { totalCount } }',
  },
  // InstituteBillingResolver (ee)
  {
    name: 'mySubscription',
    query: 'query { mySubscription { __typename } }',
  },
  // ConsentResolver
  {
    name: 'myConsentStatus',
    query: 'query { myConsentStatus { __typename } }',
  },
];

describe('Cross-scope guard rejection', () => {
  let result: IntegrationAppResult;

  const platformToken = createPlatformToken({
    sub: FAKE.USER,
    membershipId: FAKE.MEMBERSHIP,
    roleId: FAKE.ROLE,
  });
  const resellerToken = createResellerToken({
    sub: FAKE.USER,
    resellerId: FAKE.RESELLER,
    membershipId: FAKE.MEMBERSHIP,
    roleId: FAKE.ROLE,
  });
  // Reseller token backed by the real seeded role so AbilityFactory can
  // resolve abilities — used only for the positive-proof test.
  const seededResellerToken = createResellerToken({
    sub: SEED_IDS.USER_RESELLER,
    resellerId: SEED_IDS.RESELLER_DIRECT,
    membershipId: FAKE.MEMBERSHIP,
    roleId: SEED_IDS.ROLE_RESELLER_FULL_ADMIN,
  });
  const instituteToken = createInstituteToken({
    sub: FAKE.USER,
    tenantId: FAKE.TENANT,
    membershipId: FAKE.MEMBERSHIP,
    roleId: FAKE.ROLE,
  });

  beforeAll(async () => {
    result = await createIntegrationApp({ modules: [AppModule] });
  });

  afterAll(async () => {
    await result?.close();
  });

  // ── Positive proof ──────────────────────────────────────
  //
  // The negative tests above use fake UUIDs because the scope guard fires
  // BEFORE any DB lookup. But to guarantee that we are actually asserting
  // FORBIDDEN for the right reason — not because the token couldn't
  // authenticate at all — we also assert that a correctly-scoped token can
  // reach each resolver WITHOUT a FORBIDDEN error. The query may still
  // error out (missing DB rows, CASL rejection, NotFound) — but it must
  // not be FORBIDDEN from the scope guard.
  describe('Positive proof: correct scope tokens are NOT rejected by scope guard', () => {
    it('platform token reaches a @PlatformScope resolver without FORBIDDEN', async () => {
      const response = await gqlRequest(result.httpServer, {
        query: PLATFORM_OPS[0].query,
        token: platformToken,
      });
      const code = response.errors?.[0]?.extensions?.code;
      expect(code).not.toBe('FORBIDDEN');
    });

    it('reseller token reaches a @ResellerScope resolver without FORBIDDEN', async () => {
      const response = await gqlRequest(result.httpServer, {
        query: RESELLER_OPS[0].query,
        token: seededResellerToken,
      });
      const code = response.errors?.[0]?.extensions?.code;
      expect(code).not.toBe('FORBIDDEN');
    });

    it('institute token reaches an @InstituteScope resolver without FORBIDDEN', async () => {
      const response = await gqlRequest(result.httpServer, {
        query: INSTITUTE_OPS[0].query,
        token: instituteToken,
      });
      const code = response.errors?.[0]?.extensions?.code;
      expect(code).not.toBe('FORBIDDEN');
    });
  });

  describe('@PlatformScope rejects non-platform tokens', () => {
    it.each(PLATFORM_OPS)('$name rejects reseller token', async ({ query }) => {
      const response = await gqlRequest(result.httpServer, { query, token: resellerToken });
      expect(response.errors, `expected errors for query: ${query}`).toBeDefined();
      expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it.each(PLATFORM_OPS)('$name rejects institute token', async ({ query }) => {
      const response = await gqlRequest(result.httpServer, { query, token: instituteToken });
      expect(response.errors, `expected errors for query: ${query}`).toBeDefined();
      expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });
  });

  describe('@ResellerScope rejects non-reseller tokens', () => {
    it.each(RESELLER_OPS)('$name rejects platform token', async ({ query }) => {
      const response = await gqlRequest(result.httpServer, { query, token: platformToken });
      expect(response.errors, `expected errors for query: ${query}`).toBeDefined();
      expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it.each(RESELLER_OPS)('$name rejects institute token', async ({ query }) => {
      const response = await gqlRequest(result.httpServer, { query, token: instituteToken });
      expect(response.errors, `expected errors for query: ${query}`).toBeDefined();
      expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });
  });

  describe('@InstituteScope rejects non-institute tokens', () => {
    it.each(INSTITUTE_OPS)('$name rejects platform token', async ({ query }) => {
      const response = await gqlRequest(result.httpServer, { query, token: platformToken });
      expect(response.errors, `expected errors for query: ${query}`).toBeDefined();
      expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it.each(INSTITUTE_OPS)('$name rejects reseller token', async ({ query }) => {
      const response = await gqlRequest(result.httpServer, { query, token: resellerToken });
      expect(response.errors, `expected errors for query: ${query}`).toBeDefined();
      expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });
  });
});
