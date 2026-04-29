// ─── HolidayType ──────────────────────────────────────────────────────────────

export const HOLIDAY_TYPE_VALUES = [
  // National holiday — Republic Day, Independence Day, Gandhi Jayanti, etc.
  'NATIONAL',
  // State-specific public holiday declared by a state government
  'STATE',
  // Religious festival — Diwali, Eid, Christmas, etc.
  'RELIGIOUS',
  // Tenant-declared closure (staff day, inspection, weather, etc.)
  'INSTITUTE',
  // Multi-week summer break / vacation
  'SUMMER_BREAK',
  // Multi-week winter break / vacation
  'WINTER_BREAK',
  // Catch-all when none of the above applies
  'OTHER',
] as const;

export type HolidayType = (typeof HOLIDAY_TYPE_VALUES)[number];

export const HolidayType = Object.fromEntries(HOLIDAY_TYPE_VALUES.map((v) => [v, v])) as {
  readonly [K in HolidayType]: K;
};
