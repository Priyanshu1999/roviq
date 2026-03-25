/**
 * UDISE+ DCF Teacher field mapping (PRD Part 5 §2.2).
 *
 * 12 teacher fields for UDISE+ Data Capture Format export.
 */

export interface UdiseTeacherFieldDef {
  header: string;
  source: string;
}

export const UDISE_TEACHER_FIELDS: Record<string, UdiseTeacherFieldDef> = {
  /** 1. Teacher Name */
  teacherName: { header: 'Teacher Name', source: 'user_profiles.first_name + last_name' },
  /** 2. Aadhaar (masked) */
  aadhaarMasked: {
    header: 'Aadhaar Number',
    source: 'user_identifiers(type=aadhaar).value_masked',
  },
  /** 3. Date of Birth */
  dateOfBirth: { header: 'Date of Birth', source: 'user_profiles.date_of_birth' },
  /** 4. Gender */
  gender: { header: 'Gender', source: 'user_profiles.gender' },
  /** 5. Social Category */
  socialCategory: { header: 'Social Category', source: 'staff_profiles.social_category' },
  /** 6. Nature of Appointment */
  natureOfAppointment: {
    header: 'Nature of Appointment',
    source: 'staff_profiles.nature_of_appointment',
  },
  /** 7. Date of Joining */
  dateOfJoining: { header: 'Date of Joining', source: 'staff_profiles.date_of_joining' },
  /** 8. Academic Qualification (highest) */
  academicQualification: {
    header: 'Academic Qualification',
    source: 'staff_qualifications(type=academic) highest',
  },
  /** 9. Professional Qualification */
  professionalQualification: {
    header: 'Professional Qualification',
    source: 'staff_qualifications(type=professional)',
  },
  /** 10. Trained for CWSN */
  trainedForCwsn: { header: 'Trained for CWSN', source: 'staff_profiles.trained_for_cwsn' },
  /** 11. Is Disabled */
  isDisabled: { header: 'Is Disabled', source: 'staff_profiles.is_disabled' },
  /** 12. Current Designation */
  designation: { header: 'Current Post Held', source: 'staff_profiles.designation' },
} as const;

export const UDISE_TEACHER_HEADERS = Object.values(UDISE_TEACHER_FIELDS).map((f) => f.header);
