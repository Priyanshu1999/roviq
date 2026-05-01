# Frontend UX Reference — Roviq

> **SYNC RULE**: This file and `.claude/rules/frontend-ux.md` are paired.
> Any addition, removal, or edit to a rule in either file MUST be reflected in the other.
> The rules file contains the concise one-liner; this file contains the full detail.
> Before committing, verify both files have the same set of tags.
>
> **Lookup**: `sed -n '/\[TAGID\]/,/^---$/p' docs/references/frontend-ux-reference.md`
> This extracts the full rule from tag to the next `---` delimiter.

---

## Context

Users are Indian institute admins, clerks, teachers, and parents — often non-technical,
on 1366×768/1920x1080 laptops or Android phones, with unreliable 4G/5G. Design for them, not for developers on 4K monitors. Use Indian locale conventions everywhere.

---

## GENERAL PATTERNS

### [ABMVS] Data Table Pipeline

The canonical data table pattern in Roviq is: `nuqs` (URL state) → TanStack Table (headless, server-side) → Apollo Client (paginated GraphQL) → shadcn/ui (render). Every data table must follow this pipeline. `nuqs` owns all filter/sort/pagination state in URL params, TanStack Table handles column definitions and headless logic, Apollo fetches cursor-paginated GraphQL connections, and shadcn/ui renders the final table, cells, and controls

---

### [ADQJE] CASL Conditional Rendering

Use `<Can>` from `@casl/react` for all permission-gated UI. Never use manual `if (ability.can(...))` in JSX — wrap the conditional content in `<Can I="read" a="Student">`. For inverse, use `<Can not I="delete" a="Institute">`. This keeps authorization declarative and consistent with the backend CASL model

---

### [AXPQY] Component Library Enforcement

Use `@roviq/ui` components for everything — never raw HTML elements (`<button>`, `<input>`, `<select>`, `<table>`). If a component doesn't exist in `@roviq/ui`, create it there first, then use it. This ensures consistent theming, accessibility, and the ability to swap underlying primitives without touching feature code

---

### [BUKTM] i18n String Enforcement

All user-facing text must use `useTranslations()` from `next-intl` — never hardcode strings. This includes button labels, toast messages, empty states, error messages, placeholder text, and aria-labels. The only exceptions are code-level strings (log messages, error codes) that are never displayed to users

---

### [BXWCX] Locale Route Segments

Both Next.js apps use `[locale]` route segments (`/en/dashboard`, `/hi/dashboard`). All internal links must use the locale-aware routing utilities. Translation files are per-namespace in `messages/{locale}/` (e.g., `common.json`, `dashboard.json`). New features → create a new namespace JSON file and import it in `src/i18n/request.ts`

---

### [CKWZY] Locale-Aware Formatting

Use `useFormatDate()` / `useFormatNumber()` from `@roviq/i18n` for all date and number formatting. Never use raw `new Date().toLocaleDateString()` or `Intl.NumberFormat` directly — the shared hooks handle locale detection, Indian numbering, academic year conventions, and INR currency formatting consistently. Sidebar nav hrefs are auto-prefixed with the current locale in `@roviq/ui`'s sidebar component

---

### [CLFYD] Field Components (NOT Legacy Form)

Use `Field`/`FieldLabel`/`FieldError`/`FieldGroup`/`FieldSet` for all forms. Never add the legacy `form.tsx` (`shadcn add form`) — it is superseded by Field.

