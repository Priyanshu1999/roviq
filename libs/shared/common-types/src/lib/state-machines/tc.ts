import type { TcStatus } from '../enums/admission';
import { defineStateMachine } from '../state-machine';

// Transitions derived from
// `apps/api-gateway/src/institute/certificate/certificate.service.ts` and
// the Temporal workflow at `workflows/tc-issuance.activities.ts`.
// Linear forward path: REQUESTED → CLEARANCE_PENDING → CLEARANCE_COMPLETE
// → GENERATED → REVIEW_PENDING → APPROVED → ISSUED. CANCELLED is reachable
// from every pre-issuance state. DUPLICATE_REQUESTED branches off ISSUED.
export const TC_STATE_MACHINE = defineStateMachine<TcStatus>('TC', {
  REQUESTED: ['CLEARANCE_PENDING', 'CANCELLED'],
  CLEARANCE_PENDING: ['CLEARANCE_COMPLETE', 'CANCELLED'],
  CLEARANCE_COMPLETE: ['GENERATED', 'CANCELLED'],
  GENERATED: ['REVIEW_PENDING', 'APPROVED', 'CANCELLED'],
  REVIEW_PENDING: ['APPROVED', 'GENERATED', 'CANCELLED'],
  APPROVED: ['ISSUED', 'CANCELLED'],
  ISSUED: ['DUPLICATE_REQUESTED'],
  DUPLICATE_REQUESTED: ['DUPLICATE_ISSUED', 'CANCELLED'],
  DUPLICATE_ISSUED: [],
  CANCELLED: [],
});
