/**
 * Shared enum constants for the admission domain (enquiries, applications,
 * certificates).
 *
 * Declared here in `@roviq/common-types` so every layer reads from a single
 * source of truth WITHOUT api-gateway having to depend on `@roviq/database`:
 *
 *   - `libs/database/src/schema/admission/enums.ts` imports the `*_VALUES`
 *     tuples and passes them to `pgEnum(...)`, so the Postgres enum and the
 *     TypeScript union are built from the exact same readonly tuple.
 *
 *   - `apps/api-gateway/src/institute/admission/` resolvers import the const
 *     aliases for NestJS `registerEnumType` / `@Field(...)` / `@IsEnum(...)`.
 *
 *   - Frontend pages under `apps/web/src/app/[locale]/institute/(dashboard)/
 *     admissions/` import the tuples to iterate Select options and the const
 *     aliases for Zod schemas.
 *
 * Per the Roviq enum documentation rule every option has an inline comment
 * explaining its domain meaning.
 */

/**
 * Lifecycle state of an admission application.
 *
 * Follows the full journey from an applicant starting a draft through
 * document verification, entrance tests, interviews, merit listing, offer,
 * fee collection, and final enrolment — plus the terminal rejection /
 * withdrawal / expiry states.
 *
 * Adding a state only requires editing this tuple — the derived type, const
 * alias, and downstream Postgres pgEnum all update automatically.
 */
export const ADMISSION_APPLICATION_STATUS_VALUES = [
  // Application started but not yet submitted by the applicant
  'DRAFT',
  // Applicant clicked "Submit" — application is under institute review
  'SUBMITTED',
  // Institute reviewed and found required documents missing or incomplete
  'DOCUMENTS_PENDING',
  // All submitted documents have been verified as authentic and complete
  'DOCUMENTS_VERIFIED',
  // Entrance / selection test date has been assigned to the applicant
  'TEST_SCHEDULED',
  // Applicant attended the test; results are being evaluated
  'TEST_COMPLETED',
  // Interview slot has been assigned — applicant notified
  'INTERVIEW_SCHEDULED',
  // Interview concluded; feedback and scoring in progress
  'INTERVIEW_COMPLETED',
  // Applicant's score/rank qualifies them for a seat in the merit list
  'MERIT_LISTED',
  // Formal offer of admission sent to the applicant
  'OFFER_MADE',
  // Applicant accepted the offer (digitally or in person)
  'OFFER_ACCEPTED',
  // Fee challan / payment link generated; awaiting payment
  'FEE_PENDING',
  // Admission fee received and reconciled
  'FEE_PAID',
  // Student record created in the institute system — enrolment complete
  'ENROLLED',
  // Applicant placed on a waiting list pending seat availability
  'WAITLISTED',
  // Application rejected by the institute (test score, documents, capacity)
  'REJECTED',
  // Applicant withdrew their own application
  'WITHDRAWN',
  // Application validity window lapsed without action from either side
  'EXPIRED',
] as const;

/** String-literal union derived from the tuple above. */
export type AdmissionApplicationStatus = (typeof ADMISSION_APPLICATION_STATUS_VALUES)[number];

/**
 * Const object whose keys map to themselves — the runtime value needed by
 * NestJS `registerEnumType`, `@Field(() => AdmissionApplicationStatus)`,
 * class-validator `@IsEnum(AdmissionApplicationStatus)`, and Zod 4's
 * `z.enum(ADMISSION_APPLICATION_STATUS_VALUES)`. Shares the identifier with
 * the type above because TypeScript types and values live in separate
 * namespaces.
 */
export const AdmissionApplicationStatus = Object.fromEntries(
  ADMISSION_APPLICATION_STATUS_VALUES.map((v) => [v, v]),
) as { readonly [K in AdmissionApplicationStatus]: K };

// ---------------------------------------------------------------------------

/**
 * Admission enquiry lifecycle — tracks the journey from first contact to
 * final outcome (enrolled or lost/dropped). Consumed by:
 *
 *   - `admissions.enquiry_status` Postgres pgEnum (libs/database schema)
 *   - api-gateway `EnquiryStatus` GraphQL enum and DTO validators
 *   - Frontend enquiry list filters and Kanban board column mapping
 */
export const ENQUIRY_STATUS_VALUES = [
  // Enquiry just received — no staff member has contacted the prospect yet
  'NEW',
  // A counsellor has reached out (call, email, WhatsApp) — conversation begun
  'CONTACTED',
  // Campus visit appointment created and shared with the prospective family
  'CAMPUS_VISIT_SCHEDULED',
  // Family completed the campus visit
  'CAMPUS_VISITED',
  // Blank application form handed out or e-form link sent
  'APPLICATION_ISSUED',
  // Applicant submitted the completed form (moves to application pipeline)
  'APPLICATION_SUBMITTED',
  // Entrance / selection test slot assigned to this enquiry's applicant
  'TEST_SCHEDULED',
  // Formal admission offer extended based on merit / capacity
  'OFFER_MADE',
  // Admission fee received — enrolment confirmed
  'FEE_PAID',
  // Student successfully enrolled; enquiry journey complete
  'ENROLLED',
  // Prospect chose a competing institute or dropped interest
  'LOST',
  // Enquiry abandoned mid-funnel without a clear reason
  'DROPPED',
] as const;

/** String-literal union derived from the tuple above. */
export type EnquiryStatus = (typeof ENQUIRY_STATUS_VALUES)[number];

