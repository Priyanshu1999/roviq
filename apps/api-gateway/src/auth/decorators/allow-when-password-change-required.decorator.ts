import { SetMetadata } from '@nestjs/common';

/**
 * ROV-96 — first-login enforcement bypass marker.
 *
 * MustChangePasswordGuard blocks every authenticated request when the user has
 * `mustChangePassword = true`. A handful of operations (the password change
 * mutation itself, logout, "me" query) need to remain reachable so the user can
 * actually rotate their temp password and see who they are. Mark those handlers
 * (or whole resolvers) with this decorator to opt out of the block.
 */
export const ALLOW_WHEN_PASSWORD_CHANGE_REQUIRED = 'allow-when-password-change-required';

export const AllowWhenPasswordChangeRequired = () =>
  SetMetadata(ALLOW_WHEN_PASSWORD_CHANGE_REQUIRED, true);
