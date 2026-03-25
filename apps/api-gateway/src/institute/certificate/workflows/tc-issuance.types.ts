/**
 * Types for TCIssuanceWorkflow (ROV-161, PRD §5.1).
 *
 * 5-step Temporal workflow:
 *   1. Request validation
 *   2. Department clearances (parallel)
 *   3. TC data population (20 CBSE fields snapshot)
 *   4. Review + approval
 *   5. Issuance (PDF generation, S3 upload, student status update)
 */

// ── Workflow input ────────────────────────────────────────

export interface TCIssuanceInput {
  tenantId: string;
  tcRegisterId: string;
  studentProfileId: string;
  academicYearId: string;
  reason: string;
  requestedBy: string;
  /** Skip clearance step for duplicate TCs */
  skipClearance?: boolean;
}

// ── CBSE TC Data — 20 prescribed fields ──────────────────

/**
 * Immutable snapshot of all 20 CBSE Transfer Certificate fields,
 * frozen at generation time (PRD §5.2).
 */
export interface CbseTcData {
  /** 1. Name of Pupil */
  studentName: string;
  /** 2. Mother's Name */
  motherName: string | null;
  /** 3. Father's/Guardian's Name */
  fatherOrGuardianName: string | null;
  /** 4. Nationality */
  nationality: string | null;
  /** 5. Whether SC/ST/OBC */
  socialCategory: string;
  /** 6. DOB in figures (YYYY-MM-DD) */
  dateOfBirthFigures: string | null;
  /** 6b. DOB in words (e.g., "Fifteenth April Two Thousand Ten") */
  dateOfBirthWords: string | null;
  /** 7. Whether failed, if so once/twice — computed from promotion_status across years */
  whetherFailed: string;
  /** 8. Subjects offered/studied */
  subjectsStudied: string;
  /** 9. Class in which the pupil last studied */
  classLastStudied: string | null;
  /** 10. Last examination taken with result */
  lastExamResult: string;
  /** 11. Whether qualified for promotion to next class */
  qualifiedForPromotion: string;
  /** 12. Whether all dues paid up to date */
  feesPaidUpTo: string;
  /** 13. Any fee concession availed */
  feeConcession: string;
  /** 14. NCC/Scout/Guide details */
  nccScoutGuide: string;
  /** 15. Date on which the pupil's name was struck off the rolls */
  dateOfLeaving: string | null;
  /** 16. Reason for leaving */
  reasonForLeaving: string;
  /** 17a. Total working days during the academic year */
  totalWorkingDays: string;
  /** 17b. Total days present */
  totalPresentDays: string;
  /** 18. General conduct */
  generalConduct: string;
  /** 19. Any other remarks */
  remarks: string;
  /** 20. Date of issue */
  dateOfIssue: string | null;
}

// ── Activity results ──────────────────────────────────────

export interface ClearanceResult {
  department: string;
  cleared: boolean;
  notes?: string;
}

export interface TCPopulateResult {
  tcData: CbseTcData;
}

export interface TCIssueResult {
  pdfUrl: string;
  qrVerificationUrl: string;
  tcSerialNumber: string;
}

// ── Workflow result ───────────────────────────────────────

export type TCWorkflowStatus =
  | 'clearance_pending'
  | 'clearance_complete'
  | 'generated'
  | 'approved'
  | 'issued'
  | 'failed';

export interface TCIssuanceResult {
  status: TCWorkflowStatus;
  tcRegisterId: string;
  tcSerialNumber: string | null;
  pdfUrl: string | null;
}

// ── Activities interface ──────────────────────────────────

export interface TCIssuanceActivities {
  /** Step 1: Validate student status and update tc_register to clearance_pending */
  validateRequest(tenantId: string, tcRegisterId: string, studentProfileId: string): Promise<void>;

  /** Step 2: Check clearance for a single department */
  checkDepartmentClearance(
    tenantId: string,
    tcRegisterId: string,
    department: string,
  ): Promise<ClearanceResult>;

  /** Step 3: Populate tc_data with all 20 CBSE fields from student record */
  populateTcData(
    tenantId: string,
    tcRegisterId: string,
    studentProfileId: string,
  ): Promise<TCPopulateResult>;

  /** Step 4: Record approval by principal */
  recordApproval(tenantId: string, tcRegisterId: string, approvedBy: string): Promise<void>;

  /** Step 5: Generate PDF, upload S3, update student status, emit event */
  issueTC(
    tenantId: string,
    tcRegisterId: string,
    studentProfileId: string,
    academicYearId: string,
  ): Promise<TCIssueResult>;
}
