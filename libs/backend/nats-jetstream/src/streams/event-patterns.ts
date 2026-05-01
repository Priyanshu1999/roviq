// Single source of truth for every NATS subject the application emits or
// subscribes to. Top-level keys mirror STREAMS — the coverage check
// (`stream.config.spec.ts`) walks both and asserts they line up.
//
// The `EventPattern` union type is the only thing `EventBusService.emit`
// accepts, so a typo produces a compile error instead of a silent
// "no stream matches subject" at runtime.
//
// `NOTIFICATION` subjects live here (rather than in `@roviq/notifications`
// where they used to) so the registry has zero cross-lib dependencies;
// `@roviq/notifications` re-exports `NOTIFICATION_SUBJECTS` from here for
// backwards compatibility with notification-service listeners.

const NOTIFICATION = {
  APPROVAL_REQUESTED: 'NOTIFICATION.approval.requested',
  APPROVAL_RESOLVED: 'NOTIFICATION.approval.resolved',
  ATTENDANCE_ABSENT: 'NOTIFICATION.attendance.absent',
  AUTH_SECURITY: 'NOTIFICATION.auth.security',
  FEE_OVERDUE: 'NOTIFICATION.fee.overdue',
  FEE_REMINDER: 'NOTIFICATION.fee.reminder',
  LEAVE_DECIDED: 'NOTIFICATION.leave.decided',
  USER_CREATED: 'NOTIFICATION.user.created',
  USER_UPDATED: 'NOTIFICATION.user.updated',
} as const;

