# User Identity & Auth Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the data model so User is a platform entity with globally unique username/email, supporting multi-org membership and login without Organization ID.

**Architecture:** User becomes platform-level (no RLS). Membership links User↔Organization (tenant-scoped, RLS). Login returns either a tenant-scoped JWT directly (single org) or a short-lived platform token + membership list (multi-org). Frontend shows org picker when needed. Existing RLS/CASL pipeline stays unchanged — tenant-scoped JWT claims are identical.

**Tech Stack:** Prisma, PostgreSQL RLS, NestJS (code-first GraphQL), argon2, JWT, React (Next.js App Router), react-hook-form, Zod, next-intl, @roviq/ui (shadcn/ui), CASL.

**Linear Issues:** ROV-33 through ROV-48 in "User Identity & Auth Redesign" project.

**Design Doc:** `docs/plans/2026-03-06-user-identity-auth-redesign.md`

---

## Task 1: Create Membership model (ROV-34)

**Files:**
- Modify: `libs/prisma-client/prisma/schema.prisma`
- Create: `libs/prisma-client/prisma/migrations/<timestamp>_add_membership/migration.sql` (auto-generated)

**Step 1: Add Membership model to schema**

In `libs/prisma-client/prisma/schema.prisma`, add after the `Role` model:

```prisma
model Membership {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  tenantId  String   @map("tenant_id")
  roleId    String   @map("role_id")
  abilities Json?    @default("[]")
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user         User         @relation(fields: [userId], references: [id])
  organization Organization @relation(fields: [tenantId], references: [id])
  role         Role         @relation(fields: [roleId], references: [id])
  profiles     Profile[]
  refreshTokens RefreshToken[]

  @@unique([userId, tenantId])
  @@index([tenantId])
  @@index([tenantId, roleId])
  @@map("memberships")
}
```

Add `memberships Membership[]` relation to `Organization`, `Role`, and `User` models.

**Step 2: Generate migration**

```bash
cd libs/prisma-client && npx prisma migrate dev --name add_membership
```

Expected: Migration created, `memberships` table exists.

**Step 3: Add RLS policy for memberships**

Create a new migration:

```bash
cd libs/prisma-client && npx prisma migrate dev --name add_membership_rls --create-only
```

Write this SQL in the generated migration file:

```sql
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_memberships ON memberships
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

Apply:

```bash
cd libs/prisma-client && npx prisma migrate dev
```

**Step 4: Regenerate Prisma client**

```bash
npx prisma generate --schema=libs/prisma-client/prisma/schema.prisma
```

**Step 5: Commit**

```bash
git add libs/prisma-client/
git commit -m "feat(prisma): add Membership model with RLS"
```

---

## Task 2: Create Profile model (ROV-35)

**Blocked by:** Task 1

**Files:**
- Modify: `libs/prisma-client/prisma/schema.prisma`

**Step 1: Add Profile model to schema**

```prisma
model Profile {
  id           String   @id @default(uuid())
  membershipId String   @map("membership_id")
  tenantId     String   @map("tenant_id")
  type         String   // student | staff | parent | guardian
  metadata     Json?    @default("{}")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  membership       Membership        @relation(fields: [membershipId], references: [id])
  studentGuardians StudentGuardian[] @relation("StudentProfile")
  guardianStudents StudentGuardian[] @relation("GuardianProfile")

  @@unique([membershipId, type])
  @@index([tenantId])
  @@map("profiles")
}
```

**Step 2: Generate migration + RLS**

Same pattern as Task 1: `prisma migrate dev --name add_profile`, then a separate RLS migration:

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_profiles ON profiles
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

**Step 3: Regenerate client, commit**

```bash
npx prisma generate --schema=libs/prisma-client/prisma/schema.prisma
git add libs/prisma-client/
git commit -m "feat(prisma): add Profile model with RLS"
```

---

## Task 3: Create StudentGuardian model (ROV-36)

**Blocked by:** Task 2

**Files:**
- Modify: `libs/prisma-client/prisma/schema.prisma`

**Step 1: Add StudentGuardian model**

```prisma
model StudentGuardian {
  id                String   @id @default(uuid())
  studentProfileId  String   @map("student_profile_id")
  guardianProfileId String   @map("guardian_profile_id")
  tenantId          String   @map("tenant_id")
  relationship      String   // father | mother | guardian | legal_guardian
  isPrimary         Boolean  @default(false) @map("is_primary")
  isActive          Boolean  @default(true) @map("is_active")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  studentProfile  Profile @relation("StudentProfile", fields: [studentProfileId], references: [id])
  guardianProfile Profile @relation("GuardianProfile", fields: [guardianProfileId], references: [id])

  @@unique([studentProfileId, guardianProfileId])
  @@index([tenantId])
  @@map("student_guardians")
}
```

**Step 2: Migrate + RLS + regenerate + commit**

Same pattern. RLS SQL:

```sql
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_guardians FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_student_guardians ON student_guardians
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

