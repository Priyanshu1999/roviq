import type { SubjectType } from '@roviq/database';

export interface SubjectRecord {
  id: string;
  tenantId: string;
  name: string;
  shortName: string | null;
  boardCode: string | null;
  type: SubjectType;
  isMandatory: boolean;
  hasPractical: boolean;
  theoryMarks: number | null;
  practicalMarks: number | null;
  internalMarks: number | null;
  isElective: boolean;
  electiveGroup: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubjectData {
  name: string;
  shortName?: string;
  boardCode?: string;
  type?: string;
  isMandatory?: boolean;
  hasPractical?: boolean;
  theoryMarks?: number;
  practicalMarks?: number;
  internalMarks?: number;
  isElective?: boolean;
  electiveGroup?: string;
  standardIds?: string[];
  sectionIds?: string[];
}

export interface UpdateSubjectData {
  name?: string;
  shortName?: string;
  boardCode?: string;
  type?: string;
  isMandatory?: boolean;
  hasPractical?: boolean;
  theoryMarks?: number;
  practicalMarks?: number;
  internalMarks?: number;
  isElective?: boolean;
  electiveGroup?: string;
}
