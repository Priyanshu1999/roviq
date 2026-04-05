# Institute Portal (`localhost:4200`)

> Coverage: 30/49 (61%) | Last tested: 2026-04-05

## Authentication

- [x] Login page loads at `/en/institute/login`
- [x] Dev credentials displayed: admin/admin123 (multi-institute picker), teacher1/teacher123 (single), student1/student123 (single)
- [x] Login with admin -> redirects to `/select-institute` (multi-institute picker)
- [x] Login with teacher1 -> direct to dashboard (single institute, skips picker)
- [x] Login with student1 -> direct to dashboard (single institute)
- [x] Passkey login button visible
- [x] Invalid credentials -> "Invalid credentials" error message

## Institute Selection (`/select-institute`)

- [x] Shows list of institutes user belongs to (2 cards: Saraswati Vidya Mandir, Rajasthan Public School)
- [x] Each card: name, avatar letter (S/R), role (institute_admin)
- [x] Click card -> selects institute, redirects to `/dashboard`
- [ ] Single-institute users skip this page automatically

## Impersonation (`/auth/impersonate`)

- [ ] Code exchange page processes URL param
- [ ] Token stored in sessionStorage
- [ ] Amber banner shown
- [ ] Auto-closes on token expiry

## Dashboard (`/dashboard`)

- [x] Welcome card "Welcome to your Institute" with setup instructions
- [x] Get Started CTAs: No Students Enrolled (-> /students), No Teachers Assigned (-> /teachers), No Standards Configured (-> /standards)
- [x] Quick Links: Manage Standards, Manage Subjects, Manage Users, View Settings
- [ ] Impersonation banner when impersonated

## Academics (`/academics`)

- [x] Standards page renders 15 standards (Nursery through Class 12) with columns (Name, Order, Level, Department, Board Exam, Stream)
- [x] Year selector works (dropdown, URL updates with ?year=UUID)
- [x] "New Standard" button visible
- [x] Table/By Department view toggle visible
- [x] Standard names are clickable links to detail pages
- [x] Board Exam icon shows for Class 10 and 12
- [x] Stream icon shows for Class 11 and 12
- [x] Levels correct: Pre-Primary (Nursery–UKG), Primary (1–5), Upper Primary (6–8), Secondary (9–10), Senior Secondary (11–12)
- [ ] Create new standard via "New Standard" button
- [ ] Standard detail page shows sections and subjects
- [ ] Edit/delete standard via action buttons

## Academic Years (`/academic-years`)

- [x] List renders with active year "2026-2027" (01 Apr 2026 - 31 Mar 2027), "New Academic Year" button
- [ ] Create academic year
- [ ] Activate / Archive

## Billing

### Subscription Overview (`/billing`)

- [x] Page loads with "No Active Subscription" message (Bug #11 — mySubscription resolver not implemented, ROV-119/142)
- [ ] Current subscription status (blocked by ROV-119)
- [ ] Plan name, amount, period dates
- [ ] Entitlements card (max students, staff, storage)
- [ ] Status banners (PAST_DUE, PAUSED, CANCELLED)

### Invoices (`/billing/invoices`)

- [x] Page loads with "No invoices yet" empty state
- [ ] Invoice detail (`/billing/invoices/[id]`)
- [ ] UPI P2P: QR code + VPA + UTR form
- [ ] Online payment: Razorpay redirect
- [ ] Payment history per invoice
- [ ] PDF download

### Payments (`/billing/payments`)

- [x] Page loads with "No payments recorded yet" empty state
- [ ] Method icons, status badges
- [ ] UPI verification status

## Settings

### Institute Settings (`/settings/institute`)

- [ ] Institute config page loads (404 — page not yet created)
- [ ] Editable fields save

### Notifications (`/settings/notifications`)

- [x] Page loads (200 OK)
- [ ] Config matrix: types x channels
- [ ] Toggles persist via mutation

### Sessions (`/settings/sessions`)

- [x] Sessions list renders with active session
- [x] Each session shows user agent, IP address, created date
- [x] "Revoke" button per session + "Revoke All Other Sessions" button
- [ ] Revoke single / all other sessions

## Audit Logs (`/audit`)

- [x] Page loads with table and filters (Entity type, Action type, From, To)
- [x] Shows "No audit logs yet" empty state with proper message
- [x] "Showing 0 of 0" count
- [ ] Filters: entity type, action type, user, entity ID, date range
- [ ] Row click -> detail modal
- [ ] CASL permission guard

## Account (`/account`)

- [x] Passkey manager loads with "Add passkey" button and "No passkeys registered yet" empty state

## Navigation

- [x] Sidebar groups: Overview (Dashboard, Users), Academic (Academic Years, Standards, Timetable), Billing (Subscriptions, Invoices, Payments), System (Audit Logs, Settings, Notification Preferences, Account)
- [x] Breadcrumbs render on pages
- [ ] Users page (404 — not yet created)
- [ ] Timetable page (404 — not yet created)
- [ ] Settings page (404 — not yet created, /settings/sessions and /settings/notifications work)