```bash
git commit -m "feat(prisma): add StudentGuardian model with RLS"
```

---

## Task 4: Create PhoneNumber model (ROV-37)

**Files:**
- Modify: `libs/prisma-client/prisma/schema.prisma`

**Step 1: Add PhoneNumber model**

```prisma
model PhoneNumber {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  countryCode String   @map("country_code")
  number      String
  label       String   @default("personal") // personal | work | home
  isPrimary   Boolean  @default(false) @map("is_primary")
  isWhatsapp  Boolean  @default(false) @map("is_whatsapp")
  isVerified  Boolean  @default(false) @map("is_verified")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id])

  @@unique([countryCode, number])
  @@index([userId])
  @@map("phone_numbers")
}
```

Add `phoneNumbers PhoneNumber[]` to the User model.

**No RLS** — this is a platform-level table (queried via admin client).

**Step 2: Migrate + regenerate + commit**

```bash
cd libs/prisma-client && npx prisma migrate dev --name add_phone_number
npx prisma generate --schema=libs/prisma-client/prisma/schema.prisma
git commit -m "feat(prisma): add PhoneNumber model (platform-level)"
```

---

## Task 5: Create AuthProvider model (ROV-38)

**Files:**
- Modify: `libs/prisma-client/prisma/schema.prisma`

**Step 1: Add AuthProvider model**

```prisma
model AuthProvider {
  id             String   @id @default(uuid())
  userId         String   @map("user_id")
  provider       String   // password | passkey | google | microsoft | saml
  providerUserId String?  @map("provider_user_id")
  providerData   Json?    @map("provider_data")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id])

  @@unique([provider, providerUserId])
  @@index([userId])
  @@map("auth_providers")
}
```

Add `authProviders AuthProvider[]` to User model.

**No RLS** — platform-level table.

**Step 2: Migrate + regenerate + commit**

```bash
cd libs/prisma-client && npx prisma migrate dev --name add_auth_provider
npx prisma generate --schema=libs/prisma-client/prisma/schema.prisma
git commit -m "feat(prisma): add AuthProvider model (platform-level)"
```

---

## Task 6: Data migration — backfill Memberships from Users (ROV-39)

**Blocked by:** Tasks 1 and 4–5

**Files:**
- Create: `libs/prisma-client/prisma/migrations/<timestamp>_backfill_memberships/migration.sql` (manual)

**Step 1: Create empty migration**

```bash
cd libs/prisma-client && npx prisma migrate dev --name backfill_memberships --create-only
```

**Step 2: Write backfill SQL**

```sql
-- Backfill memberships from existing users
INSERT INTO memberships (id, user_id, tenant_id, role_id, abilities, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  id,
  tenant_id,
  role_id,
  COALESCE(abilities, '[]'::jsonb),
  is_active,
  created_at,
  updated_at
FROM users;

-- Backfill auth_providers for existing password-based users
INSERT INTO auth_providers (id, user_id, provider, created_at, updated_at)
SELECT
  gen_random_uuid(),
  id,
  'password',
  created_at,
  updated_at
FROM users;
```

**Step 3: Apply migration**

```bash
cd libs/prisma-client && npx prisma migrate dev
```

**Step 4: Verify backfill**

```bash
# In psql or via a script:
# SELECT COUNT(*) FROM memberships; -- should match users count
# SELECT COUNT(*) FROM auth_providers; -- should match users count
```

**Step 5: Commit**

```bash
git add libs/prisma-client/
git commit -m "feat(prisma): backfill memberships from existing users"
```

---

## Task 7: Restructure User model — remove tenant-scoped fields (ROV-33)

**Blocked by:** Task 6

