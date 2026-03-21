# Authentication & Authorization

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

- **Access token:** `{ sub, scope, tenantId?, resellerId?, membershipId, roleId, type: 'access' }`
  - TTL: platform 5m, reseller 10m, institute 15m
- **Impersonation token:** same as access + `{ isImpersonated, impersonatorId, impersonationSessionId }`
  - TTL: 15m, non-renewable (no refresh token created)
- **Refresh token:** `{ sub, tokenId, membershipId, type: 'refresh' }` — 7d TTL

### Token Refresh
- Refresh token rotation: each use invalidates the old token and issues a new pair
- Reuse detection: if a revoked token is presented, all tokens for that user are revoked (theft signal)
- Password change invalidation: `password_changed_at > token.created_at` → reject + revoke
- Scope-aware re-issue: checks the correct membership table based on stored `membership_scope`

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
- `revokeSession(sessionId)` — revoke a specific session
- `revokeAllOtherSessions` — revoke all except current

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
