# Authentication & Authorization

## Auth Flow

```
Login → JWT access token (15m) + refresh token (7d) → CASL ability rules
```

### Login
1. Client sends `login(username, password, tenantId)` mutation
2. Server finds user by username + tenantId (admin Prisma client, bypasses RLS)
3. Verifies password with argon2id
4. Generates JWT access token (contains `sub`, `tenantId`, `roleId`)
5. Generates JWT refresh token (contains `sub`, `tokenId`), stores SHA-256 hash in DB
6. Resolves CASL ability rules (role abilities + user abilities, condition placeholders resolved)
7. Returns tokens + user + ability rules

### Token Refresh
- Refresh token rotation: each use invalidates the old token and issues a new pair
- Reuse detection: if a revoked token is presented, all tokens for that user are revoked (theft signal)
- Refresh token stored as SHA-256 hash in `refresh_tokens` table

### Protected Routes
- Backend: `@UseGuards(GqlAuthGuard)` on GraphQL resolvers
- Frontend: `<ProtectedRoute>` component redirects to `/login` with return URL

## CASL Authorization

### Backend
- `AbilityFactory` creates abilities per request from role + user rules
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
