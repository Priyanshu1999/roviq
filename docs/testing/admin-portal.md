# Admin Portal (`admin.localhost:4200`)

> Coverage: 20/41 (49%) | Last tested: 2026-04-05

## Authentication

- [x] Login page loads at `/en/admin/login`
- [x] Dev credentials displayed (admin / admin123)
- [x] Login with valid credentials -> redirects to `/dashboard`
- [x] Session auto-redirects to dashboard if already logged in
- [ ] Invalid credentials -> error message
- [ ] Passkey login button visible

## Dashboard (`/dashboard`)

- [x] Welcome card "Welcome to Roviq Admin" renders
- [x] Quick links: Manage Institutes (with description), Manage Users, View Audit Logs, View Settings
- [x] Quick links navigate correctly

## Institutes (`/institutes`)

### List

- [x] Table: Name, Code, Type, Status, Reseller, Group, Affiliations, Created
- [x] Shows 3 institutes (Demo, Second, Sunrise Public School)
- [x] "Pending Approval" tab shows count badge (1) when pending institutes exist
- [!] **BUG #6 (FIXED)**: Was querying `institutes` (InstituteScope) instead of `adminListInstitutes` (PlatformScope)
- [ ] Search by name/code
- [ ] Status filter dropdown
- [ ] Type filter dropdown
- [ ] Board filter dropdown

### Detail (`/institutes/[id]`)

- [x] Overview tab: Identity (name, code, type, framework, timezone, currency), Contact (phone with Primary/WhatsApp badges), Address (full Indian address)
- [x] Breadcrumb shows institute name (uses `useBreadcrumbOverride`)
- [x] 6 tabs: Overview, Setup Progress, Academic Structure, Configuration, Branding, Audit Log
- [x] Approve button visible for PENDING_APPROVAL institutes (Bug #8 fixed)
- [x] Approve -> confirmation dialog "Activate Institute" -> status changes to PENDING
- [x] After approval (PENDING): Reject + Delete buttons shown (correct — PENDING can transition to REJECTED per domain model, e.g. admin changes mind before setup completes)
- [!] **BUG #7 (FIXED)**: Detail was querying `institute(id)` (InstituteScope) instead of `adminGetInstitute(id)`
- [!] **BUG #8 (FIXED)**: No Approve button for PENDING_APPROVAL — added with i18n key
- [!] **BUG (entity-lifecycle violation FIXED)**: Was using generic `adminUpdateInstituteStatus(id, status)` — replaced with named mutations: `adminDeactivateInstitute`, `adminSuspendInstitute`
- [ ] Reject with reason -> status REJECTED
- [ ] Deactivate -> status INACTIVE
- [ ] Suspend with reason -> status SUSPENDED
- [ ] Delete -> soft deleted
- [ ] Restore -> un-deleted

### Create (`/institutes/new`)

- [ ] Form loads with all fields
- [ ] Successful creation
- [ ] Reseller assignment

## Institute Groups (`/institute-groups`)

- [x] List page renders with table (Name, Code, Type, Registration No., Status)
- [x] Empty state with "New Group" button
- [x] Create group form (name, code, type=Trust, reg no, reg state, contact, address with state/pin/lat/lng)
- [x] Successfully created "Delhi Public School Society" (dps-society, Trust, REG/DL/2024/12345, Active)
- [ ] Group detail page shows assigned institutes
- [ ] Edit group
- [ ] Assign/remove institutes from group

## Audit Logs (`/audit-logs`)

- [x] Table renders with real data (createSubscriptionPlan, updateGatewayConfig entries from reseller session)
- [x] 3 tabs visible: All Events, Impersonation, Reseller Activity
- [x] Columns: Timestamp, Actor, Action, Type, Entity, Entity ID, Source, IP Address
- [ ] Entity type filter
- [ ] Action type filter
- [ ] User ID filter
- [ ] Row click -> detail side-sheet
- [ ] Correlation ID -> trace page
- [ ] "Load More" pagination

## Observability (`/observability`)

- [x] Page loads with Grafana iframe area (empty when Grafana not running)

## Sessions (`/settings/sessions`)

- [ ] Sessions list renders (same fix as Bug #5 applied)
- [ ] Revoke single / all other sessions

## Account (`/account`)

- [ ] Passkey manager renders
- [ ] Add/remove passkey

## Navigation

- [x] Sidebar: Overview (Dashboard, Institutes, Institute Groups, Users), System (Roles, Audit Logs, Observability, Settings, Account)
- [ ] Users page (graceful 404 or stub)
- [ ] Roles page (graceful 404 or stub)
- [ ] Breadcrumbs correct on all pages

## Cross-Portal: Institute Creation Flow (VERIFIED)

- [x] Reseller creates "Sunrise Public School" at `/institutes/new` -> status PENDING_APPROVAL
- [x] Admin sees it immediately at `/institutes` with amber "Pending Approval" badge and count=1 on tab
- [x] No users can login to the institute before approval (0 memberships in DB)
- [x] Admin clicks Approve -> confirmation dialog -> status changes to PENDING (setup begins)
- [ ] After Temporal setup completes -> status changes to ACTIVE, admin user provisioned
- [ ] Institute admin can login at institute portal
