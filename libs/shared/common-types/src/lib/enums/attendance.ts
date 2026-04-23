// ─── AttendanceStatus ─────────────────────────────────────────────────────────

export const ATTENDANCE_STATUS_VALUES = [
  // Student was physically present in class
  'PRESENT',
  // Student was absent without an approved leave on record
  'ABSENT',
  // Student was absent and a leave is approved for the date
  'LEAVE',
  // Student arrived late but was present
  'LATE',
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUS_VALUES)[number];

export const AttendanceStatus = Object.fromEntries(ATTENDANCE_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in AttendanceStatus]: K;
};

// ─── AttendanceMode ───────────────────────────────────────────────────────────

export const ATTENDANCE_MODE_VALUES = [
  // Teacher marked manually from the UI
  'MANUAL',
  // Marked from a mobile app (student or teacher)
  'APP',
  // Marked via biometric device (fingerprint / face)
  'BIOMETRIC',
  // Imported in bulk from an external system
  'IMPORT',
] as const;

export type AttendanceMode = (typeof ATTENDANCE_MODE_VALUES)[number];

export const AttendanceMode = Object.fromEntries(ATTENDANCE_MODE_VALUES.map((v) => [v, v])) as {
  readonly [K in AttendanceMode]: K;
};
