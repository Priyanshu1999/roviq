export interface AttendanceAbsentEvent {
  tenantId: string;
  studentId: string;
  studentName: string;
  sectionId: string;
  sectionName: string;
  date: string;
  markedBy: string;
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
  eventType:
    | 'LOGIN'
    | 'PASSWORD_RESET'
    | 'NEW_DEVICE'
    | 'ACCOUNT_LOCKED'
    | 'SESSION_REVOKED'
    | 'IMPERSONATION_OTP';
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
