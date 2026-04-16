/**
 * Institute-timezone helpers. Use `getInstituteToday(institute)` instead of
 * `new Date()` for any calendar-day logic (attendance cutoffs, report date
 * ranges, "today"/"this week"/"this month" boundaries) so the result follows
 * institute-local wall-clock time rather than the server's UTC clock.
 */

import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

const DEFAULT_INSTITUTE_TIMEZONE = 'Asia/Kolkata';

/**
 * Minimal shape required by the timezone helpers. Pass a row from the
 * `institutes` table (or any object exposing a `timezone` string).
 */
export interface InstituteTzShape {
  readonly timezone: string | null | undefined;
}

function resolveTimezone(institute: InstituteTzShape): string {
  const tz = institute.timezone;
  if (tz === null || tz === undefined || tz === '') {
    return DEFAULT_INSTITUTE_TIMEZONE;
  }
  return tz;
}

/**
 * Returns a JS `Date` whose wall-clock components (hours/minutes/date-of-month)
 * reflect the institute's local time at this instant. The underlying UTC
 * timestamp is shifted so that `.getHours()`, `.getDate()`, etc. report the
 * institute-local values — convenient for day-of-week / hour-of-day logic.
 *
 * Falls back to `Asia/Kolkata` if the institute row has a missing timezone.
 */
export function getInstituteNow(institute: InstituteTzShape): Date {
  return toZonedTime(new Date(), resolveTimezone(institute));
}

/**
 * Returns the institute's current calendar day as an ISO date string
 * (`YYYY-MM-DD`), computed in the institute's timezone. This is the value you
 * want when keying per-day partitions, attendance records, or daily reports.
 *
 * Falls back to `Asia/Kolkata` if the institute row has a missing timezone.
 */
export function getInstituteToday(institute: InstituteTzShape): string {
  return formatInTimeZone(new Date(), resolveTimezone(institute), 'yyyy-MM-dd');
}
