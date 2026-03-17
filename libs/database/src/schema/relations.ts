import { defineRelations } from 'drizzle-orm';
import * as schema from './index';

export const relations = defineRelations(schema, (r) => ({
  // ── Auth ──────────────────────────────────────────────
  users: {
    authProviders: r.many.authProviders(),
    phoneNumbers: r.many.phoneNumbers(),
    memberships: r.many.memberships(),
    refreshTokens: r.many.refreshTokens(),
  },

  authProviders: {
    user: r.one.users({
      from: r.authProviders.userId,
      to: r.users.id,
    }),
  },

  phoneNumbers: {
    user: r.one.users({
      from: r.phoneNumbers.userId,
      to: r.users.id,
    }),
  },

  refreshTokens: {
    user: r.one.users({
      from: r.refreshTokens.userId,
      to: r.users.id,
    }),
    membership: r.one.memberships({
      from: r.refreshTokens.membershipId,
      to: r.memberships.id,
    }),
  },

  // ── Tenant ────────────────────────────────────────────
  institutes: {
    roles: r.many.roles(),
    memberships: r.many.memberships(),
    notificationConfigs: r.many.instituteNotificationConfigs(),
    subscriptions: r.many.subscriptions(),
    invoices: r.many.invoices(),
    paymentGatewayConfig: r.one.paymentGatewayConfigs({
      from: r.institutes.id,
      to: r.paymentGatewayConfigs.instituteId,
    }),
    academicYears: r.many.academicYears(),
    identifiers: r.many.instituteIdentifiers(),
    affiliations: r.many.instituteAffiliations(),
    branding: r.one.instituteBranding({
      from: r.institutes.id,
      to: r.instituteBranding.tenantId,
    }),
    config: r.one.instituteConfigs({
      from: r.institutes.id,
      to: r.instituteConfigs.tenantId,
    }),
  },

  roles: {
    institute: r.one.institutes({
      from: r.roles.tenantId,
      to: r.institutes.id,
    }),
    memberships: r.many.memberships(),
  },

  memberships: {
    user: r.one.users({
      from: r.memberships.userId,
      to: r.users.id,
    }),
    institute: r.one.institutes({
      from: r.memberships.tenantId,
      to: r.institutes.id,
    }),
    role: r.one.roles({
      from: r.memberships.roleId,
      to: r.roles.id,
    }),
    profiles: r.many.profiles(),
    refreshTokens: r.many.refreshTokens(),
  },

  profiles: {
    membership: r.one.memberships({
      from: r.profiles.membershipId,
      to: r.memberships.id,
    }),
    asStudent: r.many.studentGuardians({
      alias: 'studentProfile',
    }),
    asGuardian: r.many.studentGuardians({
      alias: 'guardianProfile',
    }),
  },

  studentGuardians: {
    studentProfile: r.one.profiles({
      from: r.studentGuardians.studentProfileId,
      to: r.profiles.id,
      alias: 'studentProfile',
    }),
    guardianProfile: r.one.profiles({
      from: r.studentGuardians.guardianProfileId,
      to: r.profiles.id,
      alias: 'guardianProfile',
    }),
  },

  // ── Academic Year ────────────────────────────────────
  academicYears: {
    institute: r.one.institutes({
      from: r.academicYears.tenantId,
      to: r.institutes.id,
    }),
    standards: r.many.standards(),
  },

  // ── Standard ────────────────────────────────────────
  standards: {
    institute: r.one.institutes({
      from: r.standards.tenantId,
      to: r.institutes.id,
    }),
    academicYear: r.one.academicYears({
      from: r.standards.academicYearId,
      to: r.academicYears.id,
    }),
    sections: r.many.sections(),
  },

  // ── Section ─────────────────────────────────────────
  sections: {
    institute: r.one.institutes({
      from: r.sections.tenantId,
      to: r.institutes.id,
    }),
    standard: r.one.standards({
      from: r.sections.standardId,
      to: r.standards.id,
    }),
    academicYear: r.one.academicYears({
      from: r.sections.academicYearId,
      to: r.academicYears.id,
    }),
    classTeacher: r.one.memberships({
      from: r.sections.classTeacherId,
      to: r.memberships.id,
    }),
  },

  // ── Institute Children ────────────────────────────────
  instituteIdentifiers: {
    institute: r.one.institutes({
      from: r.instituteIdentifiers.tenantId,
      to: r.institutes.id,
    }),
  },

  instituteAffiliations: {
    institute: r.one.institutes({
      from: r.instituteAffiliations.tenantId,
      to: r.institutes.id,
    }),
  },

  instituteBranding: {
    institute: r.one.institutes({
      from: r.instituteBranding.tenantId,
      to: r.institutes.id,
    }),
  },

  instituteConfigs: {
    institute: r.one.institutes({
      from: r.instituteConfigs.tenantId,
      to: r.institutes.id,
    }),
  },

  // ── Notification ──────────────────────────────────────
  instituteNotificationConfigs: {
    institute: r.one.institutes({
      from: r.instituteNotificationConfigs.tenantId,
      to: r.institutes.id,
    }),
  },

  // ── Billing ───────────────────────────────────────────
  subscriptionPlans: {
    subscriptions: r.many.subscriptions(),
  },

  subscriptions: {
    institute: r.one.institutes({
      from: r.subscriptions.instituteId,
      to: r.institutes.id,
    }),
    plan: r.one.subscriptionPlans({
      from: r.subscriptions.planId,
      to: r.subscriptionPlans.id,
    }),
    invoices: r.many.invoices(),
    paymentEvents: r.many.paymentEvents(),
  },

  invoices: {
    subscription: r.one.subscriptions({
      from: r.invoices.subscriptionId,
      to: r.subscriptions.id,
    }),
    institute: r.one.institutes({
      from: r.invoices.instituteId,
      to: r.institutes.id,
    }),
    paymentEvents: r.many.paymentEvents(),
  },

  paymentEvents: {
    subscription: r.one.subscriptions({
      from: r.paymentEvents.subscriptionId,
      to: r.subscriptions.id,
    }),
    invoice: r.one.invoices({
      from: r.paymentEvents.invoiceId,
      to: r.invoices.id,
    }),
  },

  paymentGatewayConfigs: {
    institute: r.one.institutes({
      from: r.paymentGatewayConfigs.instituteId,
      to: r.institutes.id,
    }),
  },
}));
