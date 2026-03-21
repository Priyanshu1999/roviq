/**
 * Board-specific templates for seeding standards, sections, and subjects.
 * These are configuration data — not hardcoded logic. Update when boards change curriculum.
 */

// ── Standard Templates ─────────────────────────────────

export interface StandardTemplate {
  name: string;
  numericOrder: number;
  level: string;
  nepStage: string;
  department: string;
  isBoardExamClass: boolean;
  streamApplicable: boolean;
  udiseClassCode: number;
}

const PRE_PRIMARY: StandardTemplate[] = [
  {
    name: 'Nursery',
    numericOrder: -3,
    level: 'PRE_PRIMARY',
    nepStage: 'FOUNDATIONAL',
    department: 'PRE_PRIMARY',
    isBoardExamClass: false,
    streamApplicable: false,
    udiseClassCode: -3,
  },
  {
    name: 'LKG',
    numericOrder: -2,
    level: 'PRE_PRIMARY',
    nepStage: 'FOUNDATIONAL',
    department: 'PRE_PRIMARY',
    isBoardExamClass: false,
    streamApplicable: false,
    udiseClassCode: -2,
  },
  {
    name: 'UKG',
    numericOrder: -1,
    level: 'PRE_PRIMARY',
    nepStage: 'FOUNDATIONAL',
    department: 'PRE_PRIMARY',
    isBoardExamClass: false,
    streamApplicable: false,
    udiseClassCode: -1,
  },
];

const PRIMARY: StandardTemplate[] = [
  {
    name: 'Class 1',
    numericOrder: 1,
    level: 'PRIMARY',
    nepStage: 'FOUNDATIONAL',
    department: 'PRIMARY',
    isBoardExamClass: false,
    streamApplicable: false,
    udiseClassCode: 1,
  },
  {
    name: 'Class 2',
    numericOrder: 2,
    level: 'PRIMARY',
    nepStage: 'FOUNDATIONAL',
    department: 'PRIMARY',
    isBoardExamClass: false,
    streamApplicable: false,
    udiseClassCode: 2,
  },
  {
    name: 'Class 3',
    numericOrder: 3,
    level: 'PRIMARY',
    nepStage: 'PREPARATORY',
    department: 'PRIMARY',
    isBoardExamClass: false,
    streamApplicable: false,
    udiseClassCode: 3,
  },
  {
    name: 'Class 4',
    numericOrder: 4,
    level: 'PRIMARY',
    nepStage: 'PREPARATORY',
    department: 'PRIMARY',
    isBoardExamClass: false,
    streamApplicable: false,
    udiseClassCode: 4,
  },
  {
    name: 'Class 5',
    numericOrder: 5,
    level: 'PRIMARY',
    nepStage: 'PREPARATORY',
    department: 'PRIMARY',
    isBoardExamClass: false,
    streamApplicable: false,
    udiseClassCode: 5,
  },
];

const UPPER_PRIMARY: StandardTemplate[] = [
  {
    name: 'Class 6',
    numericOrder: 6,
    level: 'UPPER_PRIMARY',
    nepStage: 'MIDDLE',
    department: 'UPPER_PRIMARY',
    isBoardExamClass: false,
    streamApplicable: false,
    udiseClassCode: 6,
  },
  {
    name: 'Class 7',
    numericOrder: 7,
    level: 'UPPER_PRIMARY',
    nepStage: 'MIDDLE',
    department: 'UPPER_PRIMARY',
    isBoardExamClass: false,
    streamApplicable: false,
    udiseClassCode: 7,
  },
  {
    name: 'Class 8',
    numericOrder: 8,
    level: 'UPPER_PRIMARY',
    nepStage: 'MIDDLE',
    department: 'UPPER_PRIMARY',
    isBoardExamClass: false,
    streamApplicable: false,
    udiseClassCode: 8,
  },
];

const SECONDARY: StandardTemplate[] = [
  {
    name: 'Class 9',
    numericOrder: 9,
    level: 'SECONDARY',
    nepStage: 'SECONDARY',
    department: 'SECONDARY',
    isBoardExamClass: false,
    streamApplicable: false,
    udiseClassCode: 9,
  },
  {
    name: 'Class 10',
    numericOrder: 10,
    level: 'SECONDARY',
    nepStage: 'SECONDARY',
    department: 'SECONDARY',
    isBoardExamClass: true,
    streamApplicable: false,
    udiseClassCode: 10,
  },
];

const SENIOR_SECONDARY: StandardTemplate[] = [
  {
    name: 'Class 11',
    numericOrder: 11,
    level: 'SENIOR_SECONDARY',
    nepStage: 'SECONDARY',
    department: 'SENIOR_SECONDARY',
    isBoardExamClass: false,
    streamApplicable: true,
    udiseClassCode: 11,
  },
  {
    name: 'Class 12',
    numericOrder: 12,
    level: 'SENIOR_SECONDARY',
    nepStage: 'SECONDARY',
    department: 'SENIOR_SECONDARY',
    isBoardExamClass: true,
    streamApplicable: true,
    udiseClassCode: 12,
  },
];