/**
 * Const object whose keys map to themselves — runtime value for NestJS
 * `registerEnumType`, `@IsEnum(EnquiryStatus)`, and Zod `z.enum(...)`.
 * Shares the identifier with the type because TypeScript types and values
 * live in separate namespaces.
 */
export const EnquiryStatus = Object.fromEntries(ENQUIRY_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in EnquiryStatus]: K;
};

// ---------------------------------------------------------------------------

/**
 * How an admission enquiry originated — used for attribution reporting and
 * counsellor-routing rules. Consumed by:
 *
 *   - `admissions.enquiry_source` Postgres pgEnum (libs/database schema)
 *   - api-gateway `EnquirySource` GraphQL enum and create-enquiry DTO
 *   - Frontend enquiry form source dropdown and analytics dashboards
 */
export const ENQUIRY_SOURCE_VALUES = [
  // Prospect walked into the institute campus without a prior appointment
  'WALK_IN',
  // Enquiry received via telephone call to the institute's admission desk
  'PHONE',
  // Lead submitted through the institute's own website / admission portal
  'WEBSITE',
  // Enquiry originated from a social media post, ad, or direct message
  'SOCIAL_MEDIA',
  // Referred by a current student, alumni, or staff member
  'REFERRAL',
  // Attracted by a print advertisement in a newspaper or magazine
  'NEWSPAPER_AD',
  // Attracted by an outdoor hoarding / banner / flex board
  'HOARDING',
  // Met at a school fair, education expo, or campus open-day event
  'SCHOOL_EVENT',
  // Referred or reached via the institute's alumni network
  'ALUMNI',
  // Arrived via a Google Search ad or organic listing
  'GOOGLE',
  // Enquiry received through a WhatsApp broadcast or chat
  'WHATSAPP',
  // Any channel not captured above — staff must document context
  'OTHER',
] as const;

/** String-literal union derived from the tuple above. */
export type EnquirySource = (typeof ENQUIRY_SOURCE_VALUES)[number];

/**
 * Const object whose keys map to themselves — runtime value for NestJS
 * `registerEnumType`, `@IsEnum(EnquirySource)`, and Zod `z.enum(...)`.
 * Shares the identifier with the type because TypeScript types and values
 * live in separate namespaces.
 */
export const EnquirySource = Object.fromEntries(ENQUIRY_SOURCE_VALUES.map((v) => [v, v])) as {
  readonly [K in EnquirySource]: K;
};

// ---------------------------------------------------------------------------

/**
 * Issued certificate lifecycle — governs draft → approval → issuance →
 * cancellation flow for transfer certificates, bonafide letters, and other
 * official institute documents. Consumed by:
 *
 *   - `certificates.status` Postgres pgEnum (libs/database schema)
 *   - api-gateway `CertificateStatus` GraphQL enum and certificate DTO
 *   - Frontend certificate management table status badges and action buttons
 */
export const CERTIFICATE_STATUS_VALUES = [
  // Certificate content created but not yet routed for approval
  'DRAFT',
  // Submitted to an authorised staff member / principal for sign-off
  'PENDING_APPROVAL',
  // Approved by the authorised signatory — ready to be printed or emailed
  'APPROVED',
  // Hard copy issued to the student / guardian or digital copy dispatched
  'ISSUED',
  // Certificate voided after issuance (e.g., data error, student re-admission)
  'CANCELLED',
] as const;

/** String-literal union derived from the tuple above. */
export type CertificateStatus = (typeof CERTIFICATE_STATUS_VALUES)[number];

/**
 * Const object whose keys map to themselves — runtime value for NestJS
 * `registerEnumType`, `@IsEnum(CertificateStatus)`, and Zod `z.enum(...)`.
 * Shares the identifier with the type because TypeScript types and values
 * live in separate namespaces.
 */
export const CertificateStatus = Object.fromEntries(
  CERTIFICATE_STATUS_VALUES.map((v) => [v, v]),
) as { readonly [K in CertificateStatus]: K };

// ---------------------------------------------------------------------------

/**
 * Transfer Certificate (TC) register lifecycle state.
 *
 * Tracks the full TC journey from request through department clearances,
 * document generation, principal approval, and physical issuance. Also covers
 * duplicate TC requests. Consumed by:
 *
 *   - `tc_register.status` Postgres pgEnum (libs/database schema)
 *   - api-gateway TC resolver and certificate service
 *   - Frontend TC management table status badges and action buttons
 */
export const TC_STATUS_VALUES = [
  // Guardian or admin has submitted a TC request
  'REQUESTED',
  // Awaiting clearances from departments (accounts, library, lab, transport)
  'CLEARANCE_PENDING',
  // All departments have cleared the student
  'CLEARANCE_COMPLETE',
  // TC document auto-generated from student record snapshot
  'GENERATED',
  // Awaiting class teacher / section head review
  'REVIEW_PENDING',
  // Principal has approved the TC
  'APPROVED',
  // TC physically or digitally handed to the guardian
  'ISSUED',
  // TC request cancelled before issuance
  'CANCELLED',
  // Request for a duplicate copy of an already-issued TC
  'DUPLICATE_REQUESTED',
  // Duplicate TC issued (with fee)
  'DUPLICATE_ISSUED',
] as const;

/** String-literal union derived from the tuple above. */
export type TcStatus = (typeof TC_STATUS_VALUES)[number];

/**
 * Const object whose keys map to themselves — runtime value for NestJS
 * `registerEnumType`, `@IsEnum(TcStatus)`, and Zod `z.enum(...)`.
 */
export const TcStatus = Object.fromEntries(TC_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in TcStatus]: K;
};
