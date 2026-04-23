// ─── LeaveType ────────────────────────────────────────────────────────────────

export const LEAVE_TYPE_VALUES = [
  // Medical / sick leave; typically requires a doctor's certificate
  'MEDICAL',
  // Short personal / casual leave — household, travel, minor events
  'CASUAL',
  // Bereavement leave
  'BEREAVEMENT',
  // Examination / academic leave for students (outside exams)
  'EXAM',
  // Catch-all when no specific category fits
  'OTHER',
] as const;

export type LeaveType = (typeof LEAVE_TYPE_VALUES)[number];

export const LeaveType = Object.fromEntries(LEAVE_TYPE_VALUES.map((v) => [v, v])) as {
  readonly [K in LeaveType]: K;
};

// ─── LeaveStatus ──────────────────────────────────────────────────────────────

export const LEAVE_STATUS_VALUES = [
  // Submitted and awaiting review
  'PENDING',
  // Admin / class-teacher approved — counted as LEAVE in attendance
  'APPROVED',
  // Admin rejected the request
  'REJECTED',
  // Applicant withdrew the request before/after approval
  'CANCELLED',
] as const;

export type LeaveStatus = (typeof LEAVE_STATUS_VALUES)[number];

export const LeaveStatus = Object.fromEntries(LEAVE_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in LeaveStatus]: K;
};