export const DEPARTMENT_STANDARDS: Record<string, StandardTemplate[]> = {
  PRE_PRIMARY,
  PRIMARY,
  UPPER_PRIMARY,
  SECONDARY,
  SENIOR_SECONDARY,
};

// ── Board exam overrides ───────────────────────────────
// CBSE: board exams at Class 10, 12
// BSEH: board exams at Class 8, 10, 12
// RBSE: board exams at Class 5, 8, 10, 12

export const BOARD_EXAM_CLASSES: Record<string, number[]> = {
  CBSE: [10, 12],
  BSEH: [8, 10, 12],
  RBSE: [5, 8, 10, 12],
  ICSE: [10, 12],
};

// ── Subject Templates ──────────────────────────────────

export interface SubjectTemplate {
  name: string;
  shortName: string;
  boardCode?: string;
  type: string;
  isMandatory: boolean;
  hasPractical: boolean;
  theoryMarks?: number;
  practicalMarks?: number;
  internalMarks?: number;
  /** Numeric orders of standards this subject applies to */
  applicableClasses: number[];
}

// CBSE subject templates with board codes
export const CBSE_SUBJECTS: SubjectTemplate[] = [
  // Primary (1-5)
  {
    name: 'English',
    shortName: 'Eng',
    type: 'LANGUAGE',
    isMandatory: true,
    hasPractical: false,
    applicableClasses: [1, 2, 3, 4, 5],
  },
  {
    name: 'Hindi',
    shortName: 'Hin',
    type: 'LANGUAGE',
    isMandatory: true,
    hasPractical: false,
    applicableClasses: [1, 2, 3, 4, 5],
  },
  {
    name: 'Mathematics',
    shortName: 'Math',
    type: 'ACADEMIC',
    isMandatory: true,
    hasPractical: false,
    applicableClasses: [1, 2, 3, 4, 5],
  },
  {
    name: 'EVS',
    shortName: 'EVS',
    type: 'ACADEMIC',
    isMandatory: true,
    hasPractical: false,
    applicableClasses: [1, 2, 3, 4, 5],
  },

  // Upper Primary (6-8)
  {
    name: 'English',
    shortName: 'Eng',
    type: 'LANGUAGE',
    isMandatory: true,
    hasPractical: false,
    applicableClasses: [6, 7, 8],
  },
  {
    name: 'Hindi',
    shortName: 'Hin',
    type: 'LANGUAGE',
    isMandatory: true,
    hasPractical: false,
    applicableClasses: [6, 7, 8],
  },
  {
    name: 'Mathematics',
    shortName: 'Math',
    type: 'ACADEMIC',
    isMandatory: true,
    hasPractical: false,
    applicableClasses: [6, 7, 8],
  },
  {
    name: 'Science',
    shortName: 'Sci',
    type: 'ACADEMIC',
    isMandatory: true,
    hasPractical: false,
    applicableClasses: [6, 7, 8],
  },
  {
    name: 'Social Science',
    shortName: 'SSt',
    type: 'ACADEMIC',
    isMandatory: true,
    hasPractical: false,
    applicableClasses: [6, 7, 8],
  },

  // Secondary (9-10)
  {
    name: 'English Language and Literature',
    shortName: 'Eng',
    boardCode: '184',
    type: 'LANGUAGE',
    isMandatory: true,
    hasPractical: false,
    theoryMarks: 80,
    internalMarks: 20,
    applicableClasses: [9, 10],
  },
  {
    name: 'Hindi Course A',
    shortName: 'Hin-A',
    boardCode: '002',
    type: 'LANGUAGE',
    isMandatory: true,
    hasPractical: false,
    theoryMarks: 80,
    internalMarks: 20,
    applicableClasses: [9, 10],
  },
  {
    name: 'Mathematics Standard',
    shortName: 'Math-S',
    boardCode: '041',
    type: 'ACADEMIC',
    isMandatory: true,
    hasPractical: false,
    theoryMarks: 80,
    internalMarks: 20,
    applicableClasses: [9, 10],
  },
  {
    name: 'Science',
    shortName: 'Sci',
    boardCode: '086',
    type: 'ACADEMIC',
    isMandatory: true,
    hasPractical: true,
    theoryMarks: 80,
    internalMarks: 20,
    applicableClasses: [9, 10],
  },
  {
    name: 'Social Science',
    shortName: 'SSt',
    boardCode: '087',
    type: 'ACADEMIC',
    isMandatory: true,
    hasPractical: false,
    theoryMarks: 80,
    internalMarks: 20,
    applicableClasses: [9, 10],
  },

  // Senior Secondary Science stream
  {
    name: 'Physics',
    shortName: 'Phy',
    boardCode: '042',
    type: 'ACADEMIC',
    isMandatory: false,
    hasPractical: true,
    theoryMarks: 70,
    practicalMarks: 30,
    applicableClasses: [11, 12],
  },
  {
    name: 'Chemistry',
    shortName: 'Chem',
    boardCode: '043',
    type: 'ACADEMIC',
    isMandatory: false,
    hasPractical: true,
    theoryMarks: 70,
    practicalMarks: 30,
    applicableClasses: [11, 12],
  },
  {
    name: 'Biology',
    shortName: 'Bio',
    boardCode: '044',
    type: 'ACADEMIC',
    isMandatory: false,
    hasPractical: true,
    theoryMarks: 70,
    practicalMarks: 30,
    applicableClasses: [11, 12],
  },
  {
    name: 'Mathematics',
    shortName: 'Math',
    boardCode: '041',
    type: 'ACADEMIC',
    isMandatory: false,
    hasPractical: false,
    theoryMarks: 80,
    internalMarks: 20,
    applicableClasses: [11, 12],
  },

  // Senior Secondary Commerce stream
  {
    name: 'Accountancy',
    shortName: 'Acc',
    boardCode: '055',
    type: 'ACADEMIC',
    isMandatory: false,
    hasPractical: false,
    theoryMarks: 80,
    internalMarks: 20,
    applicableClasses: [11, 12],
  },
  {
    name: 'Business Studies',
    shortName: 'BSt',
    boardCode: '054',
    type: 'ACADEMIC',
    isMandatory: false,
    hasPractical: false,
    theoryMarks: 80,
    internalMarks: 20,
    applicableClasses: [11, 12],
  },
  {
    name: 'Economics',
    shortName: 'Eco',
    boardCode: '030',
    type: 'ACADEMIC',
    isMandatory: false,
    hasPractical: false,
    theoryMarks: 80,
    internalMarks: 20,
    applicableClasses: [11, 12],
  },

  // Common senior secondary
  {
    name: 'English Core',
    shortName: 'Eng',
    boardCode: '301',
    type: 'LANGUAGE',
    isMandatory: true,
    hasPractical: false,
    theoryMarks: 80,
    internalMarks: 20,
    applicableClasses: [11, 12],
  },
  {
    name: 'Physical Education',
    shortName: 'PE',
    boardCode: '048',
    type: 'EXTRACURRICULAR',
    isMandatory: false,
    hasPractical: true,
    theoryMarks: 70,
    practicalMarks: 30,
    applicableClasses: [11, 12],
  },
];

