import { z } from 'zod';
import type { EventPattern } from './event-patterns';

// ── Reusable field building blocks ────────────────────────────────────────────

const uuid = z.string().uuid();
const str = z.string();
// Permissive base: all tenant-scoped events carry at least tenantId.
const tenantBase = z.object({ tenantId: uuid });
// Institute-record events identify the institute by `id` (the InstituteRecord
// PK, which IS the tenantId from the consumer's perspective). Required
// `tenantId` mirrors `id` so consumer DLQs can route on tenantId uniformly,
// per the backend-service skill rule "always include tenantId in event
// payloads". Used by INSTITUTE.* events that spread the full institute
// record into the payload.
const instituteRecordBase = z.object({ id: uuid, tenantId: uuid });
// Institute-id-keyed base: lifecycle events that don't spread the record
// (status changes, branding/config updates, setup events). Same `tenantId`
// invariant as instituteRecordBase. The `instituteId` key is preserved
// because GraphQL subscriptions filter on it.
const instituteIdBase = z.object({ instituteId: uuid, tenantId: uuid });

// ── High-value domain schemas ─────────────────────────────────────────────────

const STUDENT_SCHEMAS = {
  'STUDENT.admitted': z.object({
    studentProfileId: uuid,
    membershipId: uuid,
    standardId: uuid,
    sectionId: uuid,
    tenantId: uuid,
  }),
  'STUDENT.enrolled': z.object({
    studentProfileId: uuid,
    academicYearId: uuid,
    sectionId: uuid,
    tenantId: uuid,
  }),
  'STUDENT.left': z.object({
    studentProfileId: uuid,
    reason: str,
    tcNumber: str.nullable(),
    tenantId: uuid,
  }),
  'STUDENT.promoted': z.object({
    studentProfileId: uuid,
    tenantId: uuid,
  }),
  'STUDENT.statusChanged': z.object({
    studentProfileId: uuid,
    fromStatus: str,
    toStatus: str,
    reason: str.nullable(),
    tenantId: uuid,
  }),
  'STUDENT.updated': tenantBase.passthrough(),
  'STUDENT.section_changed': z.object({
    studentProfileId: uuid,
    oldSectionId: uuid,
    newSectionId: uuid,
    tenantId: uuid,
  }),
} as const;

const INSTITUTE_SCHEMAS = {
  'INSTITUTE.activated': instituteIdBase.extend({
    resellerId: uuid.optional(),
    previousStatus: str,
    scope: str.optional(),
  }),
  'INSTITUTE.deactivated': instituteIdBase.extend({
    previousStatus: str,
    scope: str.optional(),
    reason: str.optional(),
  }),
  'INSTITUTE.suspended': instituteIdBase.extend({
    resellerId: uuid.nullable(),
    previousStatus: str,
    reason: str.optional(),
    scope: str,
  }),
  'INSTITUTE.rejected': instituteIdBase
    .extend({
      previousStatus: str,
      reason: str.optional(),
      scope: str.optional(),
    })
    .catchall(z.unknown()),
  'INSTITUTE.approved': instituteRecordBase
    .extend({
      resellerId: uuid.nullable(),
      scope: str,
    })
    .catchall(z.unknown()),
  'INSTITUTE.approval_requested': instituteRecordBase
    .extend({
      requestedBy: uuid,
    })
    .catchall(z.unknown()),
  'INSTITUTE.updated': instituteRecordBase
    .extend({
      changedFields: z.array(str),
    })
    .catchall(z.unknown()),
  'INSTITUTE.reseller_reassigned': instituteRecordBase
    .extend({
      previousResellerId: uuid.nullable(),
      newResellerId: uuid,
    })
    .catchall(z.unknown()),
  'INSTITUTE.group_assigned': instituteRecordBase
    .extend({
      previousGroupId: uuid.nullable().optional(),
      newGroupId: uuid,
    })
    .catchall(z.unknown()),
  'INSTITUTE.group_removed': instituteRecordBase
    .extend({ previousGroupId: uuid.nullable().optional() })
    .catchall(z.unknown()),
  'INSTITUTE.status_changed': instituteRecordBase
    .extend({ previousStatus: str, newStatus: str })
    .catchall(z.unknown()),
  'INSTITUTE.created': instituteRecordBase
    .extend({
      type: str.optional(),
    })
    .catchall(z.unknown()),
  'INSTITUTE.deleted': instituteIdBase,
  'INSTITUTE.restored': instituteIdBase,
  'INSTITUTE.branding_updated': instituteIdBase.extend({
    branding: z.unknown(),
  }),
  'INSTITUTE.config_updated': instituteIdBase.extend({
    changedFields: z.array(str),
  }),
  'INSTITUTE.setup_completed': instituteIdBase,
  'INSTITUTE.setup_progress': instituteIdBase.catchall(z.unknown()),
  'INSTITUTE.setup_retry_triggered': instituteIdBase.catchall(z.unknown()),
  'INSTITUTE.group.activated': tenantBase.passthrough(),
  'INSTITUTE.group.created': tenantBase.passthrough(),
  'INSTITUTE.group.deactivated': tenantBase.passthrough(),
  'INSTITUTE.group.deleted': tenantBase.passthrough(),
  'INSTITUTE.group.institute_added': tenantBase.passthrough(),
  'INSTITUTE.group.institute_removed': tenantBase.passthrough(),
  'INSTITUTE.group.member_added': tenantBase.passthrough(),
  'INSTITUTE.group.member_removed': tenantBase.passthrough(),
  'INSTITUTE.group.suspended': tenantBase.passthrough(),
  'INSTITUTE.group.updated': tenantBase.passthrough(),
} as const;

