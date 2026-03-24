import type { GenderRestriction } from '@roviq/database';

export interface SectionRecord {
  id: string;
  tenantId: string;
  standardId: string;
  academicYearId: string;
  name: string;
  displayLabel: string | null;
  stream: { name: string; code: string } | null;
  mediumOfInstruction: string | null;
  shift: string | null;
  classTeacherId: string | null;
  room: string | null;
  capacity: number | null;
  currentStrength: number;
  genderRestriction: GenderRestriction;
  displayOrder: number;
  startTime: string | null;
  endTime: string | null;
  batchStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSectionData {
  standardId: string;
  academicYearId: string;
  name: string;
  displayLabel?: string;
  stream?: { name: string; code: string };
  mediumOfInstruction?: string;
  shift?: string;
  room?: string;
  capacity?: number;
  genderRestriction?: string;
  displayOrder?: number;
  startTime?: string;
  endTime?: string;
}

export interface UpdateSectionData {
  name?: string;
  displayLabel?: string;
  stream?: { name: string; code: string };
  mediumOfInstruction?: string;
  shift?: string;
  classTeacherId?: string | null;
  room?: string;
  capacity?: number;
  genderRestriction?: string;
  displayOrder?: number;
  startTime?: string;
  endTime?: string;
  batchStatus?: string;
}
