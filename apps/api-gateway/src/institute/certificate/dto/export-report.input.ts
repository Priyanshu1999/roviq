import { Field, ID, InputType, registerEnumType } from '@nestjs/graphql';

/**
 * Supported compliance report types:
 * - `UDISE_DCF`: UDISE+ Data Capture Format (school profile + students + teachers)
 * - `CBSE_REGISTRATION`: CBSE Class 9/11 Registration for Pariksha Sangam
 * - `CBSE_LOC`: CBSE Class 10/12 List of Candidates
 * - `RTE_REPORT`: RTE enrollment count by class with fee reimbursement
 * - `TC_REGISTER`: All TCs issued in the academic year
 * - `AWR`: Admission Register sorted by admission number
 */
export enum ComplianceReportTypeEnum {
  UDISE_DCF = 'udise_dcf',
  CBSE_REGISTRATION = 'cbse_registration',
  CBSE_LOC = 'cbse_loc',
  RTE_REPORT = 'rte_report',
  TC_REGISTER = 'tc_register',
  AWR = 'awr',
}

registerEnumType(ComplianceReportTypeEnum, { name: 'ComplianceReportType' });

@InputType({ description: 'Input for generating a compliance export report' })
export class ExportComplianceReportInput {
  @Field(() => ComplianceReportTypeEnum)
  reportType!: ComplianceReportTypeEnum;

  @Field(() => ID)
  academicYearId!: string;
}
