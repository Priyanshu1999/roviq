/**
 * Types for ComplianceExportWorkflow (ROV-171).
 */

/**
 * Supported compliance report types.
 * - `udise_dcf`: UDISE+ Data Capture Format (XLSX)
 * - `cbse_registration`: CBSE Class 9/11 Registration (XLSX)
 * - `cbse_loc`: CBSE Class 10/12 LOC (XLSX)
 * - `rte_report`: RTE Enrollment Report (XLSX)
 * - `tc_register`: TC Register (XLSX/PDF)
 * - `awr`: Admission Register (XLSX/PDF)
 */
export type ComplianceReportType =
  | 'udise_dcf'
  | 'cbse_registration'
  | 'cbse_loc'
  | 'rte_report'
  | 'tc_register'
  | 'awr';

export interface ComplianceExportInput {
  tenantId: string;
  reportType: ComplianceReportType;
  academicYearId: string;
  requestedBy: string;
}

export interface ComplianceExportResult {
  reportType: ComplianceReportType;
  fileUrl: string;
  fileSize: number;
  rowCount: number;
}

export interface ComplianceExportActivities {
  generateReport(input: ComplianceExportInput): Promise<ComplianceExportResult>;
}
