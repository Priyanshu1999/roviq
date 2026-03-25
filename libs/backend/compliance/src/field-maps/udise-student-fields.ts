/**
 * UDISE+ DCF Student field mapping (PRD Part 5 §2.1).
 *
 * Maps Roviq DB fields to UDISE+ Data Capture Format column headers.
 * 21 fields covering GP (General Profile), EP (Enrollment Profile) sections.
 */

export interface UdiseStudentFieldDef {
  /** Column header in the exported XLSX */
  header: string;
  /** UDISE+ section: GP (General Profile), EP (Enrollment Profile) */
  section: 'GP' | 'EP';
  /** Source table.column or description of how to derive the value */
  source: string;
}

/**
 * All 21 UDISE+ student fields in export order.
 * Each key is the internal field name used in the export row.
 */
export const UDISE_STUDENT_FIELDS: Record<string, UdiseStudentFieldDef> = {
  /** 1. Student Name — user_profiles.first_name + last_name */
  studentName: {
    header: 'Student Name',
    section: 'GP',
    source: 'user_profiles.first_name + last_name',
  },
  /** 2. Father's Name — via student_guardian_links (father) + user_profiles */
  fatherName: {
    header: "Father's Name",
    section: 'GP',
    source: 'student_guardian_links → guardian user_profiles (father)',
  },
  /** 3. Mother's Name — via student_guardian_links (mother) + user_profiles */
  motherName: {
    header: "Mother's Name",
    section: 'GP',
    source: 'student_guardian_links → guardian user_profiles (mother)',
  },
  /** 4. Date of Birth — user_profiles.date_of_birth */
  dateOfBirth: { header: 'Date of Birth', section: 'GP', source: 'user_profiles.date_of_birth' },
  /** 5. Gender — user_profiles.gender */
  gender: { header: 'Gender', section: 'GP', source: 'user_profiles.gender' },
  /** 6. Aadhaar Number (masked) — user_identifiers(type=aadhaar).value_masked */
  aadhaarMasked: {
    header: 'Aadhaar Number',
    section: 'GP',
    source: 'user_identifiers(type=aadhaar).value_masked',
  },
  /** 7. Mother Tongue — user_profiles.mother_tongue */
  motherTongue: { header: 'Mother Tongue', section: 'GP', source: 'user_profiles.mother_tongue' },
  /** 8. Social Category — student_profiles.social_category */
  socialCategory: {
    header: 'Social Category',
    section: 'EP',
    source: 'student_profiles.social_category',
  },
  /** 9. Minority Status — student_profiles.minority_type */
  minorityStatus: {
    header: 'Minority Status',
    section: 'EP',
    source: 'student_profiles.minority_type',
  },
  /** 10. Is BPL — student_profiles.is_bpl */
  isBpl: { header: 'Is BPL', section: 'EP', source: 'student_profiles.is_bpl' },
  /** 11. Is CWSN — student_profiles.is_cwsn */
  isCwsn: { header: 'Is CWSN', section: 'EP', source: 'student_profiles.is_cwsn' },
  /** 12. CWSN Type — student_profiles.cwsn_type */
  cwsnType: { header: 'CWSN Type', section: 'EP', source: 'student_profiles.cwsn_type' },
  /** 13. Is RTE Admitted — student_profiles.is_rte_admitted */
  isRteAdmitted: {
    header: 'RTE Admitted',
    section: 'EP',
    source: 'student_profiles.is_rte_admitted',
  },
  /** 14. Class — student_academics.standard → standard name */
  className: {
    header: 'Class',
    section: 'EP',
    source: 'student_academics.standard_id → standards.name',
  },
  /** 15. Section — student_academics.section → section name */
  sectionName: {
    header: 'Section',
    section: 'EP',
    source: 'student_academics.section_id → sections.name',
  },
  /** 16. Admission Number — student_profiles.admission_number */
  admissionNumber: {
    header: 'Admission Number',
    section: 'EP',
    source: 'student_profiles.admission_number',
  },
  /** 17. Stream (Class 11-12) — student_profiles.stream */
  stream: { header: 'Stream', section: 'EP', source: 'student_profiles.stream' },
  /** 18. Medium of Instruction — sections.medium_of_instruction */
  mediumOfInstruction: {
    header: 'Medium of Instruction',
    section: 'EP',
    source: 'sections.medium_of_instruction',
  },
  /** 19. Previous Year Status — computed from prior student_academics */
  previousYearStatus: {
    header: 'Previous Year Status',
    section: 'EP',
    source: 'prior student_academics.promotion_status',
  },
  /** 20. APAAR ID — user_identifiers(type=apaar).value_plain */
  apaarId: {
    header: 'APAAR ID',
    section: 'GP',
    source: 'user_identifiers(type=apaar).value_plain',
  },
  /** 21. PEN — user_identifiers(type=pen).value_plain */
  pen: { header: 'PEN', section: 'GP', source: 'user_identifiers(type=pen).value_plain' },
} as const;

/** Ordered list of UDISE+ student column headers for XLSX export */
export const UDISE_STUDENT_HEADERS = Object.values(UDISE_STUDENT_FIELDS).map((f) => f.header);
