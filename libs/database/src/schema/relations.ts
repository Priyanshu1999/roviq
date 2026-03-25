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
    userProfile: r.one.userProfiles({
      from: r.users.id,
      to: r.userProfiles.userId,
    }),
    userIdentifiers: r.many.userIdentifiers(),
    userDocuments: r.many.userDocuments(),
    userAddresses: r.many.userAddresses(),
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
    groupMembers: r.many.groupMembers(),
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

  // ── User Profiles (platform-level) ──────────────────
  userProfiles: {
    user: r.one.users({
      from: r.userProfiles.userId,
      to: r.users.id,
    }),
  },

  userIdentifiers: {
    user: r.one.users({
      from: r.userIdentifiers.userId,
      to: r.users.id,
    }),
    verifier: r.one.users({
      from: r.userIdentifiers.verifiedBy,
      to: r.users.id,
      alias: 'identifierVerifier',
    }),
  },

  userDocuments: {
    user: r.one.users({
      from: r.userDocuments.userId,
      to: r.users.id,
    }),
    verifier: r.one.users({
      from: r.userDocuments.verifiedBy,
      to: r.users.id,
      alias: 'documentVerifier',
    }),
  },

  userAddresses: {
    user: r.one.users({
      from: r.userAddresses.userId,
      to: r.users.id,
    }),
  },

  // ── Student Profiles (tenant-scoped) ────────────────
  studentProfiles: {
    user: r.one.users({
      from: r.studentProfiles.userId,
      to: r.users.id,
    }),
    membership: r.one.memberships({
      from: r.studentProfiles.membershipId,
      to: r.memberships.id,
    }),
    institute: r.one.institutes({
      from: r.studentProfiles.tenantId,
      to: r.institutes.id,
    }),
    academics: r.many.studentAcademics(),
    guardianLinks: r.many.studentGuardianLinks(),
    tcRegisters: r.many.tcRegister(),
    issuedCertificates: r.many.issuedCertificates(),
    consentRecords: r.many.consentRecords(),
  },

  studentAcademics: {
    studentProfile: r.one.studentProfiles({
      from: r.studentAcademics.studentProfileId,
      to: r.studentProfiles.id,
    }),
    academicYear: r.one.academicYears({
      from: r.studentAcademics.academicYearId,
      to: r.academicYears.id,
    }),
    standard: r.one.standards({
      from: r.studentAcademics.standardId,
      to: r.standards.id,
    }),
    section: r.one.sections({
      from: r.studentAcademics.sectionId,
      to: r.sections.id,
    }),
    institute: r.one.institutes({
      from: r.studentAcademics.tenantId,
      to: r.institutes.id,
    }),
  },

  // ── Staff Profiles (tenant-scoped) ──────────────────
  staffProfiles: {
    user: r.one.users({
      from: r.staffProfiles.userId,
      to: r.users.id,
    }),
    membership: r.one.memberships({
      from: r.staffProfiles.membershipId,
      to: r.memberships.id,
    }),
    institute: r.one.institutes({
      from: r.staffProfiles.tenantId,
      to: r.institutes.id,
    }),
    qualifications: r.many.staffQualifications(),
    issuedCertificates: r.many.issuedCertificates(),
  },

  staffQualifications: {
    staffProfile: r.one.staffProfiles({
      from: r.staffQualifications.staffProfileId,
      to: r.staffProfiles.id,
    }),
    institute: r.one.institutes({
      from: r.staffQualifications.tenantId,
      to: r.institutes.id,
    }),
  },

  // ── Guardian Profiles (tenant-scoped) ─────────────────
  guardianProfiles: {
    user: r.one.users({
      from: r.guardianProfiles.userId,
      to: r.users.id,
    }),
    membership: r.one.memberships({
      from: r.guardianProfiles.membershipId,
      to: r.memberships.id,
    }),
    institute: r.one.institutes({
      from: r.guardianProfiles.tenantId,
      to: r.institutes.id,
    }),
    studentLinks: r.many.studentGuardianLinks(),
    consentRecords: r.many.consentRecords(),
  },

  // ── Student-Guardian Links (tenant-scoped) ────────────
  studentGuardianLinks: {
    studentProfile: r.one.studentProfiles({
      from: r.studentGuardianLinks.studentProfileId,
      to: r.studentProfiles.id,
    }),
    guardianProfile: r.one.guardianProfiles({
      from: r.studentGuardianLinks.guardianProfileId,
      to: r.guardianProfiles.id,
    }),
    institute: r.one.institutes({
      from: r.studentGuardianLinks.tenantId,
      to: r.institutes.id,
    }),
  },

  // ── Admission ───────────────────────────────────────
  enquiries: {
    institute: r.one.institutes({
      from: r.enquiries.tenantId,
      to: r.institutes.id,
    }),
    academicYear: r.one.academicYears({
      from: r.enquiries.academicYearId,
      to: r.academicYears.id,
    }),
    assignedStaff: r.one.users({
      from: r.enquiries.assignedTo,
      to: r.users.id,
      alias: 'enquiryAssignedTo',
    }),
    convertedApplication: r.one.admissionApplications({
      from: r.enquiries.convertedToApplicationId,
      to: r.admissionApplications.id,
    }),
  },

  admissionApplications: {
    institute: r.one.institutes({
      from: r.admissionApplications.tenantId,
      to: r.institutes.id,
    }),
    enquiry: r.one.enquiries({
      from: r.admissionApplications.enquiryId,
      to: r.enquiries.id,
    }),
    academicYear: r.one.academicYears({
      from: r.admissionApplications.academicYearId,
      to: r.academicYears.id,
    }),
    standard: r.one.standards({
      from: r.admissionApplications.standardId,
      to: r.standards.id,
    }),
    section: r.one.sections({
      from: r.admissionApplications.sectionId,
      to: r.sections.id,
    }),
    studentProfile: r.one.studentProfiles({
      from: r.admissionApplications.studentProfileId,
      to: r.studentProfiles.id,
    }),
    documents: r.many.applicationDocuments(),
  },

  applicationDocuments: {
    application: r.one.admissionApplications({
      from: r.applicationDocuments.applicationId,
      to: r.admissionApplications.id,
    }),
    institute: r.one.institutes({
      from: r.applicationDocuments.tenantId,
      to: r.institutes.id,
    }),
    verifier: r.one.users({
      from: r.applicationDocuments.verifiedBy,
      to: r.users.id,
      alias: 'appDocVerifier',
    }),
  },

  // ── Certificates ────────────────────────────────────
  tcRegister: {
    institute: r.one.institutes({
      from: r.tcRegister.tenantId,
      to: r.institutes.id,
    }),
    studentProfile: r.one.studentProfiles({
      from: r.tcRegister.studentProfileId,
      to: r.studentProfiles.id,
    }),
    academicYear: r.one.academicYears({
      from: r.tcRegister.academicYearId,
      to: r.academicYears.id,
    }),
    originalTc: r.one.tcRegister({
      from: r.tcRegister.originalTcId,
      to: r.tcRegister.id,
      alias: 'originalTc',
    }),
    requestedByUser: r.one.users({
      from: r.tcRegister.requestedBy,
      to: r.users.id,
      alias: 'tcRequestedBy',
    }),
    reviewedByUser: r.one.users({
      from: r.tcRegister.reviewedBy,
      to: r.users.id,
      alias: 'tcReviewedBy',
    }),
    approvedByUser: r.one.users({
      from: r.tcRegister.approvedBy,
      to: r.users.id,
      alias: 'tcApprovedBy',
    }),
  },

  certificateTemplates: {
    institute: r.one.institutes({
      from: r.certificateTemplates.tenantId,
      to: r.institutes.id,
    }),
    issuedCertificates: r.many.issuedCertificates(),
  },

  issuedCertificates: {
    institute: r.one.institutes({
      from: r.issuedCertificates.tenantId,
      to: r.institutes.id,
    }),
    template: r.one.certificateTemplates({
      from: r.issuedCertificates.templateId,
      to: r.certificateTemplates.id,
    }),
    studentProfile: r.one.studentProfiles({
      from: r.issuedCertificates.studentProfileId,
      to: r.studentProfiles.id,
    }),
    staffProfile: r.one.staffProfiles({
      from: r.issuedCertificates.staffProfileId,
      to: r.staffProfiles.id,
    }),
    issuedByUser: r.one.users({
      from: r.issuedCertificates.issuedBy,
      to: r.users.id,
      alias: 'certIssuedBy',
    }),
  },

  // ── Dynamic Groups ──────────────────────────────────
  groups: {
    institute: r.one.institutes({
      from: r.groups.tenantId,
      to: r.institutes.id,
    }),
    parentGroup: r.one.groups({
      from: r.groups.parentGroupId,
      to: r.groups.id,
      alias: 'parentGroup',
    }),
    rules: r.many.groupRules(),
    members: r.many.groupMembers(),
  },

  groupRules: {
    group: r.one.groups({
      from: r.groupRules.groupId,
      to: r.groups.id,
    }),
    institute: r.one.institutes({
      from: r.groupRules.tenantId,
      to: r.institutes.id,
    }),
  },

  groupMembers: {
    group: r.one.groups({
      from: r.groupMembers.groupId,
      to: r.groups.id,
    }),
    membership: r.one.memberships({
      from: r.groupMembers.membershipId,
      to: r.memberships.id,
    }),
    institute: r.one.institutes({
      from: r.groupMembers.tenantId,
      to: r.institutes.id,
    }),
  },

  groupChildren: {
    parentGroup: r.one.groups({
      from: r.groupChildren.parentGroupId,
      to: r.groups.id,
      alias: 'compositeParent',
    }),
    childGroup: r.one.groups({
      from: r.groupChildren.childGroupId,
      to: r.groups.id,
      alias: 'compositeChild',
    }),
    institute: r.one.institutes({
      from: r.groupChildren.tenantId,
      to: r.institutes.id,
    }),
  },

  // ── Bot Profiles (tenant-scoped) ────────────────────
  botProfiles: {
    user: r.one.users({
      from: r.botProfiles.userId,
      to: r.users.id,
    }),
    membership: r.one.memberships({
      from: r.botProfiles.membershipId,
      to: r.memberships.id,
    }),
    institute: r.one.institutes({
      from: r.botProfiles.tenantId,
      to: r.institutes.id,
    }),
  },

  // ── Consent & Privacy (tenant-scoped, append-only) ──
  consentRecords: {
    guardianProfile: r.one.guardianProfiles({
      from: r.consentRecords.guardianProfileId,
      to: r.guardianProfiles.id,
    }),
    studentProfile: r.one.studentProfiles({
      from: r.consentRecords.studentProfileId,
      to: r.studentProfiles.id,
    }),
    privacyNotice: r.one.privacyNotices({
      from: r.consentRecords.privacyNoticeId,
      to: r.privacyNotices.id,
    }),
    institute: r.one.institutes({
      from: r.consentRecords.tenantId,
      to: r.institutes.id,
    }),
  },

  privacyNotices: {
    institute: r.one.institutes({
      from: r.privacyNotices.tenantId,
      to: r.institutes.id,
    }),
  },
}));
