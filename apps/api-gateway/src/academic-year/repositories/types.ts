import type { AcademicYearStatus } from '@roviq/database';

export interface AcademicYearRecord {
  id: string;
  tenantId: string;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status: AcademicYearStatus;
  termStructure: unknown[];
  boardExamDates: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAcademicYearData {
  label: string;
  startDate: string;
  endDate: string;
  termStructure?: unknown[];
}

export interface UpdateAcademicYearData {
  label?: string;
  startDate?: string;
  endDate?: string;
  termStructure?: unknown[];
  boardExamDates?: Record<string, unknown>;
}
