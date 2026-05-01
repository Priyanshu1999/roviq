import type { LeaveStatus } from '../enums/leave';
import { defineStateMachine } from '../state-machine';

export const LEAVE_STATE_MACHINE = defineStateMachine<LeaveStatus>('Leave', {
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['CANCELLED'],
  REJECTED: [],
  CANCELLED: [],
});
