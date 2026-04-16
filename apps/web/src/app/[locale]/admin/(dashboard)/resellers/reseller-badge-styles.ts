import type { ResellerStatus, ResellerTier } from './types';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export const STATUS_VARIANT: Record<ResellerStatus, BadgeVariant> = {
  ACTIVE: 'default',
  SUSPENDED: 'destructive',
  DELETED: 'outline',
};

export const STATUS_CLASS: Record<ResellerStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  SUSPENDED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  DELETED: 'bg-gray-100 text-gray-500 line-through dark:bg-gray-800 dark:text-gray-400',
};

export const TIER_CLASS: Record<ResellerTier, string> = {
  FULL_MANAGEMENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  SUPPORT_MANAGEMENT: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  READ_ONLY: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

/**
 * Returns the color only if it matches the hex-6 pattern. Defense-in-depth:
 * backend validates on write, but a poisoned row should not smuggle arbitrary
 * CSS (e.g. `red; background-image:url(...)`) into inline styles.
 */
export function safeHexColor(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return HEX_COLOR_RE.test(value) ? value : undefined;
}
