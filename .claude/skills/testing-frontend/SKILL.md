---
name: testing-frontend
description: Use when writing, modifying, or reviewing frontend tests — covers both Vitest component tests (*.spec.tsx) with React Testing Library, Apollo MockedProvider, CASL permission testing, and Playwright E2E UI tests (*.e2e.spec.ts) across all 3 portal projects (admin, institute, reseller)
---

# Frontend Testing Rules

## Two Layers

| Layer | Tool | File pattern | What it tests |
|---|---|---|---|
| Component | Vitest + React Testing Library | `__tests__/*.spec.tsx` | Individual components, hooks, permission-gated UI, form validation |
| E2E UI | Playwright | `e2e/web-*-e2e/src/*.e2e.spec.ts` | Full user journeys through the browser against a running stack |

---

## Component Tests (Vitest + RTL)

### Framework

- **Vitest** + **React Testing Library** (`@testing-library/react`).
- Import `render`, `screen`, `waitFor`, `within`, `fireEvent` from `@testing-library/react`.
- Import `userEvent` from `@testing-library/user-event` — prefer over `fireEvent` for clicks/typing.
- Use `@testing-library/jest-dom/vitest` for matchers: `toBeInTheDocument()`, `toHaveTextContent()`.
- File naming: `__tests__/{ComponentName}.spec.tsx`.

### What to Test

- Components with conditional rendering, error states, loading states
- Permission-gated UI (`<Can>` / `useCan()` with CASL)
- Form flows: react-hook-form + Zod validation — invalid input shows errors, valid input calls mutation
- Custom hooks: `renderHook()` for hooks managing state or side effects
- i18n: component renders correctly with different locale contexts

### What NOT to Test

- Pure layout wrappers around shadcn/ui with no logic
- Static text/copy
- CSS / Tailwind classes
- Third-party component internals (shadcn Dialog open/close)

### Apollo Client Mocking

```tsx
import { MockedProvider } from '@apollo/client/testing';

const mocks = [{
  request: { query: GET_AUDIT_LOGS, variables: { first: 20 } },
  result: { data: { auditLogs: { edges: [{ node: { id: '1', action: 'updateStudent' } }], pageInfo: { hasNextPage: false, endCursor: null } } } },
}];

render(
  <MockedProvider mocks={mocks} addTypename={false}>
    <AuditLogTable />
  </MockedProvider>,
);
```

Rules:
- Always `addTypename={false}` unless testing cache behavior.
- Test loading state: render without `await waitFor`, assert skeleton/spinner.
- Test error state: provide a mock with `error: new Error(...)`.
- For mutations, assert `onCompleted` behavior (toast, navigation), not the mutation call itself.

### CASL Permission Testing

```tsx
import { AbilityContext } from '@roviq/frontend/auth';
import { defineAbility } from '@casl/ability';

const adminAbility = defineAbility((can) => {
  can('read', 'AuditLog');
  can('manage', 'Student');
});

it('should show audit tab for users with audit read permission', () => {
  render(
    <AbilityContext.Provider value={adminAbility}>
      <StudentDetail id="123" />
    </AbilityContext.Provider>,
  );
  expect(screen.getByRole('tab', { name: /audit/i })).toBeInTheDocument();
});

it('should hide audit tab without permission', () => {
  const restrictedAbility = defineAbility((can) => { can('read', 'Student'); });
  render(
    <AbilityContext.Provider value={restrictedAbility}>
      <StudentDetail id="123" />
    </AbilityContext.Provider>,
  );
  expect(screen.queryByRole('tab', { name: /audit/i })).not.toBeInTheDocument();
});
```

### Querying Elements (priority order)

1. `getByRole` — always first. Use `name` option for disambiguation.
2. `getByLabelText` — for form inputs.
3. `getByPlaceholderText` — if no label (flag as a11y issue).
4. `getByText` — for non-interactive content.
5. `getByTestId` — last resort. If needed, add `data-testid` to the component.

Never use `container.querySelector()`, XPath, or CSS selectors.

### Async Patterns

- `await waitFor(() => expect(...))` for async state updates.
- `await screen.findByText(...)` as shorthand for waitFor + getByText.
- Never `setTimeout` or manual delays.

---

## Playwright E2E UI Tests

### Three Portal Projects

| Project | Directory | baseURL | Scope |
|---|---|---|---|
| `web-admin-e2e` | `e2e/web-admin-e2e/` | `http://admin.localhost:4201` | Platform admin |
| `web-institute-e2e` | `e2e/web-institute-e2e/` | `http://localhost:4201` | Institute users |
| `web-reseller-e2e` | `e2e/web-reseller-e2e/` | `http://reseller.localhost:4201` | Reseller users |

All three boot `dev:web:e2e` (the unified `apps/web` Next.js app on port 4201, separate from dev port 4200). Subdomain routing in middleware determines which portal renders.

### File Naming
- Test specs: `src/{feature}.e2e.spec.ts`
- Auth setup: `src/auth.setup.ts` (Playwright setup project, produces `storageState`)
- Page objects: `src/pages/{PageName}.ts`

### Page Object Model (Required)

Every Playwright project must use POMs. No inline selectors in test files.

