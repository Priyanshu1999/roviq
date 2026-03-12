/**
 * NATS subjects for the NOTIFICATION stream.
 * Stream already defined in @roviq/nats-utils streams.ts as NOTIFICATION with subjects ['NOTIFICATION.>'].
 */
export const NOTIFICATION_SUBJECTS = {
  ATTENDANCE_ABSENT: 'NOTIFICATION.attendance.absent',
  FEE_OVERDUE: 'NOTIFICATION.fee.overdue',
  FEE_REMINDER: 'NOTIFICATION.fee.reminder',
  APPROVAL_REQUESTED: 'NOTIFICATION.approval.requested',
  APPROVAL_RESOLVED: 'NOTIFICATION.approval.resolved',
  AUTH_SECURITY: 'NOTIFICATION.auth.security',
  USER_CREATED: 'NOTIFICATION.user.created',
  USER_UPDATED: 'NOTIFICATION.user.updated',
} as const;

export type NotificationSubject =
  (typeof NOTIFICATION_SUBJECTS)[keyof typeof NOTIFICATION_SUBJECTS];