const LEAVE_SCHEMAS = {
  'LEAVE.applied': z.object({
    leaveId: uuid,
    tenantId: uuid,
    userId: uuid,
    startDate: str,
    endDate: str,
    type: str,
  }),
  'LEAVE.updated': z.object({
    leaveId: uuid,
    tenantId: uuid,
    userId: uuid,
  }),
  'LEAVE.approved': z.object({
    leaveId: uuid,
    tenantId: uuid,
    userId: uuid,
    approverMembershipId: uuid,
  }),
  'LEAVE.rejected': z.object({
    leaveId: uuid,
    tenantId: uuid,
    userId: uuid,
    approverMembershipId: uuid,
  }),
  'LEAVE.cancelled': z.object({
    leaveId: uuid,
    tenantId: uuid,
    userId: uuid,
  }),
  'LEAVE.deleted': z.object({
    leaveId: uuid,
    tenantId: uuid,
  }),
} as const;

const APPLICATION_SCHEMAS = {
  'APPLICATION.status_changed': z.object({
    applicationId: uuid,
    oldStatus: str,
    newStatus: str,
    tenantId: uuid,
  }),
} as const;

const ACADEMIC_YEAR_SCHEMAS = {
  'ACADEMIC_YEAR.activated': z.object({
    academicYearId: uuid,
    tenantId: uuid,
    previousYearId: uuid.nullable(),
  }),
  'ACADEMIC_YEAR.archived': z.object({
    academicYearId: uuid,
    tenantId: uuid,
  }),
  'ACADEMIC_YEAR.created': z.object({
    academicYearId: uuid,
    tenantId: uuid,
    label: str,
  }),
  'ACADEMIC_YEAR.updated': z.object({
    academicYearId: uuid,
    tenantId: uuid,
    label: str,
  }),
  'ACADEMIC_YEAR.deleted': z.object({
    academicYearId: uuid,
    tenantId: uuid,
  }),
} as const;

