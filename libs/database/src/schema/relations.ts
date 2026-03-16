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
