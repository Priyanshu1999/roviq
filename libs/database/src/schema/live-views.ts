// Live views — `<table>_live` hides trashed rows. Always declare via
// `liveView()` so RLS runs as the calling role, not the view owner.

import { isNull } from 'drizzle-orm';
import { pgView } from 'drizzle-orm/pg-core';

import { admissionApplications } from './admission/admission-applications';
import { enquiries } from './admission/enquiries';
import { issuedCertificates } from './admission/issued-certificates';
import { tcRegister } from './admission/tc-register';
import { groups } from './groups/groups';
import { instituteNotificationConfigs } from './notification/notification-configs';
import { resellers } from './reseller/resellers';
import { academicYears } from './tenant/academic-years';
import { attendanceEntries } from './tenant/attendance/attendance-entries';
import { attendanceSessions } from './tenant/attendance/attendance-sessions';
import { holidays } from './tenant/holidays';
import { instituteAffiliations } from './tenant/institute-affiliations';
import { instituteBranding } from './tenant/institute-branding';
import { instituteConfigs } from './tenant/institute-configs';
import { instituteGroupBranding } from './tenant/institute-group-branding';
import { instituteGroups } from './tenant/institute-groups';
import { instituteIdentifiers } from './tenant/institute-identifiers';
import { institutes } from './tenant/institutes';
import { leaves } from './tenant/leaves';
import { memberships } from './tenant/memberships';
import { roles } from './tenant/roles';
import { sectionSubjects } from './tenant/section-subjects';
import { sections } from './tenant/sections';
import { standardSubjects } from './tenant/standard-subjects';
import { standards } from './tenant/standards';
import { subjects } from './tenant/subjects';
import { botProfiles } from './user-profiles/bot-profiles';
import { guardianProfiles } from './user-profiles/guardian-profiles';
import { staffProfiles } from './user-profiles/staff-profiles';
import { studentAcademics } from './user-profiles/student-academics';
import { studentProfiles } from './user-profiles/student-profiles';

export const liveView = <T extends string>(name: T) => pgView(name).with({ securityInvoker: true });

// Tenant root + group-branding entity.
export const institutesLive = liveView('institutes_live').as((qb) =>
  qb.select().from(institutes).where(isNull(institutes.deletedAt)),
);
export const instituteGroupsLive = liveView('institute_groups_live').as((qb) =>
  qb.select().from(instituteGroups).where(isNull(instituteGroups.deletedAt)),
);
export const instituteGroupBrandingLive = liveView('institute_group_branding_live').as((qb) =>
  qb.select().from(instituteGroupBranding).where(isNull(instituteGroupBranding.deletedAt)),
);

// Reseller (platform-level entity with soft delete).
export const resellersLive = liveView('resellers_live').as((qb) =>
  qb.select().from(resellers).where(isNull(resellers.deletedAt)),
);

// Notification.
export const instituteNotificationConfigsLive = liveView('institute_notification_configs_live').as(
  (qb) =>
    qb
      .select()
      .from(instituteNotificationConfigs)
      .where(isNull(instituteNotificationConfigs.deletedAt)),
);

// Tenant business tables.
export const academicYearsLive = liveView('academic_years_live').as((qb) =>
  qb.select().from(academicYears).where(isNull(academicYears.deletedAt)),
);
export const attendanceEntriesLive = liveView('attendance_entries_live').as((qb) =>
  qb.select().from(attendanceEntries).where(isNull(attendanceEntries.deletedAt)),
);
export const attendanceSessionsLive = liveView('attendance_sessions_live').as((qb) =>
  qb.select().from(attendanceSessions).where(isNull(attendanceSessions.deletedAt)),
);
export const holidaysLive = liveView('holidays_live').as((qb) =>
  qb.select().from(holidays).where(isNull(holidays.deletedAt)),
);
export const instituteAffiliationsLive = liveView('institute_affiliations_live').as((qb) =>
  qb.select().from(instituteAffiliations).where(isNull(instituteAffiliations.deletedAt)),
);
export const instituteBrandingLive = liveView('institute_branding_live').as((qb) =>
  qb.select().from(instituteBranding).where(isNull(instituteBranding.deletedAt)),
);
export const instituteConfigsLive = liveView('institute_configs_live').as((qb) =>
  qb.select().from(instituteConfigs).where(isNull(instituteConfigs.deletedAt)),
);
export const instituteIdentifiersLive = liveView('institute_identifiers_live').as((qb) =>
  qb.select().from(instituteIdentifiers).where(isNull(instituteIdentifiers.deletedAt)),
);
export const leavesLive = liveView('leaves_live').as((qb) =>
  qb.select().from(leaves).where(isNull(leaves.deletedAt)),
);
export const membershipsLive = liveView('memberships_live').as((qb) =>
  qb.select().from(memberships).where(isNull(memberships.deletedAt)),
);
export const rolesLive = liveView('roles_live').as((qb) =>
  qb.select().from(roles).where(isNull(roles.deletedAt)),
);
export const sectionsLive = liveView('sections_live').as((qb) =>
  qb.select().from(sections).where(isNull(sections.deletedAt)),
);
export const sectionSubjectsLive = liveView('section_subjects_live').as((qb) =>
  qb.select().from(sectionSubjects).where(isNull(sectionSubjects.deletedAt)),
);
export const standardsLive = liveView('standards_live').as((qb) =>
  qb.select().from(standards).where(isNull(standards.deletedAt)),
);
export const standardSubjectsLive = liveView('standard_subjects_live').as((qb) =>
  qb.select().from(standardSubjects).where(isNull(standardSubjects.deletedAt)),
);
export const subjectsLive = liveView('subjects_live').as((qb) =>
  qb.select().from(subjects).where(isNull(subjects.deletedAt)),
);

// Admission domain.
export const admissionApplicationsLive = liveView('admission_applications_live').as((qb) =>
  qb.select().from(admissionApplications).where(isNull(admissionApplications.deletedAt)),
);
export const enquiriesLive = liveView('enquiries_live').as((qb) =>
  qb.select().from(enquiries).where(isNull(enquiries.deletedAt)),
);
export const issuedCertificatesLive = liveView('issued_certificates_live').as((qb) =>
  qb.select().from(issuedCertificates).where(isNull(issuedCertificates.deletedAt)),
);
export const tcRegisterLive = liveView('tc_register_live').as((qb) =>
  qb.select().from(tcRegister).where(isNull(tcRegister.deletedAt)),
);

// Dynamic groups.
export const groupsLive = liveView('groups_live').as((qb) =>
  qb.select().from(groups).where(isNull(groups.deletedAt)),
);

// User profiles.
export const botProfilesLive = liveView('bot_profiles_live').as((qb) =>
  qb.select().from(botProfiles).where(isNull(botProfiles.deletedAt)),
);
export const guardianProfilesLive = liveView('guardian_profiles_live').as((qb) =>
  qb.select().from(guardianProfiles).where(isNull(guardianProfiles.deletedAt)),
);
export const staffProfilesLive = liveView('staff_profiles_live').as((qb) =>
  qb.select().from(staffProfiles).where(isNull(staffProfiles.deletedAt)),
);
export const studentAcademicsLive = liveView('student_academics_live').as((qb) =>
  qb.select().from(studentAcademics).where(isNull(studentAcademics.deletedAt)),
);
export const studentProfilesLive = liveView('student_profiles_live').as((qb) =>
  qb.select().from(studentProfiles).where(isNull(studentProfiles.deletedAt)),
);
