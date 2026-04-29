import {
  ACADEMIC_STATUS_VALUES,
  ACADEMIC_YEAR_STATUS_VALUES,
  ADDRESS_TYPE_VALUES,
  ADMISSION_APPLICATION_STATUS_VALUES,
  ADMISSION_TYPE_VALUES,
  AFFILIATION_STATUS_VALUES,
  ATTENDANCE_MODE_VALUES,
  ATTENDANCE_STATUS_VALUES,
  ATTENDANCE_TYPE_VALUES,
  BATCH_STATUS_VALUES,
  BOARD_TYPE_VALUES,
  BOT_RATE_LIMIT_TIER_VALUES,
  BOT_STATUS_VALUES,
  BOT_TYPE_VALUES,
  CERTIFICATE_STATUS_VALUES,
  CERTIFICATE_TEMPLATE_TYPE_VALUES,
  DOMAIN_GROUP_TYPE_VALUES,
  DYNAMIC_GROUP_STATUS_VALUES,
  EDUCATION_LEVEL_VALUES,
  EMPLOYMENT_TYPE_VALUES,
  ENQUIRY_SOURCE_VALUES,
  ENQUIRY_STATUS_VALUES,
  GENDER_RESTRICTION_VALUES,
  GENDER_VALUES,
  GROUP_MEMBER_SOURCE_VALUES,
  GROUP_MEMBERSHIP_TYPE_VALUES,
  GROUP_STATUS_VALUES,
  GROUP_TYPE_VALUES,
  GUARDIAN_EDUCATION_LEVEL_VALUES,
  GUARDIAN_RELATIONSHIP_VALUES,
  HOLIDAY_TYPE_VALUES,
  INSTITUTE_IDENTIFIER_TYPE_VALUES,
  INSTITUTE_STATUS_VALUES,
  INSTITUTE_TYPE_VALUES,
  LEAVE_STATUS_VALUES,
  LEAVE_TYPE_VALUES,
  MEMBERSHIP_STATUS_VALUES,
  MINORITY_TYPE_VALUES,
  NEP_STAGE_VALUES,
  PROMOTION_STATUS_VALUES,
  QUALIFICATION_TYPE_VALUES,
  RESELLER_STATUS_VALUES,
  RESELLER_TIER_VALUES,
  ROLE_STATUS_VALUES,
  SETUP_STATUS_VALUES,
  SOCIAL_CATEGORY_VALUES,
  STREAM_TYPE_VALUES,
  STRUCTURE_FRAMEWORK_VALUES,
  STUDENT_STREAM_VALUES,
  SUBJECT_TYPE_VALUES,
  TC_STATUS_VALUES,
  USER_DOCUMENT_TYPE_VALUES,
  USER_IDENTIFIER_TYPE_VALUES,
  USER_STATUS_VALUES,
} from '@roviq/common-types';
import { pgEnum } from 'drizzle-orm/pg-core';

// ── Auth domain enums ────────────────────────────────
export const userStatus = pgEnum('UserStatus', USER_STATUS_VALUES);
export const membershipStatus = pgEnum('MembershipStatus', MEMBERSHIP_STATUS_VALUES);
export const roleStatus = pgEnum('RoleStatus', ROLE_STATUS_VALUES);

// ── Institute domain enums ─────────────────────────────
export const instituteStatus = pgEnum('InstituteStatus', INSTITUTE_STATUS_VALUES);
export const instituteType = pgEnum('InstituteType', INSTITUTE_TYPE_VALUES);
export const structureFramework = pgEnum('StructureFramework', STRUCTURE_FRAMEWORK_VALUES);
export const setupStatus = pgEnum('SetupStatus', SETUP_STATUS_VALUES);
export const identifierType = pgEnum('IdentifierType', INSTITUTE_IDENTIFIER_TYPE_VALUES);
export const boardType = pgEnum('BoardType', BOARD_TYPE_VALUES);
export const affiliationStatus = pgEnum('AffiliationStatus', AFFILIATION_STATUS_VALUES);
export const attendanceType = pgEnum('AttendanceType', ATTENDANCE_TYPE_VALUES);
export const attendanceStatus = pgEnum('AttendanceStatus', ATTENDANCE_STATUS_VALUES);
export type AttendanceStatus = (typeof attendanceStatus.enumValues)[number];
export const attendanceMode = pgEnum('AttendanceMode', ATTENDANCE_MODE_VALUES);
export type AttendanceMode = (typeof attendanceMode.enumValues)[number];

export const leaveType = pgEnum('LeaveType', LEAVE_TYPE_VALUES);
export type LeaveType = (typeof leaveType.enumValues)[number];
export const leaveStatus = pgEnum('LeaveStatus', LEAVE_STATUS_VALUES);
export type LeaveStatus = (typeof leaveStatus.enumValues)[number];
export const holidayType = pgEnum('HolidayType', HOLIDAY_TYPE_VALUES);
export type HolidayType = (typeof holidayType.enumValues)[number];
export const academicYearStatus = pgEnum('AcademicYearStatus', ACADEMIC_YEAR_STATUS_VALUES);

