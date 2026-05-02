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

import type { CbseTcData } from '@roviq/common-types';

export type { CbseTcData };

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
  | 'CLEARANCE_PENDING'
  | 'CLEARANCE_COMPLETE'
  | 'GENERATED'
  | 'APPROVED'
  | 'ISSUED'
  | 'FAILED';

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
