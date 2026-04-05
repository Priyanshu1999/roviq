# Admin Portal (`admin.localhost:4200`)

> Coverage: 28/41 (68%) | Last tested: 2026-04-05

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
- [x] Shows institutes with updated names (Saraswati Vidya Mandir, Rajasthan Public School)
- [x] "Pending Approval" tab shows count badge when pending institutes exist
- [x] "Create Institute" button visible
- [x] All statuses, types, boards filter dropdowns visible
- [!] **BUG #6 (FIXED)**: Was querying `institutes` (InstituteScope) instead of `adminListInstitutes` (PlatformScope)
- [ ] Search by name/code
- [ ] Status filter dropdown functional
- [ ] Type filter dropdown functional
- [ ] Board filter dropdown functional

### Detail (`/institutes/[id]`)

- [x] Overview tab: Identity (name, code, type, framework=NEP, timezone, currency)
- [x] Contact section: Phone numbers with labels (Office, Landline), emails with labels (General, Principal)
- [x] Address: Full Indian address (12 Sector 14, Near Civil Hospital, Gurugram, Haryana)
- [x] Regulatory Identifiers table: UDISE_PLUS (06130100501), CBSE_AFFILIATION (530456)
- [x] Board Affiliations table: CBSE REGULAR, affiliation number, granted level "Senior Secondary (Class XII)"
- [x] Breadcrumb shows institute name (uses `useBreadcrumbOverride`)
- [x] 5 tabs: Overview, Academic Structure, Configuration, Branding, Audit Log
- [x] Approve button visible for PENDING_APPROVAL institutes (Bug #8 fixed)
- [x] Approve -> confirmation dialog "Activate Institute" -> status changes to PENDING
- [x] After approval (PENDING): Reject + Delete buttons shown
- [x] For ACTIVE institutes: Deactivate, Suspend, Delete buttons shown (correct per entity lifecycle)
- [!] **BUG #7 (FIXED)**: Detail was querying `institute(id)` (InstituteScope) instead of `adminGetInstitute(id)`
- [!] **BUG #8 (FIXED)**: No Approve button for PENDING_APPROVAL — added with i18n key
- [!] **BUG (entity-lifecycle violation FIXED)**: Was using generic `adminUpdateInstituteStatus(id, status)` — replaced with named mutations
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

- [x] Table renders with columns: Timestamp, Actor, Action, Type, Entity, Entity ID, Source, IP Address
- [x] 3 tabs visible: All Events, Impersonation, Reseller Activity
- [x] Empty state "No audit logs yet" with proper message on fresh DB
- [ ] Entity type filter
- [ ] Action type filter
- [ ] User ID filter
- [ ] Row click -> detail side-sheet
- [ ] Correlation ID -> trace page
- [ ] "Load More" pagination

## Observability (`/observability`)

- [x] Page loads with Grafana iframe area (empty when Grafana not running)

## Sessions (`/settings/sessions`)

- [x] Sessions list renders with active sessions
- [x] Shows user agent, IP, created date per session
- [x] Revoke + Revoke All Other Sessions buttons visible
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

- [x] Reseller creates institute request (`reseller.localhost -> /institutes/new`) — with all departments, address
- [x] Admin sees pending institute immediately (`admin.localhost -> /institutes`, "Pending Approval" tab badge)
- [x] No memberships exist for the institute before approval (verified via DB — 0 rows)
- [x] Admin approves -> confirmation dialog -> status changes from PENDING_APPROVAL to PENDING
- [ ] After Temporal setup completes -> status changes to ACTIVE, admin user provisioned
- [ ] Institute admin can login at institute portal
