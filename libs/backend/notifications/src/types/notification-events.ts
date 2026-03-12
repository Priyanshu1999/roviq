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

export interface AuthSecurityEvent {
  tenantId: string | null;
  userId: string;
  eventType: 'LOGIN' | 'PASSWORD_RESET' | 'NEW_DEVICE' | 'ACCOUNT_LOCKED' | 'SESSION_REVOKED';
  metadata: Record<string, unknown>;
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