const BILLING_SCHEMAS = {
  'BILLING.subscription.created': z.object({
    subscriptionId: uuid,
    tenantId: uuid.optional(),
    resellerId: uuid.optional(),
  }),
  'BILLING.subscription.activated': z.object({
    subscriptionId: uuid,
    tenantId: uuid.optional(),
    resellerId: uuid.optional(),
  }),
  'BILLING.subscription.paused': z.object({
    subscriptionId: uuid,
    tenantId: uuid.optional(),
    resellerId: uuid.optional(),
  }),
  'BILLING.subscription.resumed': z.object({
    subscriptionId: uuid,
    tenantId: uuid.optional(),
    resellerId: uuid.optional(),
  }),
  'BILLING.subscription.cancelled': z.object({
    subscriptionId: uuid,
    tenantId: uuid.optional(),
    resellerId: uuid.optional(),
  }),
  'BILLING.subscription.expired': z.object({
    subscriptionId: uuid,
    tenantId: uuid.optional(),
    resellerId: uuid.optional(),
  }),
  'BILLING.subscription.plan_changed': z.object({
    subscriptionId: uuid,
    oldPlanId: uuid,
    newPlanId: uuid,
    prorationDelta: z.unknown().optional(),
  }),
  'BILLING.subscription.status_changed': z
    .object({
      subscriptionId: uuid.optional(),
    })
    .passthrough(),
  'BILLING.payment.succeeded': z
    .object({
      paymentId: uuid,
      invoiceId: uuid,
    })
    .passthrough(),
  'BILLING.payment.refunded': z
    .object({
      paymentId: uuid,
    })
    .passthrough(),
  'BILLING.payment.status_changed': z
    .object({
      paymentId: uuid.optional(),
    })
    .passthrough(),
  'BILLING.payment.upi_p2p_submitted': z
    .object({
      paymentId: uuid.optional(),
    })
    .passthrough(),
  'BILLING.payment.upi_p2p_rejected': z
    .object({
      paymentId: uuid.optional(),
    })
    .passthrough(),
  'BILLING.invoice.generated': z
    .object({
      invoiceId: uuid.optional(),
    })
    .passthrough(),
  'BILLING.invoice.paid': z
    .object({
      invoiceId: uuid.optional(),
    })
    .passthrough(),
  'BILLING.plan.created': z.object({
    id: uuid,
    name: z.unknown(),
  }),
  'BILLING.plan.updated': z.object({ id: uuid }),
  'BILLING.plan.archived': z.object({ id: uuid }),
  'BILLING.plan.restored': z.object({ id: uuid }),
  'BILLING.plan.deleted': z.object({ id: uuid }),
  'BILLING.webhook.cashfree': z.object({}).passthrough(),
  'BILLING.webhook.razorpay': z.object({}).passthrough(),
} as const;

const AUDIT_SCHEMAS = {
  'AUDIT.log': z
    .object({
      id: uuid.optional(),
      scope: z.enum(['platform', 'reseller', 'institute']),
      tenantId: uuid.nullable(),
      resellerId: uuid.nullable().optional(),
      userId: uuid,
      actorId: uuid,
      action: str,
      actionType: str,
      entityType: str,
      entityId: uuid.nullable().optional(),
      correlationId: str,
      source: str,
    })
    .passthrough(),
} as const;

const NOTIFICATION_SCHEMAS = {
  'NOTIFICATION.leave.decided': z.object({
    leaveId: uuid,
    tenantId: uuid,
    userId: uuid,
    status: str,
  }),
  'NOTIFICATION.approval.requested': tenantBase.passthrough(),
  'NOTIFICATION.approval.resolved': tenantBase.passthrough(),
  'NOTIFICATION.attendance.absent': tenantBase.passthrough(),
  'NOTIFICATION.auth.security': z.object({}).passthrough(),
  'NOTIFICATION.fee.overdue': tenantBase.passthrough(),
  'NOTIFICATION.fee.reminder': tenantBase.passthrough(),
  'NOTIFICATION.user.created': z.object({}).passthrough(),
  'NOTIFICATION.user.updated': z.object({}).passthrough(),
} as const;

// ── Permissive baseline schemas for remaining domains ─────────────────────────

const BOT_SCHEMAS = {
  'BOT.api_key_rotated': tenantBase.passthrough(),
  'BOT.created': tenantBase.passthrough(),
  'BOT.deleted': tenantBase.passthrough(),
  'BOT.updated': tenantBase.passthrough(),
} as const;

const ATTENDANCE_SESSION_SCHEMAS = {
  'ATTENDANCE_SESSION.bulk_marked': tenantBase.passthrough(),
  'ATTENDANCE_SESSION.deleted': tenantBase.passthrough(),
  'ATTENDANCE_SESSION.opened': tenantBase.passthrough(),
  'ATTENDANCE_SESSION.overridden': tenantBase.passthrough(),
  'ATTENDANCE_SESSION.past_day_bulk_edited': tenantBase.passthrough(),
} as const;