// BSEH uses similar structure — same subjects, different board codes
export const BSEH_SUBJECTS: SubjectTemplate[] = [
  {
    name: 'English',
    shortName: 'Eng',
    type: 'LANGUAGE',
    isMandatory: true,
    hasPractical: false,
    applicableClasses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    name: 'Hindi',
    shortName: 'Hin',
    type: 'LANGUAGE',
    isMandatory: true,
    hasPractical: false,
    applicableClasses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    name: 'Mathematics',
    shortName: 'Math',
    type: 'ACADEMIC',
    isMandatory: true,
    hasPractical: false,
    applicableClasses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    name: 'Science',
    shortName: 'Sci',
    type: 'ACADEMIC',
    isMandatory: true,
    hasPractical: false,
    applicableClasses: [6, 7, 8, 9, 10],
  },
  {
    name: 'Social Science',
    shortName: 'SSt',
    type: 'ACADEMIC',
    isMandatory: true,
    hasPractical: false,
    applicableClasses: [6, 7, 8, 9, 10],
  },
  {
    name: 'EVS',
    shortName: 'EVS',
    type: 'ACADEMIC',
    isMandatory: true,
    hasPractical: false,
    applicableClasses: [1, 2, 3, 4, 5],
  },
];

// RBSE mirrors BSEH for basic subjects
export const RBSE_SUBJECTS: SubjectTemplate[] = BSEH_SUBJECTS;

export const BOARD_SUBJECTS: Record<string, SubjectTemplate[]> = {
  CBSE: CBSE_SUBJECTS,
  BSEH: BSEH_SUBJECTS,
  RBSE: RBSE_SUBJECTS,
};

// ── Section defaults ───────────────────────────────────

export const DEFAULT_SECTION_NAMES = ['A', 'B', 'C', 'D'];
export const DEFAULT_SECTIONS_PER_STANDARD = 4;

export const LIBRARY_STANDARD = {
  name: 'Library',
  numericOrder: 0,
};

export const LIBRARY_SECTIONS = ['Full Day', 'Half Day'];
