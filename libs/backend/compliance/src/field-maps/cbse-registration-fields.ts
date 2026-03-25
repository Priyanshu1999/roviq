/**
 * CBSE Class 9/11 Registration field mapping (PRD Part 5 §3.1).
 *
 * Fields required for Pariksha Sangam portal submission.
 */

export interface CbseRegistrationFieldDef {
  header: string;
  source: string;
  required: boolean;
}

export const CBSE_REGISTRATION_FIELDS: Record<string, CbseRegistrationFieldDef> = {
  /** Full name in capitals, no abbreviations */
  fullName: {
    header: 'Student Name (CAPITALS)',
    source: 'user_profiles.first_name + last_name UPPER()',
    required: true,
  },
  /** Mother's name */
  motherName: {
    header: "Mother's Name",
    source: 'guardian_profiles (mother) user_profiles',
    required: true,
  },
  /** Father's/Guardian's name */
  fatherName: {
    header: "Father's/Guardian's Name",
    source: 'guardian_profiles (father/legal_guardian) user_profiles',
    required: true,
  },
  /** DD/MM/YYYY */
  dateOfBirth: { header: 'Date of Birth', source: 'user_profiles.date_of_birth', required: true },
  /** male/female/transgender */
  gender: { header: 'Gender', source: 'user_profiles.gender', required: true },
  /** 12-digit APAAR; "REFUSED" if consent denied; "NOGEN" if technical failure */
  apaarId: {
    header: 'APAAR ID',
    source: 'user_identifiers(type=apaar) or "REFUSED"/"NOGEN"',
    required: true,
  },
  /** 3-digit CBSE subject code */
  subjectCode1: {
    header: 'Subject Code 1',
    source: 'subjects.board_code via student subject mapping',
    required: true,
  },
  subjectCode2: { header: 'Subject Code 2', source: 'subjects.board_code', required: true },
  subjectCode3: { header: 'Subject Code 3', source: 'subjects.board_code', required: true },
  subjectCode4: { header: 'Subject Code 4', source: 'subjects.board_code', required: true },
  subjectCode5: { header: 'Subject Code 5', source: 'subjects.board_code', required: true },
  subjectCode6: { header: 'Subject Code 6', source: 'subjects.board_code', required: false },
  subjectCode7: { header: 'Subject Code 7', source: 'subjects.board_code', required: false },
  /** CWSN disability type if applicable */
  cwsnStatus: { header: 'CWSN Status', source: 'student_profiles.cwsn_type', required: false },
  /** 10-digit Indian mobile */
  mobile: { header: 'Mobile Number', source: 'phone_numbers.number', required: true },
  /** Email */
  email: { header: 'Email', source: 'users.email', required: false },
  /** Guardian annual income */
  annualIncome: {
    header: 'Annual Income',
    source: 'guardian_profiles.annual_income',
    required: false,
  },
} as const;

export const CBSE_REGISTRATION_HEADERS = Object.values(CBSE_REGISTRATION_FIELDS).map(
  (f) => f.header,
);
