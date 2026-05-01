import type { AcademicStatus } from '../enums/user-profile';
import { defineStateMachine } from '../state-machine';

export const STUDENT_ACADEMIC_STATE_MACHINE = defineStateMachine<AcademicStatus>(
  'StudentAcademic',
  {
    ENROLLED: [
      'PROMOTED',
      'DETAINED',
      'GRADUATED',
      'TRANSFERRED_OUT',
      'DROPPED_OUT',
      'WITHDRAWN',
      'SUSPENDED',
      'EXPELLED',
    ],
    PROMOTED: ['ENROLLED'],
    DETAINED: ['ENROLLED'],
    SUSPENDED: ['ENROLLED', 'EXPELLED'],
    WITHDRAWN: ['RE_ENROLLED'],
    DROPPED_OUT: ['RE_ENROLLED'],
    RE_ENROLLED: ['ENROLLED'],
    GRADUATED: ['PASSOUT'],
    TRANSFERRED_OUT: [],
    EXPELLED: [],
    PASSOUT: [],
  },
);
