/**
 * TCIssuanceWorkflow — 5-step Temporal workflow (ROV-161, PRD §5.1).
 *
 * Step 1: Request validation → status='clearance_pending'
 * Step 2: Department clearances (parallel) → accounts, library, lab, transport
 * Step 3: Data population → snapshot 20 CBSE TC fields into tc_data JSONB
 * Step 4: Approval → principal signs off
 * Step 5: Issuance → PDF + QR, upload S3, student → transferred_out
 *
 * Task queue: tc-issuance
 * Workflow timeout: 7 days
 */
import { proxyActivities } from '@temporalio/workflow';
import type { TCIssuanceActivities, TCIssuanceInput, TCIssuanceResult } from './tc-issuance.types';

const DEPARTMENTS = ['accounts', 'library', 'lab', 'transport'];

const activities = proxyActivities<TCIssuanceActivities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    backoffCoefficient: 2,
  },
});

export async function TCIssuanceWorkflow(input: TCIssuanceInput): Promise<TCIssuanceResult> {
  const { tenantId, tcRegisterId, studentProfileId, skipClearance } = input;

  // ── Step 1: Request validation ─────────────────────────
  await activities.validateRequest(tenantId, tcRegisterId, studentProfileId);

  // ── Step 2: Department clearances (parallel) ───────────
  if (!skipClearance) {
    const clearanceResults = await Promise.all(
      DEPARTMENTS.map((dept) => activities.checkDepartmentClearance(tenantId, tcRegisterId, dept)),
    );

    const deniedDepts = clearanceResults.filter((r) => !r.cleared);
    if (deniedDepts.length > 0) {
      return {
        status: 'FAILED',
        tcRegisterId,
        tcSerialNumber: null,
        pdfUrl: null,
      };
    }
  }

  // ── Step 3: Data population (20 CBSE fields) ──────────
  await activities.populateTcData(tenantId, tcRegisterId, studentProfileId);

  // Steps 4 (approval) and 5 (issuance) are resolver-driven:
  // - Principal calls approveTC mutation → status='approved'
  // - Admin calls issueTC mutation → generates PDF, marks student transferred_out
  // The workflow completes after data population. This ensures only the principal
  // can approve (PRD §5.1 Step 4: "ONLY principal — CBSE bye-law").

  return {
    status: 'GENERATED',
    tcRegisterId,
    tcSerialNumber: null,
    pdfUrl: null,
  };
}
