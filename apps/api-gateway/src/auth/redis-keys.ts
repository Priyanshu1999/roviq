export const REDIS_KEYS = {
  IMPERSONATION_CODE: 'impersonation-code:',
  IMPERSONATION_SESSION: 'impersonation-session:',
  IMPERSONATION_OTP: 'impersonation-otp:',
  WS_TICKET: 'ws-ticket:',
  /** Sliding-window counter for failed login attempts, keyed by lowercased username. EX = FAILURE_WINDOW_SECONDS. */
  LOGIN_FAILURES: 'auth:failed-login:',
  /** Active lockout marker for a username. Presence ⇒ login is blocked for LOCKOUT_DURATION_SECONDS. */
  LOGIN_LOCKED: 'auth:locked:',
} as const;