**Files:**
- Modify: `libs/prisma-client/prisma/schema.prisma`

**Step 1: Update User model**

Replace the current User model with:

```prisma
model User {
  id           String   @id @default(uuid())
  username     String   @unique
  email        String   @unique
  passwordHash String   @map("password_hash")
  avatarUrl    String?  @map("avatar_url")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  phoneNumbers  PhoneNumber[]
  authProviders AuthProvider[]
  memberships   Membership[]
  refreshTokens RefreshToken[]

  @@map("users")
}
```

Removed: `tenantId`, `roleId`, `abilities`, `organization` relation, `role` relation, `@@unique([tenantId, email])`, `@@unique([tenantId, username])`, `@@index([tenantId])`, `@@index([tenantId, roleId])`.

**Step 2: Update RefreshToken to add membershipId**

```prisma
model RefreshToken {
  id           String    @id @default(uuid())
  tenantId     String    @map("tenant_id")
  userId       String    @map("user_id")
  membershipId String?   @map("membership_id")
  tokenHash    String    @map("token_hash")
  deviceInfo   String?   @map("device_info")
  expiresAt    DateTime  @map("expires_at")
  revokedAt    DateTime? @map("revoked_at")
  createdAt    DateTime  @default(now()) @map("created_at")

  user       User        @relation(fields: [userId], references: [id])
  membership Membership? @relation(fields: [membershipId], references: [id])

  @@index([tenantId])
  @@index([tokenHash])
  @@map("refresh_tokens")
}
```

**Step 3: Create migration with column drops**

```bash
cd libs/prisma-client && npx prisma migrate dev --name restructure_user --create-only
```

Review the generated SQL carefully. It should:
- Drop `tenant_id`, `role_id`, `abilities` columns from `users`
- Drop related indexes and constraints
- Add `username` unique constraint (was `(tenant_id, username)`)
- Add `email` unique constraint (was `(tenant_id, email)`)
- Add `membership_id` to `refresh_tokens`
- Remove FK from `users` to `organizations` and `roles`

**Step 4: Update RLS — remove users from RLS, keep platform-level**

Create another migration:

```bash
cd libs/prisma-client && npx prisma migrate dev --name remove_user_rls --create-only
```