const ATTENDANCE_ENTRY_SCHEMAS = {
  'ATTENDANCE_ENTRY.marked': tenantBase.passthrough(),
  'ATTENDANCE_ENTRY.past_day_edited': tenantBase.passthrough(),
} as const;

const CONSENT_SCHEMAS = {
  'CONSENT.given': tenantBase.passthrough(),
  'CONSENT.withdrawn': tenantBase.passthrough(),
} as const;

const CERTIFICATE_SCHEMAS = {
  'CERTIFICATE.generated': tenantBase.passthrough(),
} as const;

const TC_SCHEMAS = {
  'TC.issued': tenantBase.passthrough(),
} as const;

const EXPORT_SCHEMAS = {
  'EXPORT.completed': tenantBase.passthrough(),
} as const;

const USER_SCHEMAS = {
  'USER.admission_created': z.object({}).passthrough(),
} as const;

const GUARDIAN_SCHEMAS = {
  'GUARDIAN.linked': tenantBase.passthrough(),
} as const;

const STAFF_SCHEMAS = {
  'STAFF.joined': tenantBase.passthrough(),
  'STAFF.left': tenantBase.passthrough(),
} as const;

const STANDARD_SCHEMAS = {
  'STANDARD.created': tenantBase.passthrough(),
  'STANDARD.deleted': tenantBase.passthrough(),
  'STANDARD.updated': tenantBase.passthrough(),
} as const;

const SECTION_SCHEMAS = {
  'SECTION.capacity_warning': z.object({
    sectionId: uuid,
    currentStrength: z.number(),
    optimal: z.number(),
    tenantId: uuid,
  }),
  'SECTION.created': z.object({
    sectionId: uuid,
    tenantId: uuid,
    standardId: uuid,
  }),
  'SECTION.deleted': z.object({
    sectionId: uuid,
    tenantId: uuid,
  }),
  'SECTION.teacher_assigned': z.object({
    sectionId: uuid,
    tenantId: uuid,
    classTeacherId: uuid,
  }),
  'SECTION.updated': z.object({
    sectionId: uuid,
    tenantId: uuid,
  }),
} as const;

const SUBJECT_SCHEMAS = {
  'SUBJECT.assigned_to_section': z.object({
    subjectId: uuid,
    sectionId: uuid,
    tenantId: uuid,
  }),
  'SUBJECT.assigned_to_standard': z.object({
    subjectId: uuid,
    standardId: uuid,
    tenantId: uuid,
  }),
  'SUBJECT.created': z.object({
    subjectId: uuid,
    tenantId: uuid,
    name: z.unknown(),
  }),
  'SUBJECT.deleted': z.object({
    subjectId: uuid,
    tenantId: uuid,
  }),
  'SUBJECT.removed_from_section': z.object({
    subjectId: uuid,
    sectionId: uuid,
    tenantId: uuid,
  }),
  'SUBJECT.removed_from_standard': z.object({
    subjectId: uuid,
    standardId: uuid,
    tenantId: uuid,
  }),
  'SUBJECT.updated': z.object({
    subjectId: uuid,
    tenantId: uuid,
    name: z.unknown(),
  }),
} as const;

const GROUP_SCHEMAS = {
  'GROUP.membership_resolved': z.object({
    groupId: uuid,
    memberCount: z.number(),
    resolvedAt: z.unknown(),
    tenantId: uuid,
  }),
  'GROUP.rules_updated': z.object({
    groupId: uuid,
    tenantId: uuid,
  }),
} as const;

const HOLIDAY_SCHEMAS = {
  'HOLIDAY.created': z.object({
    holidayId: uuid,
    tenantId: uuid,
    type: str,
    startDate: str,
    endDate: str,
  }),
  'HOLIDAY.deleted': z.object({
    holidayId: uuid,
    tenantId: uuid,
  }),
  'HOLIDAY.updated': z.object({
    holidayId: uuid,
    tenantId: uuid,
  }),
} as const;

const ENQUIRY_SCHEMAS = {
  'ENQUIRY.created': tenantBase.passthrough(),
} as const;

const RESELLER_SCHEMAS = {
  'RESELLER.created': z.object({ scope: str }).passthrough(),
  'RESELLER.status_changed': z.object({ scope: str.optional() }).passthrough(),
  'RESELLER.tier_changed': z.object({}).passthrough(),
  'RESELLER.updated': z.object({ scope: str }).passthrough(),
} as const;

