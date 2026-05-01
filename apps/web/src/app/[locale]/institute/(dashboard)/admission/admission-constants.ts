/**
 * ROV-168 — Shared display constants for the admission module.
 *
 * Co-locates status/source enumerations and their color/icon mappings so
 * every page (enquiries, applications, statistics) reads from a single
 * source of truth. Pair colour with an icon/shape per [RVSBJ] (never rely
 * on colour alone for meaning).
 */
import {
  AlertCircle,
  Award,
  Ban,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ClipboardEdit,
  ClipboardList,
  Clock,
  CreditCard,
  FileCheck2,
  FileClock,
  Flag,
  Gavel,
  GraduationCap,
  type LucideIcon,
  Mail,
  MessageSquare,
  Phone,
  Send,
  ThumbsDown,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

// ─── Enquiry ──────────────────────────────────────────────────────────────

export const ENQUIRY_STATUS_VALUES = [
  'NEW',
  'CONTACTED',
  'CAMPUS_VISIT_SCHEDULED',
  'CAMPUS_VISITED',
  'APPLICATION_ISSUED',
  'APPLICATION_SUBMITTED',
  'TEST_SCHEDULED',
  'OFFER_MADE',
  'FEE_PAID',
  'ENROLLED',
  'LOST',
  'DROPPED',
] as const;
export type EnquiryStatusKey = (typeof ENQUIRY_STATUS_VALUES)[number];

export const ENQUIRY_SOURCE_VALUES = [
  'WALK_IN',
  'PHONE',
  'WEBSITE',
  'SOCIAL_MEDIA',
  'REFERRAL',
  'NEWSPAPER_AD',
  'HOARDING',
  'SCHOOL_EVENT',
  'ALUMNI',
  'GOOGLE',
  'WHATSAPP',
  'OTHER',
] as const;
export type EnquirySourceKey = (typeof ENQUIRY_SOURCE_VALUES)[number];

/** Kanban board columns — ordered to mirror the typical funnel progression. */
export const ENQUIRY_KANBAN_COLUMNS: readonly EnquiryStatusKey[] = [
  'NEW',
  'CONTACTED',
  'CAMPUS_VISIT_SCHEDULED',
  'CAMPUS_VISITED',
  'APPLICATION_ISSUED',
  'APPLICATION_SUBMITTED',
  'OFFER_MADE',
  'ENROLLED',
  'LOST',
  'DROPPED',
];

export const ENQUIRY_STATUS_CLASS: Record<EnquiryStatusKey, string> = {
  NEW: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  CONTACTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  CAMPUS_VISIT_SCHEDULED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  CAMPUS_VISITED: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  APPLICATION_ISSUED: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  APPLICATION_SUBMITTED: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  TEST_SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  OFFER_MADE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  FEE_PAID: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  ENROLLED: 'bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100',
  LOST: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
  DROPPED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export const ENQUIRY_STATUS_ICON: Record<EnquiryStatusKey, LucideIcon> = {
  NEW: Flag,
  CONTACTED: MessageSquare,
  CAMPUS_VISIT_SCHEDULED: Calendar,
  CAMPUS_VISITED: UserCheck,
  APPLICATION_ISSUED: Send,
  APPLICATION_SUBMITTED: ClipboardCheck,
  TEST_SCHEDULED: Clock,
  OFFER_MADE: Mail,
  FEE_PAID: CreditCard,
  ENROLLED: GraduationCap,
  LOST: ThumbsDown,
  DROPPED: Ban,
};

export const ENQUIRY_SOURCE_ICON: Record<EnquirySourceKey, LucideIcon> = {
  WALK_IN: Users,
  PHONE: Phone,
  WEBSITE: Send,
  SOCIAL_MEDIA: MessageSquare,
  REFERRAL: UserCheck,
  NEWSPAPER_AD: FileCheck2,
  HOARDING: Flag,
  SCHOOL_EVENT: Award,
  ALUMNI: Trophy,
  GOOGLE: Send,
  WHATSAPP: MessageSquare,
  OTHER: AlertCircle,
};

// ─── Application ──────────────────────────────────────────────────────────

export const APPLICATION_STATUS_VALUES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'DOCUMENTS_PENDING',
  'DOCUMENTS_VERIFIED',
  'TEST_SCHEDULED',
  'TEST_COMPLETED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_COMPLETED',
  'MERIT_LISTED',
  'OFFER_MADE',
  'OFFER_ACCEPTED',
  'FEE_PENDING',
  'FEE_PAID',
  'ENROLLED',
  'WAITLISTED',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
] as const;
export type ApplicationStatusKey = (typeof APPLICATION_STATUS_VALUES)[number];

// Transition map + terminal set are imported from the shared backend state
// machine — single source of truth between server and client. A schema
// rename in `@roviq/common-types/state-machines/admission-application.ts`
// becomes a compile error here, eliminating the dropdown-vs-backend drift
// the prior local copy was famous for. UI still treats this as a UX aid;
// the backend remains the security boundary via `assertTransition`.
import {
  ADMISSION_APPLICATION_STATE_MACHINE,
  TERMINAL_STATUSES as APPLICATION_TERMINAL_STATUSES_FROM_LIB,
} from '@roviq/common-types';

export const APPLICATION_TRANSITIONS = ADMISSION_APPLICATION_STATE_MACHINE.transitions as Record<
  ApplicationStatusKey,
  readonly ApplicationStatusKey[]
>;

export const APPLICATION_TERMINAL_STATUSES: ReadonlySet<ApplicationStatusKey> =
  APPLICATION_TERMINAL_STATUSES_FROM_LIB as ReadonlySet<ApplicationStatusKey>;

/**
 * Stage-group colour for status badges. Maps every status into one of the
 * PRD-defined buckets so a 1-line colour lookup handles all 18 states.
 *   initial → blue, verification → amber, testing → purple,
 *   offer → green, enrolled → emerald, negative → rose/gray.
 */
export const APPLICATION_STATUS_CLASS: Record<ApplicationStatusKey, string> = {
  DRAFT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  SUBMITTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  UNDER_REVIEW: 'bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100',
  DOCUMENTS_PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  DOCUMENTS_VERIFIED: 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
  TEST_SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  TEST_COMPLETED: 'bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-100',
  INTERVIEW_SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  INTERVIEW_COMPLETED: 'bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-100',
  MERIT_LISTED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  OFFER_MADE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  OFFER_ACCEPTED: 'bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100',
  FEE_PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  FEE_PAID: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  ENROLLED: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100',
  WAITLISTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  REJECTED: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
  WITHDRAWN: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  EXPIRED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export const APPLICATION_STATUS_ICON: Record<ApplicationStatusKey, LucideIcon> = {
  DRAFT: ClipboardEdit,
  SUBMITTED: ClipboardCheck,
  UNDER_REVIEW: ClipboardList,
  DOCUMENTS_PENDING: FileClock,
  DOCUMENTS_VERIFIED: FileCheck2,
  TEST_SCHEDULED: Calendar,
  TEST_COMPLETED: CheckCircle2,
  INTERVIEW_SCHEDULED: Calendar,
  INTERVIEW_COMPLETED: CheckCircle2,
  MERIT_LISTED: Trophy,
  OFFER_MADE: Mail,
  OFFER_ACCEPTED: CheckCircle2,
  FEE_PENDING: FileClock,
  FEE_PAID: CreditCard,
  ENROLLED: GraduationCap,
  WAITLISTED: Clock,
  REJECTED: Gavel,
  WITHDRAWN: X,
  EXPIRED: AlertCircle,
};

export function isTerminalApplicationStatus(status: string): boolean {
  return APPLICATION_TERMINAL_STATUSES.has(status as ApplicationStatusKey);
}

export function getNextApplicationStatuses(status: string): readonly ApplicationStatusKey[] {
  const key = status as ApplicationStatusKey;
  return APPLICATION_TRANSITIONS[key] ?? [];
}