export const EVENT_PATTERNS = {
  ACADEMIC_YEAR: {
    activated: 'ACADEMIC_YEAR.activated',
    archived: 'ACADEMIC_YEAR.archived',
    created: 'ACADEMIC_YEAR.created',
    deleted: 'ACADEMIC_YEAR.deleted',
    updated: 'ACADEMIC_YEAR.updated',
  },
  APPLICATION: {
    status_changed: 'APPLICATION.status_changed',
  },
  ATTENDANCE_ENTRY: {
    marked: 'ATTENDANCE_ENTRY.marked',
    past_day_edited: 'ATTENDANCE_ENTRY.past_day_edited',
  },
  ATTENDANCE_SESSION: {
    bulk_marked: 'ATTENDANCE_SESSION.bulk_marked',
    deleted: 'ATTENDANCE_SESSION.deleted',
    opened: 'ATTENDANCE_SESSION.opened',
    overridden: 'ATTENDANCE_SESSION.overridden',
    past_day_bulk_edited: 'ATTENDANCE_SESSION.past_day_bulk_edited',
  },
  AUDIT: {
    log: 'AUDIT.log',
  },
  BILLING: {
    invoice: {
      generated: 'BILLING.invoice.generated',
      paid: 'BILLING.invoice.paid',
    },
    payment: {
      refunded: 'BILLING.payment.refunded',
      // Aggregate subject for the GraphQL `myPaymentStatusChanged` /
      // `resellerPaymentReceived` subscription. Currently subscribed by
      // EE billing-subscriptions.resolver but not emitted anywhere — the
      // service-layer fix is tracked separately; allow-listed in the
      // orphan-symmetry test until the emit is added.
      status_changed: 'BILLING.payment.status_changed',
      succeeded: 'BILLING.payment.succeeded',
      upi_p2p_rejected: 'BILLING.payment.upi_p2p_rejected',
      upi_p2p_submitted: 'BILLING.payment.upi_p2p_submitted',
    },
    plan: {
      archived: 'BILLING.plan.archived',
      created: 'BILLING.plan.created',
      deleted: 'BILLING.plan.deleted',
      restored: 'BILLING.plan.restored',
      updated: 'BILLING.plan.updated',
    },
    subscription: {
      activated: 'BILLING.subscription.activated',
      cancelled: 'BILLING.subscription.cancelled',
      created: 'BILLING.subscription.created',
      expired: 'BILLING.subscription.expired',
      paused: 'BILLING.subscription.paused',
      plan_changed: 'BILLING.subscription.plan_changed',
      resumed: 'BILLING.subscription.resumed',
      // Aggregate subject for the `mySubscriptionStatusChanged` /
      // `resellerSubscriptionChanged` GraphQL subscriptions. Same orphan
      // status as `payment.status_changed` above.
      status_changed: 'BILLING.subscription.status_changed',
    },
  },
  BOT: {
    api_key_rotated: 'BOT.api_key_rotated',
    created: 'BOT.created',
    deleted: 'BOT.deleted',
    updated: 'BOT.updated',
  },
  CERTIFICATE: {
    generated: 'CERTIFICATE.generated',
  },
  CONSENT: {
    given: 'CONSENT.given',
    withdrawn: 'CONSENT.withdrawn',
  },
  ENQUIRY: {
    created: 'ENQUIRY.created',
  },
  EXPORT: {
    completed: 'EXPORT.completed',
  },
  GROUP: {
    membership_resolved: 'GROUP.membership_resolved',
    rules_updated: 'GROUP.rules_updated',
  },
  GUARDIAN: {
    linked: 'GUARDIAN.linked',
  },
  HOLIDAY: {
    created: 'HOLIDAY.created',
    deleted: 'HOLIDAY.deleted',
    updated: 'HOLIDAY.updated',
  },
  INSTITUTE: {
    activated: 'INSTITUTE.activated',
    approval_requested: 'INSTITUTE.approval_requested',
    approved: 'INSTITUTE.approved',
    branding_updated: 'INSTITUTE.branding_updated',
    config_updated: 'INSTITUTE.config_updated',
    created: 'INSTITUTE.created',
    deactivated: 'INSTITUTE.deactivated',
    deleted: 'INSTITUTE.deleted',
    group_assigned: 'INSTITUTE.group_assigned',
    group_removed: 'INSTITUTE.group_removed',
    rejected: 'INSTITUTE.rejected',
    reseller_reassigned: 'INSTITUTE.reseller_reassigned',
    restored: 'INSTITUTE.restored',
    setup_completed: 'INSTITUTE.setup_completed',
    setup_progress: 'INSTITUTE.setup_progress',
    setup_retry_triggered: 'INSTITUTE.setup_retry_triggered',
    status_changed: 'INSTITUTE.status_changed',
    suspended: 'INSTITUTE.suspended',
    updated: 'INSTITUTE.updated',
    group: {
      activated: 'INSTITUTE.group.activated',
      created: 'INSTITUTE.group.created',
      deactivated: 'INSTITUTE.group.deactivated',
      deleted: 'INSTITUTE.group.deleted',
      institute_added: 'INSTITUTE.group.institute_added',
      institute_removed: 'INSTITUTE.group.institute_removed',
      member_added: 'INSTITUTE.group.member_added',
      member_removed: 'INSTITUTE.group.member_removed',
      suspended: 'INSTITUTE.group.suspended',
      updated: 'INSTITUTE.group.updated',
    },
  },
  LEAVE: {
    applied: 'LEAVE.applied',
    approved: 'LEAVE.approved',
    cancelled: 'LEAVE.cancelled',
    deleted: 'LEAVE.deleted',
    rejected: 'LEAVE.rejected',
    updated: 'LEAVE.updated',
  },
  NOTIFICATION,
  RESELLER: {
    created: 'RESELLER.created',
    status_changed: 'RESELLER.status_changed',
    tier_changed: 'RESELLER.tier_changed',
    updated: 'RESELLER.updated',
  },
  SECTION: {
    capacity_warning: 'SECTION.capacity_warning',
    created: 'SECTION.created',
    deleted: 'SECTION.deleted',
    teacher_assigned: 'SECTION.teacher_assigned',
    updated: 'SECTION.updated',
  },
  STAFF: {
    joined: 'STAFF.joined',
    left: 'STAFF.left',
  },
  STANDARD: {
    created: 'STANDARD.created',
    deleted: 'STANDARD.deleted',
    updated: 'STANDARD.updated',
  },
  STUDENT: {
    admitted: 'STUDENT.admitted',
    enrolled: 'STUDENT.enrolled',
    left: 'STUDENT.left',
    // Subscribed by group-invalidation.handler; emitter lives in a future
    // year-end promotion flow. Kept registered so the symmetry check
    // accepts the subscriber.
    promoted: 'STUDENT.promoted',
    section_changed: 'STUDENT.section_changed',
    // Historical camelCase key — kept for wire compatibility with already-
    // deployed subscribers. New subjects under STUDENT use snake_case.
    statusChanged: 'STUDENT.statusChanged',
    updated: 'STUDENT.updated',
  },
  SUBJECT: {
    assigned_to_section: 'SUBJECT.assigned_to_section',
    assigned_to_standard: 'SUBJECT.assigned_to_standard',
    created: 'SUBJECT.created',
    deleted: 'SUBJECT.deleted',
    removed_from_section: 'SUBJECT.removed_from_section',
    removed_from_standard: 'SUBJECT.removed_from_standard',
    updated: 'SUBJECT.updated',
  },
  TC: {
    issued: 'TC.issued',
  },
  USER: {
    admission_created: 'USER.admission_created',
  },
} as const;

type LeafValues<T> = T extends string
  ? T
  : T extends Record<string, unknown>
    ? { [K in keyof T]: LeafValues<T[K]> }[keyof T]
    : never;

export type EventPattern = LeafValues<typeof EVENT_PATTERNS>;

// Flat list of every subject — useful for coverage tests so they don't
// have to reimplement the recursive walk.
export function flattenEventPatterns(node: unknown = EVENT_PATTERNS, out: string[] = []): string[] {
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) {
      flattenEventPatterns(value, out);
    }
  }
  return out;
}
