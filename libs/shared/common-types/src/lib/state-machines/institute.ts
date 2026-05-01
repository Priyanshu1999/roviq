import type { InstituteStatus } from '../enums/institute';
import { defineStateMachine } from '../state-machine';

export const INSTITUTE_STATE_MACHINE = defineStateMachine<InstituteStatus>('Institute', {
  PENDING_APPROVAL: ['PENDING', 'REJECTED'],
  PENDING: ['ACTIVE', 'REJECTED'],
  ACTIVE: ['INACTIVE', 'SUSPENDED'],
  INACTIVE: ['ACTIVE'],
  SUSPENDED: ['ACTIVE'],
  REJECTED: [],
});