```typescript
// e2e/web-admin-e2e/src/pages/LoginPage.ts
import { Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/en/admin/login');
  }

  async login(username: string, password: string) {
    await this.page.getByLabel('Roviq ID').fill(username);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: /sign in/i }).click();
  }

  async expectLoginError(message: string) {
    await expect(this.page.getByRole('alert')).toHaveText(message);
  }
}
```

```typescript
// e2e/web-admin-e2e/src/login.e2e.spec.ts
import { LoginPage } from './pages/LoginPage';
import { SEED } from '@roviq/testing/seed-ids';

test('admin can log in', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(SEED.ADMIN_USER.username, SEED.ADMIN_USER.password);
  await expect(page).toHaveURL(/dashboard/);
});
```

### Seed Data in Playwright

Import `SEED` from `@roviq/testing/seed-ids`. Never hardcode entity names.

```typescript
import { SEED } from '@roviq/testing/seed-ids';

// Navigate by URL with seed ID
await page.goto(`/en/admin/institutes/${SEED.INSTITUTE_1.id}`);

// Assert rendered name (this IS a valid assertion)
await expect(page.getByRole('heading')).toHaveText(SEED.INSTITUTE_1.name);
```

If someone renames a seed entity, both the seed file and the test expectation update in one place.

### Auth Setup

Every project has an `auth.setup.ts` that produces a `storageState` JSON:

```typescript
// e2e/web-admin-e2e/src/auth.setup.ts
import { test as setup } from '@playwright/test';
import { E2E_USERS } from '@roviq/testing/e2e-constants';

setup('authenticate as platform admin', async ({ page }) => {
  await page.goto('/en/admin/login');
  await page.getByLabel('Roviq ID').fill(E2E_USERS.PLATFORM_ADMIN.username);
  await page.getByLabel('Password').fill(E2E_USERS.PLATFORM_ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
  await page.context().storageState({ path: 'playwright/.auth/admin.json' });
});
```

Credentials come from `E2E_USERS` — never hardcoded in setup files or test files.

### `data-testid` Usage

Use `data-testid` on data-bearing components where `getByRole`/`getByText` is insufficient:

```tsx
// Production component
<tr data-testid={`student-row-${student.id}`}>
  <td>{student.name}</td>
</tr>
```

```typescript
// Playwright test
const row = page.getByTestId(`student-row-${SEED.STUDENT_1.id}`);
await expect(row).toBeVisible();
```

Priority: `getByRole` > `getByLabel` > `getByTestId` > `getByText`. Use `getByText` for assertions (verifying content), not for finding interactive elements.

### Required Tests Per Portal

**Minimum per portal project:**
1. Login flow (in `auth.setup.ts` + dedicated login spec)
2. Dashboard renders for authenticated user
3. Navigation — sidebar links navigate correctly
4. One data table — renders, pagination works
5. One mutation — form submit creates/updates entity

**Cross-cutting (in any portal):**
1. Impersonation flow — click "Impersonate" → new tab → amber banner → exit
2. Institute switching — multi-institute admin switches mid-session
3. Audit trail — perform mutation → navigate to audit page → verify entry
4. Auth rejection — access admin URL with institute-only token → redirect to login

### i18n Testing

At least one test per portal switches locale and verifies no layout breakage:

```typescript
test('Hindi locale does not break dashboard layout', async ({ page }) => {
  await page.goto('/hi/admin/dashboard');
  // Verify no horizontal scrollbar (Hindi text 30-40% longer)
  const body = page.locator('body');
  const scrollWidth = await body.evaluate(el => el.scrollWidth);
  const clientWidth = await body.evaluate(el => el.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});
```

### Mobile Viewport Testing

Configure a mobile project in `playwright.config.ts`:

```typescript
projects: [
  { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
  { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
],
```

At minimum: login + dashboard + one data table at 360px width.

### Forbidden in Playwright Tests

- `page.waitForTimeout(ms)` — use auto-wait or explicit `waitForURL`/`waitForSelector`
- `window.location` manipulation — use `page.goto()`
- Hardcoded seed names — use `SEED.ENTITY.name`
- Hardcoded credentials — use `E2E_USERS` from constants
- Inline login flows in test files — use `auth.setup.ts` + `storageState`
- Snapshot tests (`toHaveScreenshot()` is allowed for visual regression, but `toMatchSnapshot()` on data is banned)
- CSS selectors like `locator('table tbody tr')` — use `getByRole`, `getByTestId`
- `act()` warnings — if they appear, the test has a bug

### nuqs → TanStack Table → Apollo → shadcn data table pattern

- Mock nuqs URL state with test wrapper or MemoryRouter
- Don't test TanStack Table internals (sorting algorithm, pagination math)
- Test: column visibility, filter application triggers refetch, empty state, error state, loading skeleton
- For pagination: assert "Next" button triggers Apollo fetchMore with correct cursor

### Forbidden in Component Tests

- `window.location` / `localStorage` / `sessionStorage` direct access — mock via `vi.stubGlobal`
- `container.querySelector()` — use Testing Library queries
- Snapshot tests
- Testing implementation details (internal state, method calls)