// ── Academic structure enums ───────────────────────────
export const educationLevel = pgEnum('EducationLevel', EDUCATION_LEVEL_VALUES);
export type EducationLevel = (typeof educationLevel.enumValues)[number];
export const nepStage = pgEnum('NepStage', NEP_STAGE_VALUES);
export const streamType = pgEnum('StreamType', STREAM_TYPE_VALUES);
export const genderRestriction = pgEnum('GenderRestriction', GENDER_RESTRICTION_VALUES);
export type GenderRestriction = (typeof genderRestriction.enumValues)[number];
export const batchStatus = pgEnum('BatchStatus', BATCH_STATUS_VALUES);
export const subjectType = pgEnum('SubjectType', SUBJECT_TYPE_VALUES);
export type SubjectType = (typeof subjectType.enumValues)[number];

export const groupType = pgEnum('GroupType', GROUP_TYPE_VALUES);

export const resellerTier = pgEnum('ResellerTier', RESELLER_TIER_VALUES);
export const resellerStatus = pgEnum('ResellerStatus', RESELLER_STATUS_VALUES);

export const groupStatus = pgEnum('GroupStatus', GROUP_STATUS_VALUES);

/** Dynamic group (Groups Engine) lifecycle state — distinct from institute-group GroupStatus. */
export const dynamicGroupStatus = pgEnum('DynamicGroupStatus', DYNAMIC_GROUP_STATUS_VALUES);

// ── User profile enums ─────────────────────────────────
/**
 * Guardian's highest completed education qualification.
 *
 * The value tuple lives in `@roviq/common-types` so `apps/api-gateway`
 * (which is NOT allowed to depend on `@roviq/database`) and this Drizzle
 * schema share one single source of truth.
 *
 * Distinct from the academic `educationLevel` pgEnum above, which groups
 * student classes (PRE_PRIMARY … SENIOR_SECONDARY).
 */
export const guardianEducationLevel = pgEnum(
  'GuardianEducationLevel',
  GUARDIAN_EDUCATION_LEVEL_VALUES,
);

/** Relationship of a guardian to the student. Values imported from @roviq/common-types. */
export const guardianRelationship = pgEnum('GuardianRelationship', GUARDIAN_RELATIONSHIP_VALUES);

// ── Student profile enums ──────────────────────────────
export const academicStatus = pgEnum('AcademicStatus', ACADEMIC_STATUS_VALUES);
export const admissionType = pgEnum('AdmissionType', ADMISSION_TYPE_VALUES);
export const socialCategory = pgEnum('SocialCategory', SOCIAL_CATEGORY_VALUES);
export const minorityType = pgEnum('MinorityType', MINORITY_TYPE_VALUES);
export const studentStream = pgEnum('StudentStream', STUDENT_STREAM_VALUES);

// ── Staff profile enums ───────────────────────────────
export const employmentType = pgEnum('EmploymentType', EMPLOYMENT_TYPE_VALUES);

// ── User profile enums ────────────────────────────────
export const gender = pgEnum('Gender', GENDER_VALUES);
export const addressType = pgEnum('AddressType', ADDRESS_TYPE_VALUES);
export const userIdentifierType = pgEnum('UserIdentifierType', USER_IDENTIFIER_TYPE_VALUES);

// ── Admission domain enums ────────────────────────────
export const admissionApplicationStatus = pgEnum(
  'AdmissionApplicationStatus',
  ADMISSION_APPLICATION_STATUS_VALUES,
);
export const enquiryStatus = pgEnum('EnquiryStatus', ENQUIRY_STATUS_VALUES);
export const enquirySource = pgEnum('EnquirySource', ENQUIRY_SOURCE_VALUES);
export const certificateStatus = pgEnum('CertificateStatus', CERTIFICATE_STATUS_VALUES);

// ── Groups domain enums ───────────────────────────────
export const groupMembershipType = pgEnum('GroupMembershipType', GROUP_MEMBERSHIP_TYPE_VALUES);
export const groupMemberSource = pgEnum('GroupMemberSource', GROUP_MEMBER_SOURCE_VALUES);
export const domainGroupType = pgEnum('DomainGroupType', DOMAIN_GROUP_TYPE_VALUES);

// ── Bot profile enums ─────────────────────────────────
export const botStatus = pgEnum('BotStatus', BOT_STATUS_VALUES);
export const botRateLimitTier = pgEnum('BotRateLimitTier', BOT_RATE_LIMIT_TIER_VALUES);

// ── TC register enums ─────────────────────────────────
export const tcStatus = pgEnum('TcStatus', TC_STATUS_VALUES);

// ── Certificate template enums ───────────────────────
export const certificateTemplateType = pgEnum(
  'CertificateTemplateType',
  CERTIFICATE_TEMPLATE_TYPE_VALUES,
);

// ── User document enums ──────────────────────────────
export const userDocumentType = pgEnum('UserDocumentType', USER_DOCUMENT_TYPE_VALUES);

// ── Student academic enums ───────────────────────────
export const promotionStatus = pgEnum('PromotionStatus', PROMOTION_STATUS_VALUES);

// ── Staff qualification enums ────────────────────────
export const qualificationType = pgEnum('QualificationType', QUALIFICATION_TYPE_VALUES);

// ── Bot type enums ───────────────────────────────────
export const botType = pgEnum('BotType', BOT_TYPE_VALUES);