```tsx
<Controller
  name="email"
  control={form.control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={field.name}>Email</FieldLabel>
      <Input {...field} id={field.name} aria-invalid={fieldState.invalid} />
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

**Rules:**

- Wrap every input in `<Field>` — set `data-invalid` on Field, `aria-invalid` on the control
- Group related fields with `<FieldGroup>`, semantic sections with `<FieldSet>` + `<FieldLegend>`
- `<FieldError>` accepts `errors` array (TanStack Form `field.state.meta.errors`, Standard Schema / Zod issues). Use the `@roviq/ui` form kit (`useAppForm`) which wires this automatically — never render `<FieldError>` by hand from a form page. See [forms.md](../forms.md).
- Orientation: `vertical` (default), `horizontal` (label beside control), `responsive` (auto via container query)
- For checkboxes/switches: nest `<Field>` inside `<FieldLabel>` for selectable field groups
- Add `<FieldDescription>` for helper text, `<FieldContent>` to group control + description in horizontal layouts

---

### [CSIIV] Naming Conventions

- camelCase: variables, functions
- PascalCase: components, types
- kebab-case: file names
- `@roviq/*`: library imports

---

### [DCACD] Code Style

- TypeScript strict mode, target ES2026
- Exports at top, private methods at bottom
- >2 params → use object parameter
- Only export what's used externally

---

### [DFHTL] Action Button Help Text

**Problem:** Destructive actions (Suspend, Delete, Reject) have irreversible consequences that users don't understand from the label alone. Radix `<Tooltip>` adds 3 wrapper elements per button — wasteful when native browser tooltips suffice.

**Rules:**

- Every action button that changes status or deletes data must have a `title` attribute with a one-sentence consequence description
- Use native HTML `title` attribute — zero JS overhead, works on all browsers, accessible by default
- Only use Radix `<Tooltip>` from `@roviq/ui` when you need custom positioning, styled content, or rich HTML inside the tooltip
- Help text must come from i18n translations (`ta('deactivateDescription')`) — never hardcoded
- Keep help text under 100 characters — enough to explain the consequence, not a full paragraph

**Example:**

```tsx
<Button
  title={ta('suspendDescription')}
  onClick={() => setActionDialog({ type: 'suspend' })}
>
  <ShieldOff className="size-4" />
  {ta('suspend')}
</Button>
```

**Anti-pattern:**

```tsx
// Don't wrap every button in Tooltip/TooltipTrigger/TooltipContent
<Tooltip>
  <TooltipTrigger asChild><Button>...</Button></TooltipTrigger>
  <TooltipContent>Help text</TooltipContent>
</Tooltip>
```

---

### [TSTID] Test ID Attributes for Testable Elements

**Problem:** E2E and component tests need stable selectors that survive translations, restyling, and DOM reordering. Text-based selectors (`getByText`, `getByRole` with label) break when copy changes or Hindi translations flip length. CSS selectors (`tr:nth-child(3)`) break on any layout change. Missing `data-testid` forces test authors to reach for fragile locators and produces flaky tests.

A second failure mode: inconsistent attribute names. Playwright and React Testing Library default to `data-testid` (no extra hyphen). Any other variant (`data-test-id`, `data-test`, `data-cy`) requires per-project `testIdAttribute` config and silently breaks `page.getByTestId()` / `screen.getByTestId()` calls.

**Rules:**

- Every **testable element** must have a `data-testid` attribute. Testable elements include:
  - Form fields (every `<Input>`, `<Select>`, `<Textarea>`, `<Checkbox>`, combobox, date picker)
  - Action buttons (Submit, Cancel, Save, Delete, Approve, Reject, status-change buttons)
  - Navigation links (sidebar items, breadcrumb links, tab triggers)
  - Table rows — interpolate the entity id: `data-testid={`student-row-${student.id}`}`
  - Cells with key data: `data-testid={`student-name-cell-${student.id}`}`
  - Empty-state containers, error-state containers, loading skeletons (so tests can assert on state)
  - Dialogs, sheets, drawers (on the root container and on the primary action button inside)
  - Toasts / notifications (on the container element)
  - Page-level headings (`data-testid="page-title"` or more specific)
- **Naming:** kebab-case, describe the purpose, scope with the entity name where relevant
  - Good: `student-submit-button`, `student-row-${id}`, `students-empty-state`, `institute-name-field`
  - Bad: `btn1`, `the-input`, `StudentRow`, `data_test_id`
- **Attribute name:** always `data-testid`. **NEVER** `data-test-id` (extra hyphen), `data-test`, or `data-cy`
  - Playwright uses `page.getByTestId('name')` which looks up `data-testid` by default — zero config
  - React Testing Library uses `screen.getByTestId('name')` which looks up `data-testid` by default
  - Do not set `testIdAttribute` in Playwright config — use the default
- **Do NOT add `data-testid` to purely decorative elements.** Icons inside buttons, spacer divs, and layout-only wrappers do not need test IDs. The test-id surface should mirror the interactive / semantic surface — not every DOM node.
- **Stable across translations.** `data-testid="students-empty-state"` is language-independent; `getByText('No students found')` breaks when the locale changes. Tests that need to verify copy should use `getByText` for assertions, but use `getByTestId` to locate the element first.

**Example:**

```tsx
<div data-testid="students-page">
  <h1 data-testid="students-page-title">{t('title')}</h1>

  <Input
    data-testid="students-search-input"
    placeholder={t('searchPlaceholder')}
    onChange={(e) => setSearch(e.target.value)}
  />

  {students.length === 0 ? (
    <div data-testid="students-empty-state">{t('noStudents')}</div>
  ) : (
    <table>
      <tbody>
        {students.map((s) => (
          <tr key={s.id} data-testid={`student-row-${s.id}`}>
            <td data-testid={`student-name-cell-${s.id}`}>{s.name}</td>
            <td>
              <Button
                data-testid={`student-edit-button-${s.id}`}
                title={t('editDescription')}
                onClick={() => openEdit(s.id)}
              >
                {t('edit')}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</div>
```

**Playwright spec using the above:**

```ts
await page.goto('/institute/students');
await expect(page.getByTestId('students-page-title')).toBeVisible();
await page.getByTestId('students-search-input').fill('Rajesh');

const row = page.getByTestId(`student-row-${SEED.STUDENT_1.id}`);
await expect(row).toBeVisible();
await row.getByTestId(`student-edit-button-${SEED.STUDENT_1.id}`).click();
```

**Anti-pattern:**

```tsx
// Non-standard attribute — getByTestId() silently returns nothing
<button data-test-id="save">Save</button>

// No id interpolation — test can't target a specific row
<tr data-testid="student-row">...</tr>

// Decorative element doesn't need a test id
<div data-testid="icon-wrapper"><CheckIcon /></div>
```

**Migration note:** Any existing `data-test-id` attributes (with extra hyphen) in production code are legacy and must be flipped to `data-testid`. Playwright specs using `[data-test-id="..."]` CSS selectors must be updated to `page.getByTestId('...')` or at minimum `[data-testid="..."]`.

---

## FORM & INPUT DESIGN

### [DNMPQ] Human Labels

**Problem:** Technical/DB labels ("Max Users", "Tenant ID", "RTE Quota %") mean nothing to a school clerk.
**Rules:**

- Use domain language: "Right to Education — Reserved Seats (25%)" not "RTE Quota %"
- Add `text-muted-foreground` description via `<FieldDescription>` below every non-obvious label
- `(i)` icon → popover with explanation + example for complex fields
- Never abbreviate without expanding on first appearance
- Map DB column names to human names in a shared `fieldLabels` map per module

---

### [FJPME] Visible Input Constraints

**Problem:** Bare number inputs with no min/max/step. User has no idea what's valid.
**Rules:**

- Show min/max as `<FieldDescription>`: "1–500"
- Use `min`/`max`/`step` HTML attributes on number inputs
- Percentage fields: append "%" suffix (shadcn input addon)
- Currency fields: prefix "₹", format on blur in Indian numbering (`₹1,00,000`)
- Placeholder = realistic example value, never "Enter value here"
- Validate on blur, not just on submit

---

### [FLSCT] Usage Context on Limit Fields

**Problem:** "Max Sections: 2" — 2 total? 2 remaining? What happens if reduced below current usage?
**Rules:**

- Show usage inline: "2 of 10 used" with a subtle progress bar
- Reducing below current usage → blocking warning with explanation
- Plan-gated limits → "Upgrade to increase" link, not a disabled input
- Fetch current usage count in the same query as the limit value

---

### [FVOLK] Create vs Edit Mode

**Problem:** Same form for create and edit with no visual distinction.
**Rules:**

- Edit mode: read-only fields rendered as plain text + label, never disabled inputs
- Show "Created on [date] by [user]" metadata in edit mode
- Button labels: "Create Student" vs "Save Changes" — never generic "Submit"
- Editable fields get a subtle visual differentiator (left border accent or background)

---

### [FXPFP] Long Form Sectioning

**Problem:** 20+ field forms as one scrollable wall.
**Rules:**

- Group into logical sections: "Basic Information", "Board & Compliance", "Capacity Limits"
- Initial setup flows → stepper/wizard (mirrors Temporal pipeline stages)
- Edit pages → tabs or accordion sections
- 4+ sections → sticky sidebar TOC on wide screens
- Each section independently validates and shows section-level error count

---

### [GGPVY] Long List Selection

**Problem:** `<select>` with 500 items for districts/boards. Unusable.
**Rules:**

- Always use cmdk-based combobox (shadcn) — searchable, keyboard navigable
- Hierarchical data (State → District → Block) → cascading comboboxes
- Show recent/popular options at the top
- Show count: "Select District (43 in Rajasthan)"
- Async search for lists > 100 items — don't load all options upfront

---

### [GQLCG] Codegen-Typed GraphQL Operations

**Problem:** Untyped `gql` strings let schema renames sit undetected until a user hits the page and sees `Cannot query field X on type Y`. The error surfaces in production telemetry instead of at compile time.

**Rules:**

- Every `gql\`…\`` template literal in `apps/web/src/**/*.ts(x)` and `libs/frontend/**/*.ts(x)` must be paired with a generated `*.generated.ts` sibling exporting a `TypedDocumentNode` constant. Codegen is wired into `nx build web` via the `codegen` target dependency, and Tilt's `codegen` resource runs `pnpm codegen --watch` for live regeneration during development.
- Schema rename / removal → typecheck failure on every consumer of the document, not a runtime exception. The `pnpm check:codegen-drift` CI gate fails when the committed `*.generated.ts` files are out of sync with the schema (catches "I forgot to commit the regenerated file" PRs).
- After adding or modifying a `gql\`…\`` operation: run `pnpm codegen` locally (or wait for Tilt's watcher), inspect the regenerated `*.generated.ts`, and commit it alongside the source. Treat generated files as source — they are checked into git.
- Apollo `useQuery`/`useMutation`/`useSubscription` accept the typed document directly; `data` and `variables` are inferred without manual generic parameters. Do NOT pass a raw query string to Apollo hooks.
- E2E specs share the same model — `e2e/api-gateway-e2e/__generated__/graphql.ts` provides typed documents, and the `gql()` helper accepts both typed nodes (preferred) and raw strings (legacy form, being migrated).

**Why this exists:** the same registry-vs-drift principle as the testid registry ([TSTID]) — making the schema the single source of truth so a rename cannot silently desync the consumers.

---

### [GYATP] Indian Date & Academic Year Handling

**Problem:** Date pickers default to Jan–Dec. Indian academic years are April–March.
**Rules:**

- Academic year selector: custom dropdown showing "2025–26", "2026–27" — NOT a date picker
- Date of birth: DD/MM/YYYY order (Indian convention)
- Default date picker start month = current academic year start (April/June)
- Date range presets: "This Academic Year", "Last Term", "This Month", "Today"
- Use `date-fns` with `en-IN` locale for all formatting

---

### [GZUFW] Phone Number Fields

**Problem:** Inconsistent phone number entry and storage.
**Rules:**

- Dedicated phone input with `+91` country code prefix (default for Indian institutes)
- Auto-format on blur: `+91 98765 43210`
- Validate: exactly 10 digits for Indian mobile
- WhatsApp fields: WhatsApp icon + "Will be used for notifications" helper via `<FieldDescription>`
- Store as E.164 format (`+919876543210`) in backend, display formatted

---

### [HBCFO] Structured Address Fields

**Problem:** Single textarea for address. Can't validate, search, or localize.
**Rules:**

- Structured fields: Line 1, Line 2, City/Village, District, State, PIN code
- Auto-fill City/State from PIN code (6-digit Indian postal code)
- State dropdown pre-filtered if board is state-specific (RBSE → Rajasthan)
- Show formatted address preview below the fields
- Use the `Address` value object from backend for validation parity

---

### [HQIEQ] File Upload Guidance

**Problem:** "Upload Document" button with no context on format, size, resolution.
**Rules:**

- Specific label: "Upload Institute Logo (PNG or JPG, max 2MB, min 200×200px)"
- Drag-and-drop zone with accepted formats listed inside
- Preview after selection: image thumbnail, PDF first-page, filename for others
- Template/example link for document uploads (TC, certificates)
- Progress bar (cancelable) during upload
- Validate type + size client-side before upload starts to MinIO/S3

---

### [HUPGP] Form Auto-Save & Draft Recovery

**Problem:** User fills long form, session expires or network drops, data lost.
**Rules:**

- Auto-save form state to localStorage every 30 seconds and on field blur
- On page load, detect saved draft → show banner: "You have an unsaved draft from [time]. Restore?"
- Clear draft on successful submission
- For wizard/stepper flows, persist completed step data across page reloads
- Key format: `roviq:draft:{formName}:{entityId|'new'}`

---

### [HVJED] Indian Currency & Number Formatting

**Problem:** Amounts displayed as `62500` or `$62,500` — wrong locale, wrong currency.
**Rules:**

- Always use Indian numbering system: `₹1,00,000` not `₹100,000`
- Use `useFormatNumber()` from `@roviq/i18n` (wraps `Intl.NumberFormat('en-IN')`)
- Store amounts as BIGINT paise in backend, divide by 100 for display
- Input fields: accept plain digits, format on blur
- Large numbers in dashboards: use compact format: "₹1.2L", "₹3.5Cr"
- Use the `Money` value object from backend for formatting parity

---

## DATA TABLES

### [IAMQQ] Empty States

**Problem:** Zero rows = blank white space. User thinks system is broken.
**Rules:**

- Purposeful empty state: illustration + contextual message + primary CTA ("Enroll First Student")
- Filtered zero results: "No results match your filters" + "Clear Filters" button
- Permission-restricted: "You don't have access. Contact your administrator."
- Different empty states for different causes — never generic "No data"
- Empty state component must be a prop on every data table instance

---

### [IMUXO] Loading Skeletons

**Problem:** Blank/spinner while loading. Layout shifts on data arrival.
**Rules:**

- Skeleton rows matching table column layout (shadcn Skeleton)
- Show skeleton count = `first` pagination size (default: 25 desktop, 10 mobile)
- After 3 seconds: switch to "Taking longer than usual..." + retry button
- Never show flash of empty state before data arrives — skeleton takes priority

---

### [INREX] Pagination UX

**Problem:** Cursor pagination with only "Prev/Next" — no position awareness.
**Rules:**

- Show total count: "243 students"
- Show window: "Showing 51–100 of 243"
- Cache cursors for page number display (TanStack Table supports this)
- Rows per page selector: 10/25/50/100. Default 25 desktop, 10 mobile
- Persist page size preference via nuqs URL state
- Fetch `totalCount` in the same GraphQL connection query

---

### [IXABI] Responsive Columns

**Problem:** 12 columns crammed into 1366×768 laptops (most common in Indian offices).
**Rules:**

- Default column set: 5–7 columns. Additional columns via visibility toggle dropdown
- Priority columns (name, status): always visible
- Metadata columns: hidden below 1280px
- Sticky first column (identifier) and last column (actions) on horizontal scroll
- Use `minSize`/`maxSize` on TanStack Table columns
- Primary design target: 1366×768, NOT 1920×1080

---

### [JABGL] Row Actions

**Problem:** 8 actions buried in a `•••` dropdown. Too many clicks.
**Rules:**

- 1–2 most common actions as inline icon buttons (Edit, View)
- Rest in overflow menu, grouped with separators and section labels
- Destructive actions: bottom of menu, separated, red text
- Bulk operations: floating action bar on row selection: "3 selected — Send Notification | Export | Delete"
- Checkbox column with "Select All (page)" and "Select All (X total)"

---

### [JQGQM] Search & Filtering

**Problem:** Exact-match search. "Priya" doesn't find "Priyanshu". No multi-field search.
**Rules:**

- Minimum: prefix matching (ILIKE 'priya%') on name fields
- Critical fields (name, phone, parent name): trigram/fuzzy search
- Multi-field simultaneous search: name, roll number, phone, parent name
- Show match context: "Priyanshu Sharma — matched on student name"
- Bilingual institutes: search across English + regional language name fields
- Debounce search input: 300ms

---

### [JSUFS] Filter Persistence

**Problem:** Filters reset on navigation. User sets complex filters, clicks into detail, presses back — gone.
**Rules:**

- ALL filter state in URL via nuqs — survives navigation, refresh, sharing
- Active filters shown as removable chips above the table
- "Copy filter link" button for sharing filtered views
- "Clear All Filters" button visible when any filter is active
- Default filters per role (e.g., class teacher sees only their sections)

---

### [JXIUA] Sort Indicators

**Problem:** Sortable columns with no visual feedback on current sort.
**Rules:**

- `↑`/`↓` arrow on active sort column (shadcn DataTableColumnHeader)
- Active sort column header visually distinct (bold or accent color)
- Meaningful default sorts: students by name, attendance by date, fees by due date
- Multi-column sort via shift+click for power users

---

### [KQREY] CSV/Excel Export

**Problem:** No way to extract data for offline use or sharing with board/management.
**Rules:**

- Export button on every data table: "Export CSV" / "Export Excel"
- Export respects current filters and sort — user exports what they see
- For large datasets (>5000 rows): async export via Temporal workflow + download notification
- Include column headers in export matching displayed column labels (not DB field names)
- Date/currency formatting in exports matches Indian locale

---

### [LAAEL] Print-Friendly Views

**Problem:** Printing a data table page gives a mess of sidebars, headers, and truncated columns.
**Rules:**

- Add `@media print` styles: hide sidebar, header, pagination, action buttons
- Expand all columns to full width in print
- Add institute name + logo + date + page numbers in print header/footer
- For specific printable items (fee receipts, ID cards, TC): dedicated print templates
- Use `react-to-print` or browser `window.print()` with print-specific CSS

---

## NAVIGATION & INFORMATION ARCHITECTURE

### [LEYPF] Grouped Sidebar Navigation

**Problem:** Flat sidebar with 25+ items. Overwhelming.
**Rules:**

- Collapsible groups: "Academics" (Standards, Sections, Timetable), "People" (Students, Teachers, Staff, Parents), "Finance" (Fees, Payments), "Administration" (Settings, Audit Logs, Reports)
- Role-filtered: teachers don't see Finance, accountants don't see Attendance
- Expanded: icons + labels. Collapsed: icons only with tooltips
- User-pinnable "Favorites" section at top (stored per user in preferences)

---

### [LODGO] Breadcrumbs

**Problem:** 4 levels deep with no way back except browser back button.
**Rules:**

- Breadcrumbs on every page below header: `Students / Class 9A / Priyanshu Sharma / Attendance`
- Every segment is a clickable link
- Mobile: collapse to `← Class 9A / Attendance`
- Dynamic breadcrumbs from route — never hardcoded

---

### [MENVQ] Command Palette (⌘K)

**Problem:** Finding anything requires navigating to the right page first, then searching.
**Rules:**

- `⌘K` / `Ctrl+K` opens command palette (cmdk) — search across all entities from any page
- Sections: Recent, Quick Actions ("Create Student", "Mark Attendance"), Navigation, Search Results
- Results grouped by entity type: Students, Teachers, Sections, Settings
- Keyboard navigable, opens instantly, fetches results with debounced async search

---

### [MXJLE] Context Preservation on Switches

**Problem:** Switching institutes/roles loses the current page context.
**Rules:**

- Institute switch: preserve current route (viewing students in A → land on students in B)
- Institute indicator in header at all times: name + logo
- Impersonation: persistent amber banner: "Viewing as [Admin] at [Institute]. All actions logged. [Exit]"
- Banner uses a distinct background color, always visible, not dismissible

---

## LOADING, ERROR & EDGE STATES

### [MYORD] Page Loading

**Problem:** Full-page spinners block everything. Feels slow.
**Rules:**

- Page-level skeleton layouts matching target page structure
- Shell (sidebar, header, breadcrumbs) renders immediately — only content area shows loading
- Use React Suspense boundaries around data sections, not the whole page
- Apollo `stale-while-revalidate`: show stale data with "Refreshing..." rather than wiping to spinner

---

### [NGIAC] Mutation Feedback

**Problem:** "Save" clicked, nothing visible happens. Silent success or silent failure.
**Rules:**

- Every mutation has 3 visible states: idle → loading (button spinner + "Saving...") → success (Sonner toast) | error (Sonner toast with detail + retry)
- Network errors: "Connection lost. Changes not saved. Retrying..." with auto-retry
- Validation errors: map to specific fields via `<FieldError>`, not just a generic toast
- GraphQL errors: parse `extensions`, show human messages — never raw error codes or stack traces

---

### [NTLOD] Optimistic Updates

**Problem:** Toggle actions (attendance, status) wait for server roundtrip. Feels broken on slow 4G.
**Rules:**

- Simple state changes (attendance toggle, status, checkbox): apply immediately in UI
- Use Apollo `optimisticResponse` for all toggle-type mutations
- Server rejection → revert UI + explain via toast
- Forms: disable submit + show spinner, don't clear form until success confirmed

---

### [OJAAC] Offline Handling

**Problem:** Rural school, intermittent 4G. Long form submitted → network error → data lost.
**Rules:**

- Detect online/offline → persistent banner: "You're offline. Changes saved when you reconnect."
- Auto-save form drafts to localStorage (see [HUPGP])
- Connection quality indicator in header: green (good), yellow (slow), red (offline)
- On reconnection: auto-refetch stale Apollo queries

---

### [OPULR] Error Boundaries

**Problem:** One component error kills the entire page.
**Rules:**

- Wrap each independent section in its own `react-error-boundary`
- Failing chart ≠ dead student list
- Fallback: section name + "Failed to load" + "Retry" button
- Log to Sentry with context: user ID, tenant ID, page, component name
- Critical pages (attendance, fees): offer "Try simplified view" in error fallback

---

### [OYTMH] Session Expiry

**Problem:** Session expires mid-form. Submit → redirect to login → form data lost.
**Rules:**

- Warning modal 5 minutes before expiry: "Session expires soon. Continue working?"
- "Continue" silently refreshes the token
- On actual expiry: preserve current URL + form state → after re-login, redirect back
- Combine with [HUPGP] draft auto-save as safety net

---

## FEEDBACK & COMMUNICATION

### [PAODR] Toast Behavior

**Problem:** Toasts disappear before user reads them, or error details are lost.
**Rules:**

- Success: 3–4 seconds, auto-dismiss
- Error: persist until manually dismissed, or 8 seconds minimum with progress bar
- Action toasts: include Undo button, persist 5 seconds. "Student deactivated. Undo"
- Position: bottom-right desktop, top-center mobile (Sonner defaults)
- Stack vertically — never replace one with another

---

### [PLNIH] Destructive Action Confirmation

**Problem:** Instant delete with no confirmation or undo.
**Rules:**

- Level 1 (reversible/soft-delete): toast with "Undo"
- Level 2 (significant): confirmation dialog with consequences: "Deleting this section removes 45 students from it."
- Level 3 (irreversible/catastrophic): type-to-confirm: "Type DELETE to permanently remove this institute"
- Never generic "Are you sure?" — always state what will happen

---

### [PRMVO] Long Operation Progress

**Problem:** Bulk ops take 30+ seconds. Spinner with no indication of progress.
**Rules:**

- Operations > 3 seconds: progress indicator with stages ("Promoting students... 23 of 200")
- Stream Temporal workflow progress via GraphQL subscription
- Allow navigation away — show progress in persistent notification widget: "Bulk promotion — 67%"
- On completion: in-app notification + optional browser push (via FCM)

---

### [PTUCK] Workflow Completion

**Problem:** Complex wizard completes. User lands on dashboard with no summary or next steps.
**Rules:**

- Completion screen with summary: "Institute set up! Created 3 sections, 12 subjects, 1 admin."
- Next step cards: "Enroll Students", "Set Up Timetable", "Configure Fees"
- Subtle success animation (checkmark, not confetti)

---

## RESPONSIVE DESIGN & MOBILE

### [PVTXG] Viewport Targets

**Problem:** Designed for 1920×1080. Breaks at common Indian office resolution (1366×768).
**Rules:**

- Primary design target: 1366×768
- Test at: 1366×768, 1280×720, 768×1024 (tablet), 360×800 (mobile)
- Sidebar: collapsible at < 1280px, hamburger on mobile
- Tables: fewer columns + "View Details" on narrow screens
- Consider PWA with bottom tab bar for mobile

---

### [QDPGR] Touch Targets

**Problem:** 20×20px action icons. Impossible to tap on cheap Android tablets.
**Rules:**

- Minimum touch target: 44×44px (Apple HIG) / 48×48dp (Material)
- Increase interactive element padding for mobile viewports
- Tables on mobile: entire row tappable for navigation to detail
- Swipe gestures for common actions (attendance: swipe right = present, left = absent)

---

### [QIGCL] Modal → Sheet on Mobile

**Problem:** 600×400px modals on 360px phone screens. Content overflows, close button unreachable.
**Rules:**

- Desktop: `<Dialog>` (shadcn). Mobile: `<Sheet>` (bottom slide-up)
- Responsive conditional rendering based on viewport
- Content must be scrollable, primary action button in sticky footer
- Swipe-down-to-close on mobile sheets

---

## MULTI-TENANCY UX

### [QJRQQ] Tenant Context Visibility

**Problem:** Super admin switches between institutes. No clear indicator of which institute is active.
**Rules:**

- Institute name + logo in header always visible
- Color-coded header/sidebar accent per institute (assign theme color on creation)
- Impersonation: amber overlay banner — always visible, not dismissible
- Institute switcher: current institute highlighted with checkmark

---

### [QPAGS] Client-Side Tenant Isolation

**Problem:** Dropdown shows data from wrong institute due to missing client-side tenant filter.
**Rules:**

- RLS handles DB-level isolation, but frontend must never rely on client-side filtering for tenant data
- Every Apollo query for tenant-scoped data goes through RLS-aware connection — no exceptions
- Dev mode: debug overlay showing active tenant ID on every query
- E2E tests: log in as two tenants, verify zero data overlap in every list view

---

### [QQRVH] Subscription Limit Surfacing

**Problem:** User hits a limit (500 students) and gets a cryptic server error.
**Rules:**

- Dashboard + list headers show usage: "Students: 498 / 500"
- Warning at > 90%: "Approaching student limit. Upgrade to add more."
- At limit: disable "Add" button + tooltip: "Limit reached. Upgrade to enroll more."
- Server returns specific error code → frontend maps to upgrade prompt, not generic 403
- Fetch limits + current usage in a single `institutePlan` query

---

## ACCESSIBILITY & I18N

### [QUVSN] Keyboard Navigation

**Problem:** Custom components (attendance grid, timetable) have no keyboard support.
**Rules:**

- Tab order flows logically through every form
- Escape closes topmost modal/dialog/popover
- Visible focus ring on all interactive elements (Tailwind `focus-visible:ring`)
- Custom grid components: arrow key navigation between cells
- shadcn/Radix handles most standard components — test custom ones manually

---

### [ROGXK] RTL Readiness

**Problem:** Urdu/Arabic support (relevant for many Indian institutions) would break the entire layout.
**Rules:**

- Use logical CSS properties from day 1: `ms-4`/`me-4` not `ml-4`/`mr-4`
- Tailwind v4 supports logical properties natively
- Periodically test with `dir="rtl"` on HTML element
- Directional icons (arrows, chevrons) must flip in RTL

---

### [RVSBJ] Color-Independent Indicators

**Problem:** Attendance = green/red/yellow. 8% of males are color-blind.
**Rules:**

- Always combine color + icon/shape: ✓ present (green), ✗ absent (red), ⏰ late (yellow)
- Status badges: color + text label (green "Active" badge, not just a green dot)
- Charts: patterns (stripes, dots) in addition to colors
- Test with Chrome DevTools → Rendering → Emulate vision deficiencies

---

### [SZWFX] i18n Readiness

**Problem:** Hardcoded English strings everywhere. Adding Hindi requires full codebase grep.
**Rules:**

- Wrap every user-facing string in `t()` via `next-intl` from day 1 (see [BUKTM])
- `/messages/{locale}/` organized by namespace per page/section
- Account for text expansion: Hindi is 30–40% longer than English equivalents
- Never concatenate translated strings — use ICU message format with placeholders
- Date/time formatting via `useFormatDate()` from `@roviq/i18n`, not manual

---

### [TRPFC] ARIA & Screen Reader Support

**Problem:** Dynamic content updates (toasts, live data, subscription pushes) invisible to screen readers.
**Rules:**

- Toast container: `role="status"` + `aria-live="polite"`
- Loading states: `aria-busy="true"` on the loading container
- Data table: proper `<table>` semantics or `role="grid"` with `aria-rowcount`/`aria-colcount`
- Modals: `aria-modal="true"`, focus trap, return focus to trigger on close
- Icon-only buttons: always have `aria-label`

---

## DASHBOARDS

### [TYJNS] Actionable Metrics

**Problem:** Vanity metrics ("Total Students: 547") provide zero insight.
**Rules:**

- Time-relative metrics: "12 students absent today", "5 fees overdue this week"
- Every metric answers "so what?" — if a number is unusual, what should the admin do?
- Trend indicators: ↑ 12% more attendance than last week
- Action items on dashboard: "4 students pending approval", "2 teachers without timetable"

---

### [UJQOC] Role-Specific Dashboards

**Problem:** Same dashboard for principal, teacher, accountant, and super admin.
**Rules:**

- Class teacher: today's attendance, my timetable, pending tasks
- Principal/Admin: enrollment trends, fee collection, staff attendance, alerts
- Accountant: fee summary, overdue payments, today's collection, outstanding
- Super Admin: system health, institute activity, subscription status, errors
- Widget customization: drag to reorder, hide/show, save layout per user

---

### [UQPCL] Chart Context

**Problem:** Bar chart with no scale, comparison, or interpretation.
**Rules:**

- Always show comparison: "vs. last year" or "vs. target"
- Annotations on significant events: "Summer break", "New academic year"
- Current value prominent next to chart title, not just inside the chart
- Negative trends → suggest action: "Fee collection down 15% — view overdue list"

---

## DOMAIN-SPECIFIC: ATTENDANCE

### [VTLRR] Bulk Attendance Grid

**Problem:** Click each of 60 students individually to mark attendance. 60 clicks.
**Rules:**

- Grid view: all students visible, default = "Present", teacher taps only absentees
- "Mark All Present" button at top, then adjust exceptions
- Student photos in grid for visual recognition
- Mobile: swipe right = present, swipe left = absent
- Save button at bottom with summary: "Present: 54 | Absent: 3 | Late: 2 | Leave: 1"

---

### [WINBA] Granular Attendance States

**Problem:** Binary present/absent doesn't capture reality (late, half-day, leave types).
**Rules:**

- States: Present, Absent, Late, Half-Day (AM/PM), On Leave (with leave type)
- "Late" auto-captures marking timestamp
- Half-day: select morning/afternoon session
- Summary bar at bottom of grid with counts per state

---

### [WODEL] Attendance Correction

**Problem:** Teacher submits, realizes mistake, can't edit without admin.
**Rules:**

- Editable within time window (same day until 11:59 PM) by class teacher
- After window: requires admin approval (audit log captures the change)
- "Review & Submit" confirmation screen with summary grid before submission
- Post-submission toast with "Undo" for 30 seconds

---

## DOMAIN-SPECIFIC: FEES & PAYMENTS

### [WRNVG] Fee Structure Clarity

**Problem:** Parents see a list of fee components with no explanation or total.
**Rules:**

- Summary card at top: "Total Annual Fee: ₹25,000"
- Breakdown with plain language: "Tuition Fee — Covers teaching and classroom expenses"
- Payment schedule: "₹6,250 per quarter, due 1st of Apr/Jul/Oct/Jan"
- RTE students: clearly show "Your child qualifies for RTE — ₹0 fee"
- Indian currency formatting throughout (see [HVJED])

---

### [XJLWH] Payment History / Ledger

**Problem:** Parent can't see payment status, allocation, or remaining balance.
**Rules:**

- Ledger view per student: date, description, debit, credit, running balance
- Each payment links to downloadable receipt (server-generated PDF)
- Overdue items: red highlight with due date and penalty amount
- Accessible to parents via parent portal — transparency builds trust

---

### [YPQTF] Payment Entry Safeguards

**Problem:** Accountant enters ₹6,250 but means ₹62,500. Or wrong student.
**Rules:**

- Indian-format amounts on blur: typing `62500` → `₹62,500`
- Large amounts (>₹10,000): confirmation dialog: "Recording ₹62,500 for Priyanshu Sharma. Confirm?"
- Bulk fee collection: summary screen before submission with row-level review
- No negative amounts. Reasonable max validation based on fee structure total

---

## REAL-TIME / SUBSCRIPTIONS

### [ZAQWT] Live Data Updates

**Problem:** Two admins view same list. Admin A changes data. Admin B sees stale data.
**Rules:**

- GraphQL subscriptions push changes to connected clients (graphql-ws)
- Changed rows: brief highlight animation (200ms background flash)
- Concurrent edits: "Modified by [other user] 30s ago. Reload to see changes."
- "Last updated: Xs ago" indicator on data-heavy pages

---

### [ZBKYJ] WebSocket Reconnection

**Problem:** WebSocket drops on mobile networks. UI shows stale data without indication.
**Rules:**

- graphql-ws reconnection with exponential backoff (already built-in)
- Subtle banner on disconnect: "Live updates paused. Reconnecting..."
- On reconnect: refetch all stale Apollo queries to catch missed events
- After 3 failed auto-reconnect attempts: manual "Reconnect" button

---

## ONBOARDING & FIRST-TIME EXPERIENCE

### [ZCNPW] Setup Checklist

**Problem:** First login → empty dashboard → no idea where to start.
**Rules:**

- Persistent setup checklist on dashboard until completed:
  1. Institute profile (completed in onboarding wizard)
  2. Academic year and sections
  3. Teachers and section assignment
  4. Student enrollment
  5. Fee structure
  6. Timetable
- Each item links to relevant page. Progress bar: "2 of 6 steps complete"
- Dismissible after all items done (or manually by admin)

---

### [ZDQKA] Contextual Field Help

**Problem:** User encounters "UDISE+ Code" and has no idea what to enter.
**Rules:**

- Field-level `(i)` tooltip: "UDISE+ is a unique 11-digit code assigned by the government. Find yours at udiseplus.gov.in"
- Complex pages: collapsible "How this works" section at top with 2–3 sentence explanation
- Link to video walkthrough for complex flows (Loom embed)
- Never use guided tours that highlight elements one-by-one — universally hated and dismissed

---

## PERFORMANCE & PERCEPTION

### [ZFVZD] Perceived Speed

**Problem:** 200ms API response feels slow due to jarring loading transitions.
**Rules:**

- Skeleton screens are the single biggest improvement (see [IMUXO], [MYORD])
- Page transitions: 150ms fade (framer-motion or CSS) — smoother than instant swap
- Prefetch likely next pages: on student list, prefetch first student detail in background
- Tab switching on detail pages: cache previous tab data for instant switch-back

---

### [ZGQBR] Bundle Size

**Problem:** 2MB+ JS bundle. 5+ second first load on 4G.
**Rules:**

- Dynamic imports for heavy components: `dynamic(() => import('./TimetableEditor'))`
- Lazy-load: Recharts, rich text editors, command palette, PDF viewers
- Check `next build --analyze` regularly
- Performance budget: main bundle < 200KB gzipped, total first paint < 500KB
- Use Next.js app router streaming SSR for immediate shell delivery

---

### [ZHXDF] Image & Asset Optimization

**Problem:** Unoptimized institute logos and student photos slow down list pages.
**Rules:**

- Use Next.js `<Image>` with `sizes` prop — automatic srcset and lazy loading
- Institute logos: pre-generate thumbnails (48px, 96px, 192px) on upload via sharp
- Student photos in grids: 48×48 thumbnails, full image only on detail page
- Placeholder: blurred low-res placeholder while image loads
- SVG icons via lucide-react — never icon fonts, never raw SVG imports per file

---

## SECURITY UX

### [ZJRNK] Active Session Visibility

**Problem:** Shared passwords (common in Indian schools). No way to see other active sessions.
**Rules:**

- Account settings: list active sessions with device, location, last active time
- "Sign out all other sessions" button
- New device/location login → notification: "New login from [device] in [location]"
- Encourage passkey adoption over passwords in onboarding flow

---

### [ZKFQP] Copy-Sensitive Data Feedback

**Problem:** User copies an Aadhaar number or API key. No confirmation, no warning.
**Rules:**

- Copy buttons on sensitive fields: "Copied!" toast with 2-second auto-dismiss
- For very sensitive data (Aadhaar, tokens): log copy action to audit trail
- Never display full sensitive values — show masked: `XXXX-XXXX-1234` with "Reveal" toggle
- Reveal toggle auto-hides after 10 seconds

---

## NOTIFICATION UX

### [ZLVWT] In-App Notification Center

**Problem:** Notifications only come via external channels (WhatsApp, email). No in-app awareness.
**Rules:**

- Bell icon in header with unread badge count
- Notification dropdown/panel: grouped by type, newest first
- Mark as read on click, "Mark all read" button
- Notification types: action required (red dot), informational (blue), success (green)
- Click navigates to relevant page (e.g., "Fee overdue" → student fee page)

---

### [ZMNHR] Push Notification Opt-In

**Problem:** Browser push prompt fires immediately on first visit. User denies. Can't re-prompt.
**Rules:**

- Never trigger browser permission prompt on first visit
- Show custom in-app banner first: "Enable notifications to stay updated on attendance and fees"
- Only trigger browser prompt after user clicks "Enable" on the banner
- If denied: show banner again after 7 days with "You can enable notifications in browser settings"
- FCM registration happens only after permission grant

---

## DRAG & DROP PATTERNS

### [ZNUKW] Timetable Editor

**Problem:** Timetable editing requires entering each period manually in form fields.
**Rules:**

- Drag-and-drop grid: subjects/teachers as draggable cards → drop onto period slots
- Visual conflict detection: highlight red if teacher already assigned to another section in same period
- Undo/redo support (Ctrl+Z / Ctrl+Y)
- Auto-save on drop with optimistic update
- Fallback: for mobile/accessibility, provide a form-based editor as alternative

---

### [ZOMPK] Section/Student Assignment

**Problem:** Assigning 200 students to sections one-by-one via dropdown.
**Rules:**

- Dual-list transfer pattern: unassigned students on left, sections on right, drag to assign
- Bulk select (shift+click, ctrl+click) and transfer
- Show count per section: "Section A (45 students)" with capacity indicator
- Undo bulk assignment within 30 seconds via toast

---
