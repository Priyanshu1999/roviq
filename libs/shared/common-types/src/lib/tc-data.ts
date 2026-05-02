/** Snapshot of all 20+ CBSE Transfer Certificate fields frozen at generation time. */
export interface CbseTcData {
  [key: string]: string | null;
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
  /** 6b. DOB in words */
  dateOfBirthWords: string | null;
  /** 7. Whether failed, if so once/twice */
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
