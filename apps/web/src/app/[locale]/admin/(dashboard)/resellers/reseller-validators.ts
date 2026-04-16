/**
 * Shared client-side validation primitives for the reseller admin surface.
 * Patterns mirror the backend DTOs so the client can give immediate feedback
 * that won't be contradicted by the server.
 */

/**
 * Hostname labels: 1-63 chars, alphanumeric + internal hyphens, no leading or
 * trailing hyphen. Combined with the TLD requirement, this matches the subset
 * of `validator.js` @IsFQDN({ require_tld: true }) that the backend enforces
 * on `customDomain`. Anchored, max 253 chars total.
 */
const HOSTNAME_LABEL = '(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)';
export const FQDN_RE = new RegExp(`^${HOSTNAME_LABEL}(?:\\.${HOSTNAME_LABEL})*\\.[a-zA-Z]{2,63}$`);

export const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * http/https URL — loose enough to accept the common cases (branding logos
 * hosted on CDNs, HTTPS favicons) without pulling a full URL parser client-side.
 * Server enforces the canonical check via class-validator @IsUrl.
 */
export const HTTP_URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

/**
 * Returns `true` when every branding slot is empty/undefined. Used on submit
 * to decide whether to omit the `branding` key entirely — sending `{}` would
 * overwrite a previously-set branding row with an empty object on the server.
 */
export function isBrandingEmpty(
  b:
    | {
        logoUrl?: string | null;
        faviconUrl?: string | null;
        primaryColor?: string | null;
        secondaryColor?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!b) return true;
  return !b.logoUrl && !b.faviconUrl && !b.primaryColor && !b.secondaryColor;
}

/**
 * Strips empty-string/null values from a branding draft and returns either
 * the compact object or `undefined` when nothing was set. Caller decides
 * whether to include `branding` in the mutation input.
 */
export function compactBranding(
  b:
    | {
        logoUrl?: string | null;
        faviconUrl?: string | null;
        primaryColor?: string | null;
        secondaryColor?: string | null;
      }
    | null
    | undefined,
):
  | { logoUrl?: string; faviconUrl?: string; primaryColor?: string; secondaryColor?: string }
  | undefined {
  if (isBrandingEmpty(b)) return undefined;
  const out: {
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  } = {};
  if (b?.logoUrl) out.logoUrl = b.logoUrl;
  if (b?.faviconUrl) out.faviconUrl = b.faviconUrl;
  if (b?.primaryColor) out.primaryColor = b.primaryColor;
  if (b?.secondaryColor) out.secondaryColor = b.secondaryColor;
  return out;
}
