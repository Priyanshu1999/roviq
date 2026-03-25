/**
 * Admission number prefix resolution (ROV-154).
 *
 * Uses institute_configs.admission_number_config to determine the prefix
 * based on the standard's numeric_order. Pre-primary classes (-3, -2, -1)
 * get prefixes like N-, L-, U-. From Class 2 onwards, no prefix by default.
 */
import type { AdmissionNumberConfig } from '@roviq/database';

/**
 * Resolve the admission number prefix for a given standard.
 *
 * @param config - The institute's admission_number_config from institute_configs
 * @param numericOrder - The numeric_order of the standard being admitted into
 * @returns The prefix string (e.g., 'N-') or empty string if no prefix
 *
 * @example
 * // Nursery (numeric_order = -3) → 'N-'
 * resolveAdmissionPrefix(config, -3)
 *
 * // Class 1 (numeric_order = 1) → 'A-'
 * resolveAdmissionPrefix(config, 1)
 *
 * // Class 5 (numeric_order = 5, no_prefix_from_class = 2) → ''
 * resolveAdmissionPrefix(config, 5)
 */
export function resolveAdmissionPrefix(
  config: AdmissionNumberConfig,
  numericOrder: number,
): string {
  // If numeric_order >= no_prefix_from_class, no prefix
  if (numericOrder >= config.no_prefix_from_class) {
    return '';
  }

  // Look up the prefix by numeric_order key
  const prefix = config.prefixes[String(numericOrder)];
  return prefix ?? '';
}

/**
 * Resolve the year portion of the admission number format.
 *
 * @param config - The institute's admission_number_config
 * @param date - The reference date (defaults to current date)
 * @returns The year string (e.g., '2025' or '25-26')
 */
export function resolveAdmissionYear(config: AdmissionNumberConfig, date = new Date()): string {
  // Indian academic year: April–March
  const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;

  if (config.year_format === 'YY-YY') {
    const short = year % 100;
    const next = (short + 1) % 100;
    return `${String(short).padStart(2, '0')}-${String(next).padStart(2, '0')}`;
  }

  // Default: YYYY
  return String(year);
}
