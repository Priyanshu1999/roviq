/**
 * Date-range helpers used by holiday / leave / academic-year / attendance
 * code paths. Centralised so the `YYYY-MM-DD` + UTC-midnight assumption is
 * declared in exactly one place and a future change (half-day leaves,
 * timezone-aware ranges, etc.) lands here instead of drifting between
 * services. Pure functions — no DI, no I/O.
 *
 * Roviq business rules use **inclusive calendar days**:
 *   - May 1 → May 1   = 1 calendar day
 *   - May 1 → May 2   = 2 calendar days
 *   - May 1 → May 3   = 3 calendar days
 *
 * The midnight-difference (May 3 - May 1 = 2 days) is *not* the same thing
 * and was the source of HL-002 in docs/composer-reviews.
 */

const MS_PER_DAY = 86_400_000;

/** Parse a `YYYY-MM-DD` string as UTC midnight (the project's canonical form). */
function parseUtcMidnight(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

/**
 * Inclusive calendar-day count between two `YYYY-MM-DD` strings.
 * Returns 0 when start > end (caller should validate range first).
 */
export function calendarDaysBetween(startIso: string, endIso: string): number {
  const start = parseUtcMidnight(startIso);
  const end = parseUtcMidnight(endIso);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error(
      `calendarDaysBetween expects YYYY-MM-DD; got start="${startIso}" end="${endIso}"`,
    );
  }
  if (end < start) return 0;
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

/**
 * Returns true when `endIso` is the same day or later than `startIso`.
 * The shape callers asserting `assertValidRange` were duplicating.
 */
export function isValidDateRange(startIso: string, endIso: string): boolean {
  const start = parseUtcMidnight(startIso);
  const end = parseUtcMidnight(endIso);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error(`isValidDateRange expects YYYY-MM-DD; got start="${startIso}" end="${endIso}"`);
  }
  return end >= start;
}

/**
 * Returns true when the two ranges overlap (inclusive on both ends).
 *
 *   rangesOverlap('2026-04-01', '2026-04-10', '2026-04-10', '2026-04-20') === true
 *
 * Used by academic-year overlap validation and could be used by holiday/
 * attendance code that asks "does this date fall inside any range?".
 */
export function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return (
    parseUtcMidnight(startA) <= parseUtcMidnight(endB) &&
    parseUtcMidnight(endA) >= parseUtcMidnight(startB)
  );
}