// ── Flat map: EventPattern → ZodTypeAny ──────────────────────────────────────
//
// TypeScript can't index a nested const object with a dot-path string, so we
// build a flat Record at declaration time. Any key missing here will surface
// as an `undefined` lookup in the coverage test — the intent is every leaf
// in EVENT_PATTERNS maps to an entry below.

// Inner const preserves the literal-keyed type so `EventPayload<P>` can
// resolve to a specific schema. Do NOT widen this with
// `Record<string, z.ZodTypeAny>` — that throws away the literal-key →
// specific-schema mapping and EventPayload<P> collapses to `any` for every P.
const _flatEventSchemas = {
  ...STUDENT_SCHEMAS,
  ...INSTITUTE_SCHEMAS,
  ...LEAVE_SCHEMAS,
  ...APPLICATION_SCHEMAS,
  ...ACADEMIC_YEAR_SCHEMAS,
  ...BILLING_SCHEMAS,
  ...AUDIT_SCHEMAS,
  ...NOTIFICATION_SCHEMAS,
  ...BOT_SCHEMAS,
  ...ATTENDANCE_SESSION_SCHEMAS,
  ...ATTENDANCE_ENTRY_SCHEMAS,
  ...CONSENT_SCHEMAS,
  ...CERTIFICATE_SCHEMAS,
  ...TC_SCHEMAS,
  ...EXPORT_SCHEMAS,
  ...USER_SCHEMAS,
  ...GUARDIAN_SCHEMAS,
  ...STAFF_SCHEMAS,
  ...STANDARD_SCHEMAS,
  ...SECTION_SCHEMAS,
  ...SUBJECT_SCHEMAS,
  ...GROUP_SCHEMAS,
  ...HOLIDAY_SCHEMAS,
  ...ENQUIRY_SCHEMAS,
  ...RESELLER_SCHEMAS,
};

type FlatEventSchemas = typeof _flatEventSchemas;

// Runtime export — string-indexable for the validation helper. Type widened
// for the runtime path; the typed lookup uses `FlatEventSchemas` below.
export const flatEventSchemas: Record<string, z.ZodTypeAny> = _flatEventSchemas;

/**
 * @internal — exported only for the coverage / duplicate-key tests in
 * `event-schemas.spec.ts`. Do not import from production code.
 *
 * The order matches the spread in `_flatEventSchemas`. The test asserts
 * that the total leaf count of these maps equals `Object.keys(flatEventSchemas).length`,
 * which catches accidental key collisions where a later spread silently
 * overwrites an earlier one.
 */
export const _DOMAIN_SCHEMA_MAPS = [
  STUDENT_SCHEMAS,
  INSTITUTE_SCHEMAS,
  LEAVE_SCHEMAS,
  APPLICATION_SCHEMAS,
  ACADEMIC_YEAR_SCHEMAS,
  BILLING_SCHEMAS,
  AUDIT_SCHEMAS,
  NOTIFICATION_SCHEMAS,
  BOT_SCHEMAS,
  ATTENDANCE_SESSION_SCHEMAS,
  ATTENDANCE_ENTRY_SCHEMAS,
  CONSENT_SCHEMAS,
  CERTIFICATE_SCHEMAS,
  TC_SCHEMAS,
  EXPORT_SCHEMAS,
  USER_SCHEMAS,
  GUARDIAN_SCHEMAS,
  STAFF_SCHEMAS,
  STANDARD_SCHEMAS,
  SECTION_SCHEMAS,
  SUBJECT_SCHEMAS,
  GROUP_SCHEMAS,
  HOLIDAY_SCHEMAS,
  ENQUIRY_SCHEMAS,
  RESELLER_SCHEMAS,
] as const;

// ── Typed payload lookup ──────────────────────────────────────────────────────

// Maps each EventPattern string literal to the inferred TypeScript type of its
// schema. Falls back to Record<string, unknown> for patterns not covered by a
// strict schema (i.e. those using `.passthrough()`).
export type EventPayload<P extends EventPattern> = P extends keyof FlatEventSchemas
  ? z.infer<FlatEventSchemas[P]>
  : Record<string, unknown>;
