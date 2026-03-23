import { defineRelations } from 'drizzle-orm';
import * as schema from './index';

export const relations = defineRelations(schema, (r) => ({
  // ── Auth ──────────────────────────────────────────────
  users: {
    authProviders: r.many.authProviders(),
    phoneNumbers: r.many.phoneNumbers(),
    platformMemberships: r.many.platformMemberships(),
    resellerMemberships: r.many.resellerMemberships(),
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
  },

  // ── Auth Events & Impersonation ─────────────────────────
  authEvents: {
    user: r.one.users({
      from: r.authEvents.userId,
      to: r.users.id,
    }),
  },

  impersonationSessions: {
    impersonator: r.one.users({
      from: r.impersonationSessions.impersonatorId,
      to: r.users.id,
      alias: 'impersonator',
    }),
    targetUser: r.one.users({
      from: r.impersonationSessions.targetUserId,
      to: r.users.id,
      alias: 'targetUser',
    }),
    targetInstitute: r.one.institutes({
      from: r.impersonationSessions.targetTenantId,
      to: r.institutes.id,
    }),
  },

  // ── Platform ────────────────────────────────────────────
  platformMemberships: {
    user: r.one.users({
      from: r.platformMemberships.userId,
      to: r.users.id,
    }),
    role: r.one.roles({
      from: r.platformMemberships.roleId,
      to: r.roles.id,
    }),
  },

  // ── Reseller ────────────────────────────────────────────
  resellers: {
    institutes: r.many.institutes(),
    resellerMemberships: r.many.resellerMemberships(),
  },

  resellerMemberships: {
    user: r.one.users({
      from: r.resellerMemberships.userId,
      to: r.users.id,
    }),
    role: r.one.roles({
      from: r.resellerMemberships.roleId,
      to: r.roles.id,
    }),
    reseller: r.one.resellers({
      from: r.resellerMemberships.resellerId,
      to: r.resellers.id,
    }),
  },

  // ── Tenant ────────────────────────────────────────────
  institutes: {
    roles: r.many.roles(),
    memberships: r.many.memberships(),
    notificationConfigs: r.many.instituteNotificationConfigs(),
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
    reseller: r.one.resellers({
      from: r.institutes.resellerId,
      to: r.resellers.id,
    }),
    group: r.one.instituteGroups({
      from: r.institutes.groupId,
      to: r.instituteGroups.id,
    }),
  },

  // ── Institute Groups ─────────────────────────────────
  instituteGroups: {
    institutes: r.many.institutes(),
    branding: r.one.instituteGroupBranding({
      from: r.instituteGroups.id,
      to: r.instituteGroupBranding.groupId,
    }),
    groupMemberships: r.many.groupMemberships(),
  },

  instituteGroupBranding: {
    group: r.one.instituteGroups({
      from: r.instituteGroupBranding.groupId,
      to: r.instituteGroups.id,
    }),
  },

  groupMemberships: {
    user: r.one.users({
      from: r.groupMemberships.userId,
      to: r.users.id,
    }),
    group: r.one.instituteGroups({
      from: r.groupMemberships.groupId,
      to: r.instituteGroups.id,
    }),
    role: r.one.roles({
      from: r.groupMemberships.roleId,
      to: r.roles.id,
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

  // ── Subject ─────────────────────────────────────────
  subjects: {
    institute: r.one.institutes({
      from: r.subjects.tenantId,
      to: r.institutes.id,
    }),
    standardSubjects: r.many.standardSubjects(),
    sectionSubjects: r.many.sectionSubjects(),
  },

  standardSubjects: {
    subject: r.one.subjects({
      from: r.standardSubjects.subjectId,
      to: r.subjects.id,
    }),
    standard: r.one.standards({
      from: r.standardSubjects.standardId,
      to: r.standards.id,
    }),
  },

  sectionSubjects: {
    subject: r.one.subjects({
      from: r.sectionSubjects.subjectId,
      to: r.subjects.id,
    }),
    section: r.one.sections({
      from: r.sectionSubjects.sectionId,
      to: r.sections.id,
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
}));
