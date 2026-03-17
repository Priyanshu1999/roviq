import { pgEnum } from 'drizzle-orm/pg-core';

export const billingInterval = pgEnum('BillingInterval', ['MONTHLY', 'QUARTERLY', 'YEARLY']);

export const subscriptionStatus = pgEnum('SubscriptionStatus', [
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'PENDING_PAYMENT',
  'PAUSED',
  'COMPLETED',
]);

export const invoiceStatus = pgEnum('InvoiceStatus', [
  'PAID',
  'PENDING',
  'OVERDUE',
  'FAILED',
  'REFUNDED',
]);

// Domain-specific status enums — each entity owns its lifecycle
export const userStatus = pgEnum('UserStatus', ['ACTIVE', 'SUSPENDED', 'LOCKED']);
export const instituteStatus = pgEnum('InstituteStatus', [
  'PENDING',
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'REJECTED',
]);
export const membershipStatus = pgEnum('MembershipStatus', ['ACTIVE', 'SUSPENDED', 'REVOKED']);
export const roleStatus = pgEnum('RoleStatus', ['ACTIVE', 'INACTIVE']);
export const planStatus = pgEnum('PlanStatus', ['ACTIVE', 'INACTIVE', 'ARCHIVED']);
export const gatewayConfigStatus = pgEnum('GatewayConfigStatus', ['ACTIVE', 'INACTIVE']);

export const paymentProvider = pgEnum('PaymentProvider', ['CASHFREE', 'RAZORPAY']);

// ── Institute domain enums ─────────────────────────────
export const instituteType = pgEnum('InstituteType', ['SCHOOL', 'COACHING', 'LIBRARY']);

export const structureFramework = pgEnum('StructureFramework', ['NEP', 'TRADITIONAL']);

export const setupStatus = pgEnum('SetupStatus', ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']);

export const identifierType = pgEnum('IdentifierType', [
  'UDISE_PLUS',
  'CBSE_AFFILIATION',
  'CBSE_SCHOOL_CODE',
  'BSEH_AFFILIATION',
  'RBSE_REGISTRATION',
  'SOCIETY_REGISTRATION',
  'STATE_RECOGNITION',
  'SHALA_DARPAN_ID',
]);

export const boardType = pgEnum('BoardType', ['CBSE', 'BSEH', 'RBSE', 'ICSE']);

export const affiliationStatus = pgEnum('AffiliationStatus', [
  'PROVISIONAL',
  'REGULAR',
  'EXTENSION_PENDING',
  'REVOKED',
]);

export const attendanceType = pgEnum('AttendanceType', ['LECTURE_WISE', 'DAILY']);

// ── Academic structure enums ───────────────────────────
export const educationLevel = pgEnum('EducationLevel', [
  'PRE_PRIMARY',
  'PRIMARY',
  'UPPER_PRIMARY',
  'SECONDARY',
  'SENIOR_SECONDARY',
]);

export const nepStage = pgEnum('NepStage', ['FOUNDATIONAL', 'PREPARATORY', 'MIDDLE', 'SECONDARY']);

export const streamType = pgEnum('StreamType', ['SCIENCE', 'COMMERCE', 'ARTS']);

export const genderRestriction = pgEnum('GenderRestriction', ['CO_ED', 'BOYS_ONLY', 'GIRLS_ONLY']);

export const batchStatus = pgEnum('BatchStatus', ['UPCOMING', 'ACTIVE', 'COMPLETED']);

export const groupType = pgEnum('GroupType', ['TRUST', 'SOCIETY', 'CHAIN', 'FRANCHISE']);

export const groupStatus = pgEnum('GroupStatus', ['ACTIVE', 'INACTIVE', 'SUSPENDED']);

export const subjectType = pgEnum('SubjectType', [
  'ACADEMIC',
  'LANGUAGE',
  'SKILL',
  'EXTRACURRICULAR',
  'INTERNAL_ASSESSMENT',
]);