```sql
-- Users is now a platform table — remove RLS
DROP POLICY IF EXISTS tenant_isolation_users ON users;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

**Step 5: Apply migrations + regenerate + commit**

```bash
cd libs/prisma-client && npx prisma migrate dev
npx prisma generate --schema=libs/prisma-client/prisma/schema.prisma
git add libs/prisma-client/
git commit -m "feat(prisma): restructure User as platform entity, remove RLS"
```

---

## Task 8: Rework login mutation — username+password only (ROV-40)

**Blocked by:** Task 7

**Files:**
- Modify: `apps/api-gateway/src/auth/auth.service.ts`
- Modify: `apps/api-gateway/src/auth/auth.resolver.ts`
- Modify: `apps/api-gateway/src/auth/dto/auth-payload.ts`
- Modify: `apps/api-gateway/src/auth/dto/register.input.ts`
- Modify: `apps/api-gateway/src/auth/__tests__/auth.service.test.ts`

**Step 1: Write failing tests**

In `apps/api-gateway/src/auth/__tests__/auth.service.test.ts`, add tests:

```typescript
describe('login (redesigned)', () => {
  it('should return tenant-scoped JWT when user has single membership', async () => {
    // Mock: user found by username (admin client, no RLS)
    // Mock: 1 active membership with org info
    // Expect: { accessToken, refreshToken, user } — token has tenantId claim
  });

  it('should return platform token + membership list when user has multiple memberships', async () => {
    // Mock: user found by username
    // Mock: 2 active memberships
    // Expect: { platformToken, memberships: [...] } — no accessToken yet
  });

  it('should reject invalid password', async () => {
    // Mock: user found, argon2 verify fails
    // Expect: UnauthorizedException
  });

  it('should reject inactive user', async () => {
    // Mock: user found but isActive=false
    // Expect: UnauthorizedException
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx nx test api-gateway -- --testPathPattern=auth.service
```

Expected: Tests fail (login method signature changed).

**Step 3: Update auth service login method**

In `apps/api-gateway/src/auth/auth.service.ts`:

```typescript
// Use admin client (no RLS) to find user by username
async login(username: string, password: string) {
  // 1. Find user by username using admin client (platform-level, no RLS)
  const user = await this.adminPrisma.user.findUnique({
    where: { username },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedException('Invalid credentials');
  }

  // 2. Verify password
  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) {
    throw new UnauthorizedException('Invalid credentials');
  }

  // 3. Fetch active memberships with org info
  const memberships = await this.adminPrisma.membership.findMany({
    where: { userId: user.id, isActive: true },
    include: {
      organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
      role: { select: { id: true, name: true, abilities: true } },
    },
  });

  if (memberships.length === 0) {
    throw new UnauthorizedException('No active memberships');
  }

  // 4. Single membership → issue tenant-scoped JWT directly
  if (memberships.length === 1) {
    const m = memberships[0];
    const accessToken = this.generateAccessToken(user.id, m.tenantId, m.roleId);
    const refreshToken = await this.createRefreshToken(user.id, m.tenantId, m.id);
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        tenantId: m.tenantId,
        roleId: m.roleId,
        abilityRules: this.mergeAbilities(m.role.abilities, m.abilities),
      },
    };
  }

  // 5. Multiple memberships → platform token + membership list
  const platformToken = this.generatePlatformToken(user.id);
  return {
    platformToken,
    memberships: memberships.map((m) => ({
      tenantId: m.tenantId,
      roleId: m.roleId,
      orgName: m.organization.name,
      orgSlug: m.organization.slug,
      orgLogoUrl: m.organization.logoUrl,
      roleName: m.role.name,
    })),
  };
}

private generatePlatformToken(userId: string): string {
  return this.jwtService.sign(
    { sub: userId, type: 'platform' },
    { expiresIn: '5m' },
  );
}

private generateAccessToken(userId: string, tenantId: string, roleId: string): string {
  return this.jwtService.sign(
    { sub: userId, tenantId, roleId, type: 'access' },
    { expiresIn: '15m' },
  );
}
```

**Step 4: Update GraphQL types**

In `apps/api-gateway/src/auth/dto/auth-payload.ts`:

```typescript
@ObjectType()
export class MembershipInfo {
  @Field()
  tenantId: string;

  @Field()
  roleId: string;

  @Field()
  orgName: string;

  @Field()
  orgSlug: string;

  @Field({ nullable: true })
  orgLogoUrl?: string;

  @Field()
  roleName: string;
}

@ObjectType()
export class LoginResult {
  @Field({ nullable: true })
  accessToken?: string;

  @Field({ nullable: true })
  refreshToken?: string;

  @Field(() => UserType, { nullable: true })
  user?: UserType;

  @Field({ nullable: true })
  platformToken?: string;

  @Field(() => [MembershipInfo], { nullable: true })
  memberships?: MembershipInfo[];
}
```

Update `UserType`: remove `tenantId` and `roleId` as top-level required fields (they come from membership context, not user identity). Keep them for backward compat in LoginResult.user but mark nullable.

**Step 5: Update resolver**

In `apps/api-gateway/src/auth/auth.resolver.ts`:

```typescript
@Mutation(() => LoginResult)
async login(
  @Args('username') username: string,
  @Args('password') password: string,
): Promise<LoginResult> {
  return this.authService.login(username, password);
}
```

Remove `tenantId` argument.

**Step 6: Remove tenantId from register input**

In `apps/api-gateway/src/auth/dto/register.input.ts`, remove `tenantId` field. Registration now creates a User (platform) only. A separate step associates them with an organization (creates Membership).

**Step 7: Run tests to verify they pass**

```bash
npx nx test api-gateway -- --testPathPattern=auth.service
```

Expected: All tests pass.

**Step 8: Commit**

```bash
git add apps/api-gateway/src/auth/
git commit -m "feat(auth): rework login to username+password only, multi-org support"
```

---

## Task 9: Add selectOrganization mutation (ROV-41)

**Files:**
- Modify: `apps/api-gateway/src/auth/auth.service.ts`
- Modify: `apps/api-gateway/src/auth/auth.resolver.ts`
- Modify: `apps/api-gateway/src/auth/__tests__/auth.service.test.ts`

**Step 1: Write failing tests**

```typescript
describe('selectOrganization', () => {
  it('should issue tenant-scoped JWT for valid membership', async () => {
    // Requires platform token with userId
    // Mock: active membership exists for (userId, tenantId)
    // Expect: { accessToken, refreshToken, user }
  });

  it('should reject if no active membership for that tenant', async () => {
    // Expect: ForbiddenException
  });

  it('should reject expired platform token', async () => {
    // Expect: UnauthorizedException
  });
});
```

**Step 2: Implement selectOrganization in auth service**

```typescript
async selectOrganization(userId: string, tenantId: string) {
  const membership = await this.adminPrisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    include: {
      organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
      role: { select: { id: true, name: true, abilities: true } },
    },
  });

  if (!membership || !membership.isActive) {
    throw new ForbiddenException('No active membership for this organization');
  }

  const user = await this.adminPrisma.user.findUnique({ where: { id: userId } });

  const accessToken = this.generateAccessToken(userId, tenantId, membership.roleId);
  const refreshToken = await this.createRefreshToken(userId, tenantId, membership.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      tenantId: membership.tenantId,
      roleId: membership.roleId,
      abilityRules: this.mergeAbilities(membership.role.abilities, membership.abilities),
    },
  };
}
```

**Step 3: Add resolver mutation**

```typescript
@Mutation(() => AuthPayload)
async selectOrganization(
  @Args('tenantId') tenantId: string,
  @CurrentUser() user: { userId: string },  // from platform token
): Promise<AuthPayload> {
  return this.authService.selectOrganization(user.userId, tenantId);
}
```

**Step 4: Update JWT strategy to handle platform tokens**

In `apps/api-gateway/src/auth/jwt.strategy.ts`, the validate method should handle both token types:

```typescript
async validate(payload: JwtPayload) {
  if (payload.type === 'platform') {
    return { userId: payload.sub, type: 'platform' };
  }
  // Existing access token validation
  return {
    userId: payload.sub,
    tenantId: payload.tenantId,
    roleId: payload.roleId,
    type: 'access',
  };
}
```

**Step 5: Run tests, commit**

```bash
npx nx test api-gateway -- --testPathPattern=auth.service
git add apps/api-gateway/src/auth/
git commit -m "feat(auth): add selectOrganization mutation for multi-org flow"
```

---

## Task 10: Update CASL ability resolution (ROV-42)

**Blocked by:** Task 7

**Files:**
- Modify: `apps/api-gateway/src/auth/` (wherever ability resolution happens)
- Check: CASL guard, ability factory

**Step 1: Find current ability resolution**

Currently reads from `User.abilities` + `Role.abilities`. Change to read from `Membership.abilities` + `Role.abilities`.

The access token JWT already contains `tenantId` and `roleId`. The guard should look up the Membership for the current (userId, tenantId) and merge abilities from there.

**Step 2: Update ability factory**

```typescript
// Instead of:
const user = await prisma.user.findUnique({ where: { id: userId } });
const abilities = mergeAbilities(user.role.abilities, user.abilities);

