import { AdmissionApplicationStatus } from '../enums/admission';
import { defineStateMachine } from '../state-machine';

export const ADMISSION_APPLICATION_STATE_MACHINE = defineStateMachine<AdmissionApplicationStatus>(
  'AdmissionApplication',
  {
    [AdmissionApplicationStatus.DRAFT]: [
      AdmissionApplicationStatus.SUBMITTED,
      AdmissionApplicationStatus.WITHDRAWN,
    ],
    [AdmissionApplicationStatus.SUBMITTED]: [
      AdmissionApplicationStatus.DOCUMENTS_PENDING,
      AdmissionApplicationStatus.TEST_SCHEDULED,
      AdmissionApplicationStatus.UNDER_REVIEW,
      AdmissionApplicationStatus.REJECTED,
      AdmissionApplicationStatus.WITHDRAWN,
    ],
    [AdmissionApplicationStatus.UNDER_REVIEW]: [
      AdmissionApplicationStatus.DOCUMENTS_PENDING,
      AdmissionApplicationStatus.TEST_SCHEDULED,
      AdmissionApplicationStatus.DOCUMENTS_VERIFIED,
      AdmissionApplicationStatus.MERIT_LISTED,
      AdmissionApplicationStatus.OFFER_MADE,
      AdmissionApplicationStatus.WAITLISTED,
      AdmissionApplicationStatus.REJECTED,
      AdmissionApplicationStatus.WITHDRAWN,
    ],
    [AdmissionApplicationStatus.DOCUMENTS_PENDING]: [
      AdmissionApplicationStatus.DOCUMENTS_VERIFIED,
      AdmissionApplicationStatus.WITHDRAWN,
    ],
    [AdmissionApplicationStatus.DOCUMENTS_VERIFIED]: [
      AdmissionApplicationStatus.TEST_SCHEDULED,
      AdmissionApplicationStatus.INTERVIEW_SCHEDULED,
      AdmissionApplicationStatus.MERIT_LISTED,
      AdmissionApplicationStatus.OFFER_MADE,
      AdmissionApplicationStatus.WAITLISTED,
      AdmissionApplicationStatus.REJECTED,
    ],
    [AdmissionApplicationStatus.TEST_SCHEDULED]: [
      AdmissionApplicationStatus.TEST_COMPLETED,
      AdmissionApplicationStatus.WITHDRAWN,
    ],
    [AdmissionApplicationStatus.TEST_COMPLETED]: [
      AdmissionApplicationStatus.INTERVIEW_SCHEDULED,
      AdmissionApplicationStatus.MERIT_LISTED,
      AdmissionApplicationStatus.DOCUMENTS_VERIFIED,
      AdmissionApplicationStatus.REJECTED,
    ],
    [AdmissionApplicationStatus.INTERVIEW_SCHEDULED]: [
      AdmissionApplicationStatus.INTERVIEW_COMPLETED,
      AdmissionApplicationStatus.WITHDRAWN,
    ],
    [AdmissionApplicationStatus.INTERVIEW_COMPLETED]: [
      AdmissionApplicationStatus.MERIT_LISTED,
      AdmissionApplicationStatus.DOCUMENTS_VERIFIED,
      AdmissionApplicationStatus.REJECTED,
    ],
    [AdmissionApplicationStatus.MERIT_LISTED]: [
      AdmissionApplicationStatus.OFFER_MADE,
      AdmissionApplicationStatus.WAITLISTED,
      AdmissionApplicationStatus.REJECTED,
    ],
    [AdmissionApplicationStatus.OFFER_MADE]: [
      AdmissionApplicationStatus.OFFER_ACCEPTED,
      AdmissionApplicationStatus.WITHDRAWN,
      AdmissionApplicationStatus.EXPIRED,
    ],
    [AdmissionApplicationStatus.OFFER_ACCEPTED]: [
      AdmissionApplicationStatus.FEE_PENDING,
      AdmissionApplicationStatus.WITHDRAWN,
    ],
    [AdmissionApplicationStatus.FEE_PENDING]: [
      AdmissionApplicationStatus.FEE_PAID,
      AdmissionApplicationStatus.WITHDRAWN,
    ],
    [AdmissionApplicationStatus.FEE_PAID]: [AdmissionApplicationStatus.ENROLLED],
    [AdmissionApplicationStatus.ENROLLED]: [],
    [AdmissionApplicationStatus.WAITLISTED]: [
      AdmissionApplicationStatus.OFFER_MADE,
      AdmissionApplicationStatus.REJECTED,
      AdmissionApplicationStatus.WITHDRAWN,
    ],
    [AdmissionApplicationStatus.REJECTED]: [],
    [AdmissionApplicationStatus.WITHDRAWN]: [],
    [AdmissionApplicationStatus.EXPIRED]: [],
  },
);

/** Statuses that represent the end of the application lifecycle */
export const TERMINAL_STATUSES: ReadonlySet<AdmissionApplicationStatus> = new Set([
  AdmissionApplicationStatus.ENROLLED,
  AdmissionApplicationStatus.REJECTED,
  AdmissionApplicationStatus.WITHDRAWN,
  AdmissionApplicationStatus.EXPIRED,
]);

/** Ordered funnel stages for admissionStatistics */
export const FUNNEL_STAGES: readonly AdmissionApplicationStatus[] = [
  AdmissionApplicationStatus.SUBMITTED,
  AdmissionApplicationStatus.DOCUMENTS_VERIFIED,
  AdmissionApplicationStatus.TEST_COMPLETED,
  AdmissionApplicationStatus.INTERVIEW_COMPLETED,
  AdmissionApplicationStatus.MERIT_LISTED,
  AdmissionApplicationStatus.OFFER_MADE,
  AdmissionApplicationStatus.OFFER_ACCEPTED,
  AdmissionApplicationStatus.FEE_PENDING,
  AdmissionApplicationStatus.FEE_PAID,
  AdmissionApplicationStatus.ENROLLED,
];
