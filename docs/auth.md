# Authentication & Authorization

## Recent additions

- **ROV-93** — Scope-prefixed impersonation mutations. The flat `startImpersonation` / `verifyImpersonationOtp` / `endImpersonation` resolvers are gone. Each scope owns its own mutations (see Impersonation).
- **ROV-94** — Cross-scope impersonation OTP gate. Reseller-scope impersonation always requires an OTP; platform-scope honours the new `institutes.require_impersonation_consent` boolean.
- **ROV-96** — `mustChangePassword` invariant + `MustChangePasswordGuard`. Every login that flips the JWT bit forces the user through `changePassword` before any other resolver responds.
- **ROV-209** — Brute-force lockout via `LoginLockoutService` (Redis sliding window) + `IdentityService` boundary for all user/membership writes.

## Data Model

- **User** — platform-level (no RLS), globally unique username/email. No tenantId/roleId.
- **Membership** — three types, each linking User to a scope:
  - `platform_memberships` — User↔Platform role (1:1 per user)
  - `reseller_memberships` — User↔Reseller with role
  - `memberships` — User↔Institute with role. Tenant-scoped (RLS). Holds per-member `abilities` overrides.
- **AuthProvider** — platform-level, tracks auth methods per user (password, passkey, OAuth — future).
- **RefreshToken** — stores `membership_scope` ('platform'|'reseller'|'institute') + `membership_id` (polymorphic, references the scope's membership table).

Design doc: `docs/plans/2026-03-06-user-identity-auth-redesign.md`

## Auth Flow (Three-Scope Model)

Three separate login mutations, one per portal:

### Admin Portal: `adminLogin(username, password)`
1. Verifies credentials
2. Looks up `platform_memberships` for user
3. No membership → "No account found" (same error as wrong password)
4. Issues scope=platform access token (5min TTL) + refresh token

### Reseller Portal: `resellerLogin(username, password)`
1. Verifies credentials
2. Looks up `reseller_memberships` for user
3. Checks reseller is active (`is_active = true`, `status = 'active'`)
4. Issues scope=reseller access token (10min TTL) + refresh token

### Institute Portal: `instituteLogin(username, password)`
1. Verifies credentials
2. Looks up active `memberships` (institute-scoped) for user
3. **Single membership:** issues scope=institute access token (15min TTL) + refresh token
4. **Multiple memberships:** returns `requiresInstituteSelection: true` + membership list for picker
5. User calls `selectInstitute(membershipId)` → issues scoped tokens

### Institute Switching
- `switchInstitute(membershipId)` — revokes old refresh token, issues new tokens. No re-auth.

## JWT Structure

All tokens are `type: 'access'` — no more separate 'platform' type.

- **Access token:** `{ sub, scope, tenantId?, resellerId?, membershipId, roleId, mustChangePassword?, type: 'access' }`
  - TTL: platform 5m, reseller 10m, institute 15m
  - `mustChangePassword: true` is set when the user's `users.must_change_password` column is true (see [First-Login Password Change](#first-login-password-change-rov-96)).
- **Impersonation token:** same as access + `{ isImpersonated, impersonatorId, impersonationSessionId }`
  - TTL: 15m, non-renewable (no refresh token created)
- **Refresh token:** `{ sub, tokenId, membershipId, type: 'refresh' }` — 7d TTL

### Token Refresh
- Refresh token rotation: each use invalidates the old token and issues a new pair (reason `rotation`)
- Reason-aware revocation: `refresh_tokens.revoked_reason` records why a row was revoked. Every revocation path tags itself so the reuse-detection cascade can tell a rotation-replay attack from a late client retry. Values:
  - `rotation` — normal rotate-then-reuse signal. Replay triggers the cascade.
  - `user_initiated` — `logout`, `revokeSession`, `revokeAllOtherSessions`, scope switch (`switchInstitute`).
  - `password_change` — emitted by `changePassword` when it nukes every outstanding session.
  - `admin_revoked` — admin-driven revocation from the admin UI.
  - `NULL` — legacy rows from before the column existed. Treated like `rotation` (cascade) so older data drains out safely.
- Reuse detection: if a revoked token is presented, the cascade (revoke every refresh token for the user) fires ONLY when `revoked_reason` is `rotation` or `NULL`. All other reasons raise `UnauthorizedException('Refresh token revoked')` and leave sibling sessions alive — replaying a logged-out/password-changed/admin-revoked token must not log the user out of every live device.
- Password change invalidation: `password_changed_at > token.created_at` → reject + revoke (reason `password_change`).
- Scope-aware re-issue: checks the correct membership table based on stored `membership_scope`.

`RefreshTokenRevokeReason` is exported from `apps/api-gateway/src/auth/repositories/refresh-token.repository.ts` — every `revoke`/`revokeAllForUser`/`revokeAllOtherForUser` call must pass one of the four values.

## Scope Guards

Class-level decorators from `@roviq/auth-backend`:

- `@PlatformScope()` — rejects if `user.scope !== 'platform'`
- `@ResellerScope()` — rejects if `user.scope !== 'reseller'`
- `@InstituteScope()` — rejects if `user.scope !== 'institute'`

Applied at resolver class level. Combines `GqlAuthGuard` (JWT validation) + scope check.

## Protected Routes
- Backend: `@InstituteScope()` / `@PlatformScope()` / `@ResellerScope()` on resolver classes
- Frontend: `<ProtectedRoute>` component redirects to `/login` with return URL

## Session Management

- `mySessions` query — returns active refresh tokens with device_info, ip, last_used_at
- `revokeSession(sessionId)` — revoke a specific session (reason `user_initiated`)
- `revokeAllOtherSessions` — revoke every refresh token for the user EXCEPT the caller's current one (reason `user_initiated`). The caller keeps working on the same token; crucially, the `user_initiated` reason means a stale client replaying one of the killed tokens will hit `Refresh token revoked` without triggering the rotation-reuse cascade (see [Token Refresh](#token-refresh)), so the caller's keep-alive session is not collaterally killed.
- `changePassword` — in addition to clearing the password, revokes every refresh token for the user with reason `password_change`. Cascading is deliberately suppressed for the same reason: a late client retry after a password change should just fail, not replay-attack-cascade.

## First-Login Password Change (ROV-96)

Every newly-provisioned user is born with `users.must_change_password = true` and is forced through `changePassword` before any other resolver responds.

- **DB column** — `users.must_change_password BOOLEAN NOT NULL DEFAULT false`. `IdentityService.createUser` sets it to `true`; `AuthService.changePassword` clears it (and bumps `password_changed_at`, which invalidates outstanding refresh tokens).
- **JWT claim** — when the column is true, the access token includes `mustChangePassword: true`. `JwtStrategy` copies it onto `req.user`.
- **Guard** — `MustChangePasswordGuard` is registered as an `APP_GUARD`. It runs after `GqlAuthGuard`. If `req.user.mustChangePassword === true` and the handler is not whitelisted, it throws:

  ```ts
  throw new ForbiddenException({
    code: 'PASSWORD_CHANGE_REQUIRED',
    message: 'You must change your password before continuing.',
  });
  ```

- **Whitelist** — handlers decorated with `@AllowWhenPasswordChangeRequired()` are reachable while the bit is set. Currently: `changePassword`, `logout`, `me`. Add the decorator on any future handler the change-password screen needs to call.
- **Frontend contract** — on receiving `code: 'PASSWORD_CHANGE_REQUIRED'` the web app redirects to `/auth/change-password`. The screen calls `changePassword(currentPassword, newPassword)`; the next access token will not carry the bit.

## Brute-Force Lockout (ROV-209)

`LoginLockoutService` tracks failed login attempts in Redis using a sliding window and locks the account after a threshold.

| Redis key | TTL | Purpose |
|---|---|---|
| `auth:failed-login:<usernameLower>` | `FAILURE_WINDOW_SECONDS` | Failure counter; each new failure rewrites the key and extends the TTL (sliding window). |
| `auth:locked:<usernameLower>` | `LOCKOUT_DURATION_SECONDS` | Hard lock. While present, every login attempt is rejected before the password is even checked. |

| Env var | Default | Notes |
|---|---|---|
| `MAX_LOGIN_ATTEMPTS` | `5` | Failures inside the window before the lock fires. |
| `LOCKOUT_DURATION_SECONDS` | `1800` (30 min) | Lock TTL. |
| `FAILURE_WINDOW_SECONDS` | `900` (15 min) | Sliding-window length for the failure counter. |

Behaviour:

- On the `MAX_LOGIN_ATTEMPTS`-th failure the service writes the lock key and emits an `account_locked` row into `auth_events`.
- A successful login clears `auth:failed-login:*` but **leaves any active lock in place** — a stale success cannot rescue a locked account, the lock TTL must elapse.
- Locked-account login response:

  ```ts
  throw new UnauthorizedException({
    code: 'ACCOUNT_LOCKED',
    message: 'Too many attempts. Try again in 30 minutes.',
  });
  ```

- Username matching is case-insensitive (`usernameLower`) so attackers cannot defeat the counter by toggling case.

## Impersonation

> Source-of-truth detail: `docs/plans/auth-final-prd.md` §12.

### Mutations (ROV-93)

The flat impersonation resolver is gone. Each scope owns its own mutations and the only resolver kept on `auth/impersonation.resolver.ts` is the unauthenticated code-exchange endpoint.

| Scope | Start | Verify OTP | End |
|---|---|---|---|
| platform | `adminStartImpersonation` | `adminVerifyImpersonationOtp` | `adminEndImpersonation` |
| reseller | `resellerStartImpersonation` | `resellerVerifyImpersonationOtp` | `resellerEndImpersonation` |
| institute | `impersonateUser` | _n/a (no OTP gate)_ | `endImpersonation` |
| _(unauthenticated)_ | `exchangeImpersonationCode` | — | — |

Update any tooling, sequence diagrams, or audit-log filters that referred to the old flat names.

### OTP Gate (ROV-94)

A new `institutes.require_impersonation_consent BOOLEAN NOT NULL DEFAULT false` column drives the OTP gate together with the impersonator's scope:

| Impersonator scope | OTP required? |
|---|---|
| Reseller | Always |
| Platform | Only when target institute has `require_impersonation_consent = true` |
| Institute (intra-institute) | Never (CASL ability + role hierarchy still apply) |

Flow when the OTP gate fires:

1. Caller invokes `<scope>StartImpersonation(input)`.
2. Backend creates the `impersonation_sessions` row, generates a 6-digit OTP, stores it at Redis key `impersonation-otp:{sessionId}` with `EX 300` (5 min), and emits `NOTIFICATION.auth.security` with `eventType: 'IMPERSONATION_OTP'`. The notification-service delivers it to the institute admin via Novu.
3. Resolver returns `{ sessionId, requiresOtp: true }` instead of `{ code }`.
4. Institute admin reads the OTP and shares it with the impersonator out-of-band.
5. Caller submits `<scope>VerifyImpersonationOtp(sessionId, otp)`.
   - Wrong OTP increments an attempt counter; after **3 wrong attempts** the OTP key is invalidated and the session is marked failed.
   - Correct OTP returns the same `{ code }` payload the no-OTP path returns and the existing new-tab exchange flow takes over.
6. When OTP is not required (institute has consent disabled and impersonator is platform), `startImpersonation` returns `{ code, requiresOtp: false }` directly.

### Session Revocation Guard

`ImpersonationSessionGuard` (in `apps/api-gateway/src/auth/middleware/impersonation-session.guard.ts`) is registered as an `APP_GUARD` and short-circuits any request whose bearer token carries a revoked or expired impersonation session.

Because `APP_GUARD` runs BEFORE the per-resolver `GqlAuthGuard` has populated `req.user` (via passport-jwt), the guard cannot rely on `req.user` for HTTP requests. It therefore self-verifies the JWT from the `Authorization: Bearer …` header using `JWT_SECRET` and reads the impersonation claims directly. An earlier version only read `req.user` and silently no-op'd on the HTTP path, so `endImpersonation` never actually stopped in-flight impersonation tokens — fixed by the header-fallback decode. The subscription path still reads `req.user` because graphql-ws has no Authorization header and the `onConnect`/`context()` wrapper in `app.module.ts` is the authoritative source there.

`endImpersonation` writes both a cache `del` AND a `${key}:tombstone` marker (TTL > session cache TTL) so a concurrent guard mid-lookup can't repopulate a stale "not-ended" entry. The tombstone is checked before the cache read.

## IdentityService Boundary (ROV-209)

Institute services (student, staff, guardian, admission, …) and Temporal activities **must not** write to `users`, `memberships`, `platform_memberships`, or `reseller_memberships` directly. All identity writes go through `IdentityService` (DI provider in `AuthModule`):

- Argon2id-hashes a freshly-generated temporary password.
- Inserts the `users` row with `must_change_password = true`.
- Creates the appropriate membership row(s) inside the same transaction wrapper.
- Emits `NOTIFICATION.user.created` so the notification-service can deliver welcome credentials (Roviq ID + temp password) via Novu.

This gives us one place to enforce password policy, audit the creation event, and (in future) plug in passkey provisioning. Reviews should reject any new `db.insert(users)` / `db.insert(memberships)` outside `auth/identity.service.ts`.

## CASL Authorization

### Backend
- `AbilityFactory` creates abilities per request from `Membership.abilities` + `Role.abilities`
- `@CheckAbility(action, subject)` decorator + `AbilityGuard` for resolver-level checks
- `@CurrentAbility()` param decorator for imperative checks in resolver body
- Role abilities cached in Redis with key `casl:role:{roleId}`, 5-minute TTL
- Platform scope: `manage:all` (no DB lookup)

### Frontend
- `AbilityProvider` hydrates CASL ability from login response
- `<Can I="create" a="Student">` for conditional rendering
- `useAbility()` hook for imperative checks
- `<RouteGuard action="read" subject="User">` for page-level access control

### Default Roles

| Scope | Role | Abilities |
|-------|------|-----------|
| platform | platform_admin | manage all |
| platform | platform_support | read all + impersonate |
| reseller | reseller_full_admin | manage institutes, manage team, impersonate |
| reseller | reseller_support_admin | read-only + impersonation |
| reseller | reseller_viewer | read stats |
| institute | institute_admin | manage all (within tenant) |
| institute | teacher | read students/sections/standards/subjects/timetables, CRU attendance |
| institute | student | read timetable/subjects, read own attendance |
| institute | parent | read timetable/attendance/students |
