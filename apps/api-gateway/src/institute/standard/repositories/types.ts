import type { EducationLevel, I18nContent } from '@roviq/database';

export interface StandardRecord {
  id: string;
  tenantId: string;
  academicYearId: string;
  name: I18nContent;
  numericOrder: number;
  level: EducationLevel | null;
  nepStage: string | null;
  department: string | null;
  isBoardExamClass: boolean;
  streamApplicable: boolean;
  maxSectionsAllowed: number | null;
  maxStudentsPerSection: number | null;
  udiseClassCode: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStandardData {
  academicYearId: string;
  name: I18nContent;
  numericOrder: number;
  level?: string;
  nepStage?: string;
  department?: string;
  isBoardExamClass?: boolean;
  streamApplicable?: boolean;
  maxSectionsAllowed?: number;
  maxStudentsPerSection?: number;
  udiseClassCode?: number;
}

export interface UpdateStandardData {
  name?: I18nContent;
  numericOrder?: number;
  level?: string;
  nepStage?: string;
  department?: string;
  isBoardExamClass?: boolean;
  streamApplicable?: boolean;
  maxSectionsAllowed?: number;
  maxStudentsPerSection?: number;
  udiseClassCode?: number;
}