// Use:
const membership = await adminPrisma.membership.findUnique({
  where: { userId_tenantId: { userId, tenantId } },
  include: { role: true },
});
const abilities = mergeAbilities(membership.role.abilities, membership.abilities);
```

**Step 3: Run all tests**

```bash
bun run test
```

**Step 4: Commit**

```bash
git commit -m "feat(auth): resolve CASL abilities from Membership instead of User"
```

---

## Task 11: Simplify LoginForm — remove Organization ID (ROV-43)

**Blocked by:** Task 8

**Files:**
- Modify: `libs/auth/src/lib/login-form.tsx`
- Modify: `libs/auth/src/lib/types.ts`
- Modify: `libs/auth/src/lib/auth-mutations.ts`
- Modify: `apps/admin-portal/messages/en/auth.json`
- Modify: `apps/admin-portal/messages/hi/auth.json`
- Modify: `apps/institute-portal/messages/en/auth.json`
- Modify: `apps/institute-portal/messages/hi/auth.json`
- Modify: `apps/admin-portal/src/app/[locale]/login/page.tsx`
- Modify: `apps/institute-portal/src/app/[locale]/login/page.tsx`

**Step 1: Update types**

In `libs/auth/src/lib/types.ts`:

```typescript
export interface LoginInput {
  username: string;
  password: string;
  // tenantId removed — login is org-agnostic now
}

