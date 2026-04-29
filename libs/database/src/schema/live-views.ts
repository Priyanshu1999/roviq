/**
 * Live views — `<table>_live` for every soft-deletable table.
 *
 * Soft-delete visibility is enforced here (not in RLS, not by every repository
 * sprinkling `isNull(deletedAt)`). Repositories that should hide trashed rows
 * import the `*_live` view and read from it; writes target the underlying
 * table; restore / admin-trash flows read the underlying table directly.
 *
 * Each view is created with `WITH (security_invoker = true)` in the matching
 * migration so SELECT runs RLS as the calling DB role
 * (roviq_app/roviq_reseller/roviq_admin). Without that, PostgreSQL evaluates
 * RLS as the view owner, which would let an roviq_app connection read other
 * tenants' rows.
 *
 * On PG 18 the planner inlines security_invoker views with the underlying
 * partial indexes (`WHERE deleted_at IS NULL`), so read performance matches
 * a direct table query.
 */

import { isNull } from 'drizzle-orm';
import { pgView } from 'drizzle-orm/pg-core';

import { admissionApplications } from './admission/admission-applications';
import { enquiries } from './admission/enquiries';
import { issuedCertificates } from './admission/issued-certificates';
import { tcRegister } from './admission/tc-register';
import { groups } from './groups/groups';
import { academicYears } from './tenant/academic-years';
import { attendanceEntries } from './tenant/attendance/attendance-entries';
import { attendanceSessions } from './tenant/attendance/attendance-sessions';
import { holidays } from './tenant/holidays';
import { instituteAffiliations } from './tenant/institute-affiliations';
import { instituteBranding } from './tenant/institute-branding';
import { instituteConfigs } from './tenant/institute-configs';
import { instituteGroupBranding } from './tenant/institute-group-branding';
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

// Tenant root + group-branding entity.
export const institutesLive = pgView('institutes_live').as((qb) =>
  qb.select().from(institutes).where(isNull(institutes.deletedAt)),
);
export const instituteGroupBrandingLive = pgView('institute_group_branding_live').as((qb) =>
  qb.select().from(instituteGroupBranding).where(isNull(instituteGroupBranding.deletedAt)),
);

// Tenant business tables.
export const academicYearsLive = pgView('academic_years_live').as((qb) =>
  qb.select().from(academicYears).where(isNull(academicYears.deletedAt)),
);
export const attendanceEntriesLive = pgView('attendance_entries_live').as((qb) =>
  qb.select().from(attendanceEntries).where(isNull(attendanceEntries.deletedAt)),
);
export const attendanceSessionsLive = pgView('attendance_sessions_live').as((qb) =>
  qb.select().from(attendanceSessions).where(isNull(attendanceSessions.deletedAt)),
);
export const holidaysLive = pgView('holidays_live').as((qb) =>
  qb.select().from(holidays).where(isNull(holidays.deletedAt)),
);
export const instituteAffiliationsLive = pgView('institute_affiliations_live').as((qb) =>
  qb.select().from(instituteAffiliations).where(isNull(instituteAffiliations.deletedAt)),
);
export const instituteBrandingLive = pgView('institute_branding_live').as((qb) =>
  qb.select().from(instituteBranding).where(isNull(instituteBranding.deletedAt)),
);
export const instituteConfigsLive = pgView('institute_configs_live').as((qb) =>
  qb.select().from(instituteConfigs).where(isNull(instituteConfigs.deletedAt)),
);
export const instituteIdentifiersLive = pgView('institute_identifiers_live').as((qb) =>
  qb.select().from(instituteIdentifiers).where(isNull(instituteIdentifiers.deletedAt)),
);
export const leavesLive = pgView('leaves_live').as((qb) =>
  qb.select().from(leaves).where(isNull(leaves.deletedAt)),
);
export const membershipsLive = pgView('memberships_live').as((qb) =>
  qb.select().from(memberships).where(isNull(memberships.deletedAt)),
);
export const rolesLive = pgView('roles_live').as((qb) =>
  qb.select().from(roles).where(isNull(roles.deletedAt)),
);
export const sectionsLive = pgView('sections_live').as((qb) =>
  qb.select().from(sections).where(isNull(sections.deletedAt)),
);
export const sectionSubjectsLive = pgView('section_subjects_live').as((qb) =>
  qb.select().from(sectionSubjects).where(isNull(sectionSubjects.deletedAt)),
);
export const standardsLive = pgView('standards_live').as((qb) =>
  qb.select().from(standards).where(isNull(standards.deletedAt)),
);
export const standardSubjectsLive = pgView('standard_subjects_live').as((qb) =>
  qb.select().from(standardSubjects).where(isNull(standardSubjects.deletedAt)),
);
export const subjectsLive = pgView('subjects_live').as((qb) =>
  qb.select().from(subjects).where(isNull(subjects.deletedAt)),
);

// Admission domain.
export const admissionApplicationsLive = pgView('admission_applications_live').as((qb) =>
  qb.select().from(admissionApplications).where(isNull(admissionApplications.deletedAt)),
);
export const enquiriesLive = pgView('enquiries_live').as((qb) =>
  qb.select().from(enquiries).where(isNull(enquiries.deletedAt)),
);
export const issuedCertificatesLive = pgView('issued_certificates_live').as((qb) =>
  qb.select().from(issuedCertificates).where(isNull(issuedCertificates.deletedAt)),
);
export const tcRegisterLive = pgView('tc_register_live').as((qb) =>
  qb.select().from(tcRegister).where(isNull(tcRegister.deletedAt)),
);

// Dynamic groups.
export const groupsLive = pgView('groups_live').as((qb) =>
  qb.select().from(groups).where(isNull(groups.deletedAt)),
);

// User profiles.
export const botProfilesLive = pgView('bot_profiles_live').as((qb) =>
  qb.select().from(botProfiles).where(isNull(botProfiles.deletedAt)),
);
export const guardianProfilesLive = pgView('guardian_profiles_live').as((qb) =>
  qb.select().from(guardianProfiles).where(isNull(guardianProfiles.deletedAt)),
);
export const staffProfilesLive = pgView('staff_profiles_live').as((qb) =>
  qb.select().from(staffProfiles).where(isNull(staffProfiles.deletedAt)),
);
export const studentAcademicsLive = pgView('student_academics_live').as((qb) =>
  qb.select().from(studentAcademics).where(isNull(studentAcademics.deletedAt)),
);
export const studentProfilesLive = pgView('student_profiles_live').as((qb) =>
  qb.select().from(studentProfiles).where(isNull(studentProfiles.deletedAt)),
);
