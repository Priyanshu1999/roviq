import type { AuthSecurityEventType } from '@roviq/common-types';

/**
 * Emitted by AttendanceService when an entry lands in ABSENT or LATE state.
 *
 * Includes denormalised display fields (student name, section/standard) so the
 * Novu template at the notification-service listener doesn't have to issue a
 * follow-up SQL hop per event (AT-003). The producer already has them on hand
 * because section + student are joined when seeding/marking.
 *
 * Display fields are optional so older producers / migration paths still
 * deliver — the listener falls back to the membership id when missing.
 */
export interface AttendanceAbsentEvent {
  tenantId: string;
  sessionId: string;
  /** Student membership id (attendance_entries.student_id). */
  studentId: string;
  status: 'ABSENT' | 'LATE';
  remarks: string | null;
  /** ISO timestamp when the entry was marked / last updated. */
  markedAt: string;
  /** Resolved at emit time — present whenever the producer can look it up. */
  studentName?: string | null;
  sectionName?: string | null;
  standardName?: string | null;
  /** YYYY-MM-DD of the attendance session — useful for guardian-facing copy. */
  sessionDate?: string | null;
}

export interface FeeOverdueEvent {
  tenantId: string;
  studentId: string;
  studentName: string;
  feeId: string;
  amount: number;
  currency: string;
  dueDate: string;
  daysOverdue: number;
  feeType: string;
}

export interface FeeReminderEvent {
  tenantId: string;
  studentId: string;
  studentName: string;
  feeId: string;
  amount: number;
  currency: string;
  dueDate: string;
  feeType: string;
  feePeriod: string;
}

export interface ApprovalRequestedEvent {
  tenantId: string;
  requesterId: string;
  requesterName: string;
  approverId: string;
  approverName: string;
  approvalType: 'LEAVE' | 'FEE_WAIVER' | 'ENROLLMENT';
  entityId: string;
  summary: string;
}

export interface ApprovalResolvedEvent {
  tenantId: string;
  requesterId: string;
  requesterName: string;
  reviewerId: string;
  reviewerName: string;
  approvalType: string;
  status: 'APPROVED' | 'REJECTED';
  remarks?: string;
}

export interface AuthSecurityEventMetadata {
  /** OTP code (6-digit, zero-padded) for IMPERSONATION_OTP events */
  otp?: string;
  /** Recipient phone (with country code) for IMPERSONATION_OTP events */
  recipientPhone?: string;
  /** Purpose tag for OTP delivery (e.g. 'impersonation_consent') */
  purpose?: string;
  [key: string]: unknown;
}

export interface AuthSecurityEvent {
  tenantId: string | null;
  userId: string;
  eventType: AuthSecurityEventType;
  metadata: AuthSecurityEventMetadata;
}

/**
 * Emitted by IdentityService after a new user is created.
 * Consumed by notification-service to deliver a welcome message containing the
 * temporary password via email and SMS (when a phone is on file).
 */
export interface UserCreatedEvent {
  userId: string;
  /** The scope under which the user was created */
  scope: 'platform' | 'reseller' | 'institute';
  tenantId: string | null;
  resellerId: string | null;
  username: string;
  email: string;
  /** Primary phone with country-code prefix (e.g. '+918888888888'), null if none provided */
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Plaintext temporary password — for Novu delivery only, never persisted after this event */
  tempPassword: string;
}

export interface UserSyncEvent {
  userId: string;
  tenantId: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  username: string;
}

export interface BillingNotificationEvent {
  subscriptionId: string;
  instituteId: string;
  instituteName: string;
  planName: string;
  planAmount: number;
  planCurrency: string;
  ownerUserId: string | null;
  platformAdminUserId: string | null;
}

export interface BillingWebhookNotificationEvent extends BillingNotificationEvent {
  eventType: string;
  providerEventId: string;
  provider: string;
}

/**
 * Emitted by the institute LeaveService when a leave application is approved
 * or rejected. Consumed by notification-service to ping the applicant and
 * (transitively) linked guardians via the `leave-decided` Novu workflow.
 */
export interface LeaveDecidedEvent {
  tenantId: string;
  leaveId: string;
  /** Membership id of the applicant (student or staff). */
  userId: string;
  status: 'APPROVED' | 'REJECTED';
}
