export interface StandardRecord {
  id: string;
  tenantId: string;
  academicYearId: string;
  name: string;
  numericOrder: number;
  level: string | null;
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
  name: string;
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
  name?: string;
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
