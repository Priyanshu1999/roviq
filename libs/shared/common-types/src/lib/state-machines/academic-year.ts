import type { AcademicYearStatus } from '../enums/institute';
import { defineStateMachine } from '../state-machine';

export const ACADEMIC_YEAR_STATE_MACHINE = defineStateMachine<AcademicYearStatus>('AcademicYear', {
  PLANNING: ['ACTIVE'],
  ACTIVE: ['COMPLETING'],
  COMPLETING: ['ARCHIVED'],
  ARCHIVED: [],
});
