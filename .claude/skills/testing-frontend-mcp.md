# Frontend MCP Testing & Verification

> Glob: `apps/web/**`, `e2e/**`, `libs/frontend/**`

## Workflow: Implement → MCP Verify & Fix → E2E → Component Tests

Every frontend feature follows this exact sequence. Never skip steps or reorder.

### Phase 1: MCP Visual Verification & Fix Loop

After implementing the feature, verify it using Playwright MCP in the browser.

#### Authentication

Before navigating to any portal page, check if you're already logged in:

1. Navigate to the target page
2. If redirected to login, authenticate using the existing E2E login helper:

   ```bash
   # Get JWT via the shared Vitest auth helper — loginAsInstituteAdmin / loginAsTeacher / loginAsGuardian etc.
   # Run it as a one-off Vitest invocation that returns { accessToken, refreshToken } to stdout.
   pnpm -C e2e/api-gateway-e2e exec tsx -e \
     "import('./src/helpers/auth').then(async m => console.log(JSON.stringify(await m.loginAsInstituteAdmin())))"
   ```

3. Use `browser_run_code` to inject the token:

   ```js
   async (page) => {
     await page.evaluate(({ accessToken, refreshToken }) => {
       localStorage.setItem('access_token', accessToken);
       localStorage.setItem('refresh_token', refreshToken);
     }, tokens);
     await page.reload();
   }
   ```

4. If a login helper doesn't exist yet for this scope, add it to `e2e/api-gateway-e2e/src/helpers/auth.ts` following the existing pattern. Avoid manual MCP login.

Prefer reusing E2E auth flows over manual MCP login. Manual login wastes tokens.

#### Verification Scope

Verify **both** the implemented feature AND adjacent features it might affect:

1. **Primary**: The feature itself works end-to-end
   - All interactive elements respond correctly (buttons, forms, modals, dropdowns)
   - Data loads and renders correctly
   - Mutations succeed and UI updates (optimistic or refetch)
   - Loading/error/empty states render
   - Form validation shows correct errors
   - i18n: switch language, verify no broken layout or missing keys
   - Responsive: resize viewport to mobile breakpoint, verify no overflow or broken layout

2. **Adjacent smoke test**: Features the change might have broken
   - Sidebar navigation still works
   - Clicking through to related pages (list → detail → back) works
   - Other tabs/sections on the same page still render
   - Shared components (data tables, form fields, modals) used elsewhere still work
   - If a shared lib was modified, spot-check one other consumer

3. **Console check**: After each page load, verify no console errors via MCP `browser_console_messages`. Warnings are acceptable, errors are not.

#### Fix Loop

When issues are found:

- Fix the issue in code
- Re-verify via MCP that the fix works AND didn't break what was working
- **Maximum 3 fix-and-recheck cycles**. After 3 attempts, stop and report:
  - What works
  - What's still broken
  - What you tried
  - Your best guess at the root cause
- Never silently give up. Always report status.

### Phase 2: E2E Playwright Tests

After MCP verification succeeds and code is stable, write Playwright E2E tests.

Location: `e2e/web-{scope}-e2e/`

The E2E tests should capture the exact flows you just verified via MCP — you have warm context on what works, edge cases, and selectors. Write them now before context fades.

Guidelines:

- One test file per feature flow (e.g., `reseller-institute-list.spec.ts`)
- Use existing page object patterns if they exist in `e2e/web-{scope}-e2e/src/pages/`
- Reuse the auth setup from `auth.setup.ts` — don't reinvent login
- Cover: happy path, primary error state, empty state
- Do NOT test every validation message — that's component test territory
- **When a test fails, IMMEDIATELY read the `error-context.md` file** from the test output directory — it contains the page snapshot showing exactly what's on screen. Never guess with timeout/config tweaks before understanding the actual page state.
- Run and confirm passing: `npx playwright test <file> --timeout=15000`

### Phase 3: Component Tests

After E2E tests pass, write component tests for the individual pieces.

Location: colocated `__tests__/` directories next to the component.

Guidelines:

- Vitest + Testing Library
- Focus on: rendering states, user interactions, prop variations, conditional logic
- Mock GraphQL via MSW or Apollo MockProvider — never hit real API
- Test form validation rules exhaustively here (not in E2E)
- Test i18n key rendering with mocked translations
- Run and confirm passing: `pnpm exec vitest run <path>`

### Portal-Specific Notes

| Portal | Test User | Scope |
|---|---|---|
| Admin | `admin` / `admin123` | `platform` |
| Reseller | `reseller1` / `reseller123` | `reseller` |
| Institute | `admin` / `admin123` → select institute | `institute` |

When testing cross-portal features (e.g., impersonation from admin into institute), verify both sides:

1. Initiate from source portal
2. Verify target portal opens correctly
3. Verify impersonation banner renders
4. Verify actions are audited (check audit page if accessible)

### What NOT to Do

- Do NOT write tests before MCP verification. Code will change during fix loop → tests break.
- Do NOT skip MCP verification for "simple" changes. Simple changes break adjacent features.
- Do NOT run MCP verification in headless mode. Headed mode catches visual/layout bugs.
- Do NOT spend more than 3 fix cycles. Escalate.
- Do NOT write E2E tests for things better covered by component tests (individual validation rules, prop variations, conditional rendering).
