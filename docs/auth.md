# Authentication & Authorization

## Data Model

- **User** — platform-level (no RLS), globally unique username/email. No tenantId/roleId.
- **Membership** — links User↔Institute with a role. Tenant-scoped (RLS). Holds per-member `abilities` overrides.
- **AuthProvider** — platform-level, tracks auth methods per user (password, passkey, OAuth — future).
- **RefreshToken** — tenant-scoped, references both User and Membership.

Design doc: `docs/plans/2026-03-06-user-identity-auth-redesign.md`

## Auth Flow

```
Login (username + password) → single org: tenant JWT directly
                            → multi-institute: platform token (5min) + institute picker → selectInstitute → tenant JWT
```

### Login
1. Client sends `login(username, password)` mutation — no org ID needed
2. Server finds user by username (admin Prisma client, bypasses RLS — User is platform-level)
3. Verifies password with argon2id
4. Fetches active memberships with institute info
5. **Single membership:** generates tenant-scoped JWT + refresh token, resolves CASL rules, returns directly
6. **Multiple memberships:** generates short-lived platform token (5min), returns with membership list

### Select Institute (multi-institute)
1. Client sends `selectInstitute(tenantId)` with platform token in Authorization header
2. Server verifies platform token, confirms active membership for (userId, tenantId)
3. Generates tenant-scoped JWT + refresh token, resolves CASL rules
4. Returns tokens + user + ability rules

### Switch Institute
- Same as selectInstitute, but uses existing access token instead of platform token
- Client swaps tokens — no re-login needed

### JWT Structure
- **Platform token:** `{ sub: userId, type: 'platform' }` — 5min TTL, cannot access tenant data
- **Access token:** `{ sub: userId, tenantId, roleId, type: 'access' }` — 15min TTL
- **Refresh token:** `{ sub: userId, tokenId, type: 'refresh' }` — 7d TTL

### Token Refresh
- Refresh token rotation: each use invalidates the old token and issues a new pair
- Reuse detection: if a revoked token is presented, all tokens for that user are revoked (theft signal)
- Refresh token stored as SHA-256 hash in `refresh_tokens` table
- RefreshToken references Membership for tenant context on refresh

### Protected Routes
- Backend: `@UseGuards(GqlAuthGuard)` on GraphQL resolvers
- Frontend: `<ProtectedRoute>` component redirects to `/login` with return URL, or `/select-org` if institute selection pending

## CASL Authorization

### Backend
- `AbilityFactory` creates abilities per request from `Membership.abilities` + `Role.abilities`
- `@CheckAbility(action, subject)` decorator + `AbilityGuard` for resolver-level checks
- `@CurrentAbility()` param decorator for imperative checks in resolver body
- Role abilities cached in Redis with key `casl:role:{roleId}`, 5-minute TTL

### Frontend
- `AbilityProvider` hydrates CASL ability from login response
- `<Can I="create" a="Student">` for conditional rendering
- `useAbility()` hook for imperative checks
- `<RouteGuard action="read" subject="User">` for page-level access control

### Default Roles

| Role | Abilities |
|------|-----------|
| institute_admin | manage all |
| teacher | read students/sections/standards/subjects/timetables, CRU attendance |
| student | read timetable/subjects, read own attendance (conditioned on `studentId = userId`) |
| parent | read timetable/attendance/students |