// Add new types for multi-org flow
export interface MembershipInfo {
  tenantId: string;
  roleId: string;
  orgName: string;
  orgSlug: string;
  orgLogoUrl?: string;
  roleName: string;
}

export interface LoginResult {
  // Single-org path
  accessToken?: string;
  refreshToken?: string;
  user?: AuthUser;
  // Multi-org path
  platformToken?: string;
  memberships?: MembershipInfo[];
}
```

**Step 2: Update auth mutations**

In `libs/auth/src/lib/auth-mutations.ts`:

```typescript
async login(input: LoginInput): Promise<LoginResult> {
  const data = await graphqlFetch<{ login: LoginResult }>(
    graphqlUrl,
    `mutation Login($username: String!, $password: String!) {
      login(username: $username, password: $password) {
        accessToken
        refreshToken
        user { id username email }
        platformToken
        memberships { tenantId roleId orgName orgSlug orgLogoUrl roleName }
      }
    }`,
    { username: input.username, password: input.password },
  );
  return data.login;
},

async selectOrganization(tenantId: string, platformToken: string): Promise<AuthResponse> {
  const data = await graphqlFetch<{ selectOrganization: AuthResponse }>(
    graphqlUrl,
    `mutation SelectOrganization($tenantId: String!) {
      selectOrganization(tenantId: $tenantId) {
        accessToken
        refreshToken
        user { id username email tenantId roleId abilityRules }
      }
    }`,
    { tenantId },
    { Authorization: `Bearer ${platformToken}` },
  );
  return data.selectOrganization;
},
```

Update `graphqlFetch` to accept optional headers parameter.

**Step 3: Simplify LoginForm**

In `libs/auth/src/lib/login-form.tsx`:

```typescript
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// Remove tenantId from LoginFormValues, LoginFormProps.labels, form JSX, defaultValues
// Remove the tenantId prop
// Remove the tenantId form field block (lines 84-95)
// Remove organizationId from labels object
```

**Step 4: Update login pages**

In both `apps/admin-portal/src/app/[locale]/login/page.tsx` and `apps/institute-portal/src/app/[locale]/login/page.tsx`:

Remove from labels:
```typescript
// Remove these lines:
organizationId: t('organizationId'),
enterOrganizationId: t('enterOrganizationId'),
```

**Step 5: Clean up translation files**

In all 4 auth.json files (`admin-portal/messages/{en,hi}/auth.json`, `institute-portal/messages/{en,hi}/auth.json`), remove:
- `organizationId`
- `enterOrganizationId`
- `organizationRequired`

**Step 6: Run typecheck + lint**

```bash
bun run typecheck
bun run lint
```

**Step 7: Commit**

```bash
git add libs/auth/ apps/admin-portal/ apps/institute-portal/
git commit -m "feat(auth): simplify LoginForm, remove Organization ID field"
```

---

## Task 12: Update auth context for platform token + org selection (ROV-45)

**Blocked by:** Tasks 8 and 9

**Files:**
- Modify: `libs/auth/src/lib/auth-context.tsx`
- Modify: `libs/auth/src/lib/types.ts`
- Modify: `libs/auth/src/lib/token-storage.ts`
- Modify: `libs/auth/src/index.ts`

**Step 1: Update token storage**

In `libs/auth/src/lib/token-storage.ts`, add:

```typescript
getPlatformToken(): string | null {
  return sessionStorage.getItem('roviq_platform_token');
},
setPlatformToken(token: string) {
  sessionStorage.setItem('roviq_platform_token', token);
},
getMemberships(): MembershipInfo[] | null {
  const raw = sessionStorage.getItem('roviq_memberships');
  return raw ? JSON.parse(raw) : null;
},
setMemberships(memberships: MembershipInfo[]) {
  sessionStorage.setItem('roviq_memberships', JSON.stringify(memberships));
},
clearPlatform() {
  sessionStorage.removeItem('roviq_platform_token');
  sessionStorage.removeItem('roviq_memberships');
},
```

**Step 2: Update AuthContextValue interface**

In `libs/auth/src/lib/auth-context.tsx`:

```typescript
interface AuthContextValue extends AuthState {
  sessionExpired: boolean;
  needsOrgSelection: boolean;
  memberships: MembershipInfo[] | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  getAccessToken: () => string | null;
  selectOrganization: (tenantId: string) => Promise<void>;
  switchOrganization: (tenantId: string) => Promise<void>;
}
```

**Step 3: Update AuthProvider props**

Add `selectOrgMutation` to `AuthProviderProps`:

```typescript
selectOrgMutation: (tenantId: string, platformToken: string) => Promise<{
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}>;
```

**Step 4: Update login handler**

```typescript
const login = React.useCallback(
  async (input: LoginInput) => {
    const result = await loginMutation(input);

    if (result.accessToken && result.user) {
      // Single-org path — same as before
      tokenStorage.setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken! });
      tokenStorage.setUser(result.user);
      setState({
        user: result.user,
        tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken! },
        isAuthenticated: true,
        isLoading: false,
      });
      scheduleRefresh(result.accessToken);
    } else if (result.platformToken && result.memberships) {
      // Multi-org path — store platform token, show org picker
      tokenStorage.setPlatformToken(result.platformToken);
      tokenStorage.setMemberships(result.memberships);
      setMemberships(result.memberships);
      setNeedsOrgSelection(true);
    }
  },
  [loginMutation, scheduleRefresh],
);
```

**Step 5: Implement selectOrganization**

```typescript
const selectOrganization = React.useCallback(
  async (tenantId: string) => {
    const platformToken = tokenStorage.getPlatformToken();
    if (!platformToken) throw new Error('No platform token');

    const result = await selectOrgMutation(tenantId, platformToken);
    tokenStorage.clearPlatform();
    tokenStorage.setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    tokenStorage.setUser(result.user);
    setNeedsOrgSelection(false);
    setMemberships(null);
    setState({
      user: result.user,
      tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken },
      isAuthenticated: true,
      isLoading: false,
    });
    scheduleRefresh(result.accessToken);
  },
  [selectOrgMutation, scheduleRefresh],
);
```

**Step 6: Update providers in both apps**

In `apps/admin-portal/src/app/[locale]/providers.tsx` and `apps/institute-portal/src/app/[locale]/providers.tsx`, pass `selectOrgMutation` to AuthProvider:

```typescript
selectOrgMutation={mutations.selectOrganization}
```

**Step 7: Update protected route**

In `libs/auth/src/lib/protected-route.tsx`, add redirect to `/select-org` when `needsOrgSelection` is true.

**Step 8: Run typecheck + tests**

```bash
bun run typecheck
bun run test
```

**Step 9: Commit**

```bash
git add libs/auth/ apps/admin-portal/ apps/institute-portal/
git commit -m "feat(auth): add platform token flow + org selection to auth context"
```

---

## Task 13: Build org picker page (ROV-44)

**Blocked by:** Task 12

**Files:**
- Create: `apps/institute-portal/src/app/[locale]/select-org/page.tsx`
- Create: `apps/admin-portal/src/app/[locale]/select-org/page.tsx`
- Create: `apps/institute-portal/messages/en/selectOrg.json`
- Create: `apps/institute-portal/messages/hi/selectOrg.json`
- Create: `apps/admin-portal/messages/en/selectOrg.json`
- Create: `apps/admin-portal/messages/hi/selectOrg.json`

**Step 1: Create translations**

`messages/en/selectOrg.json`:
```json
{
  "title": "Select Organization",
  "description": "Choose which organization to sign into",
  "role": "Role"
}
```

`messages/hi/selectOrg.json`:
```json
{
  "title": "संस्था चुनें",
  "description": "साइन इन करने के लिए संस्था चुनें",
  "role": "भूमिका"
}
```

**Step 2: Create org picker page**

Both portals get identical pages:

```tsx
'use client';

