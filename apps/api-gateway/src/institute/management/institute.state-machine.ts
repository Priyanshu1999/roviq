import type { InstituteStatus } from '@roviq/common-types';
import { defineStateMachine } from '@roviq/common-types';

export const INSTITUTE_STATE_MACHINE = defineStateMachine<InstituteStatus>('Institute', {
  PENDING_APPROVAL: ['PENDING', 'REJECTED'],
  PENDING: ['ACTIVE', 'REJECTED'],
  ACTIVE: ['INACTIVE', 'SUSPENDED'],
  INACTIVE: ['ACTIVE'],
  SUSPENDED: ['ACTIVE'],
  REJECTED: [],
});
