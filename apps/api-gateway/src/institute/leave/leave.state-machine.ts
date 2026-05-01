import type { LeaveStatus } from '@roviq/common-types';
import { defineStateMachine } from '@roviq/common-types';

export const LEAVE_STATE_MACHINE = defineStateMachine<LeaveStatus>('Leave', {
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['CANCELLED'],
  REJECTED: [],
  CANCELLED: [],
});