import { useAuth } from '@roviq/auth';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@roviq/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export default function SelectOrgPage() {
  const t = useTranslations('selectOrg');
  const { needsOrgSelection, memberships, selectOrganization, isAuthenticated } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
    if (!needsOrgSelection) {
      router.replace('/login');
    }
  }, [isAuthenticated, needsOrgSelection, router]);

  const handleSelect = async (tenantId: string) => {
    await selectOrganization(tenantId);
    router.replace('/dashboard');
  };

  if (!memberships) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {memberships.map((m) => (
            <Button
              key={m.tenantId}
              variant="outline"
              className="flex h-auto w-full items-center justify-start gap-3 p-4"
              onClick={() => handleSelect(m.tenantId)}
            >
              {m.orgLogoUrl && (
                <img src={m.orgLogoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
              )}
              <div className="text-left">
                <div className="font-medium">{m.orgName}</div>
                <div className="text-muted-foreground text-sm">
                  {t('role')}: {m.roleName}
                </div>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Register translation namespace**

Add `selectOrg` namespace to both apps' `src/i18n/request.ts` message imports.

**Step 4: Run lint + typecheck**

```bash
bun run typecheck
bun run lint
```

**Step 5: Commit**

```bash
git add apps/admin-portal/ apps/institute-portal/
git commit -m "feat(auth): add org picker page for multi-org users"
```

---

## Task 14: Add org switcher to topbar (ROV-46)

**Blocked by:** Task 12

**Files:**
- Modify: `libs/ui/src/components/layout/topbar.tsx`
- Modify: `libs/ui/src/components/layout/types.ts`

**Step 1: Update LayoutConfig types**

In `libs/ui/src/components/layout/types.ts`, add to `LayoutConfig`:

```typescript
currentOrg?: {
  name: string;
  logoUrl?: string;
};
otherOrgs?: Array<{
  tenantId: string;
  name: string;
  logoUrl?: string;
}>;
onSwitchOrg?: (tenantId: string) => void;
```

**Step 2: Add org switcher dropdown to topbar**

In `libs/ui/src/components/layout/topbar.tsx`, add a `DropdownMenu` next to the user menu that shows current org and allows switching:

```tsx
{config.otherOrgs && config.otherOrgs.length > 0 && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" className="gap-2">
        {config.currentOrg?.logoUrl && (
          <img src={config.currentOrg.logoUrl} alt="" className="h-5 w-5 rounded-full" />
        )}
        <span className="max-w-[150px] truncate">{config.currentOrg?.name}</span>
        <ChevronsUpDown className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {config.otherOrgs.map((org) => (
        <DropdownMenuItem key={org.tenantId} onClick={() => config.onSwitchOrg?.(org.tenantId)}>
          {org.logoUrl && <img src={org.logoUrl} alt="" className="mr-2 h-5 w-5 rounded-full" />}
          {org.name}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

**Step 3: Wire up in dashboard layouts**

In both apps' `(dashboard)/layout.tsx`, pass org info from auth context to LayoutConfig.

**Step 4: Typecheck + commit**

```bash
bun run typecheck
git add libs/ui/ apps/admin-portal/ apps/institute-portal/
git commit -m "feat(ui): add org switcher dropdown to topbar"
```

---

## Task 15: Final verification

**Step 1: Run full gate**

```bash
bun run lint
bun run typecheck
bun run test
bun run e2e
```

All must pass.

**Step 2: Check for "school" references**

```bash
git diff main | grep -i "school"
```

Expected: zero results.

**Step 3: Verify only expected files changed**

```bash
git diff --stat main
```

Review: only files related to auth redesign.

---

## Impersonation Tasks (M4) — Separate Milestone

Tasks 16–18 implement ROV-31, ROV-47, ROV-48 (impersonation backend, UI, audit logging). These are lower priority and should be implemented after M1–M3 are stable. They follow the same TDD pattern but are not detailed here to keep this plan focused on the core auth redesign.

---

## Dependency Graph

```
Task 1 (Membership) ─────┬──→ Task 2 (Profile) ──→ Task 3 (StudentGuardian)
                          │
Task 4 (PhoneNumber) ─────┤
Task 5 (AuthProvider) ────┤
                          ├──→ Task 6 (Backfill) ──→ Task 7 (Restructure User)
                          │                              │
                          │                              ├──→ Task 8 (Login rework)
                          │                              │        │
                          │                              │        ├──→ Task 11 (LoginForm)
                          │                              │        │
                          │                              ├──→ Task 9 (selectOrg)
                          │                              │        │
                          │                              │        ├──→ Task 12 (Auth context)
                          │                              │        │        │
                          │                              │        │        ├──→ Task 13 (Org picker)
                          │                              │        │        ├──→ Task 14 (Org switcher)
                          │                              │        │
                          │                              ├──→ Task 10 (CASL)
                          │
                          └──→ Task 15 (Final verification)
```

Tasks 1, 4, 5 can run in parallel. Tasks 2→3 are sequential. Task 6 needs 1+4+5. The rest follows the graph.
