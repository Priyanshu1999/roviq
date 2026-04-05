# Institute Portal (`localhost:4200`)

> Coverage: 16/49 (33%) | Last tested: 2026-04-05

## Authentication

- [x] Login page loads at `/en/institute/login`
- [x] Dev credentials displayed: admin/admin123 (multi-institute picker), teacher1/teacher123 (single), student1/student123 (single)
- [x] Login with admin -> redirects to `/select-institute` (multi-institute picker)
- [ ] Login with teacher1 -> direct to dashboard (single institute, skips picker)
- [ ] Login with student1 -> direct to dashboard (single institute)
- [x] Passkey login button visible
- [ ] Invalid credentials -> error message

## Institute Selection (`/select-institute`)

- [x] Shows list of institutes user belongs to (2 cards: Demo Institute, Second Institute)
- [x] Each card: name, avatar letter (D/S), role (institute_admin)
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

- [x] Standards page renders 3 standards (Class 9, 10, 11) with columns (Name, Order, Level, Department, Board Exam, Stream, Actions)
- [x] Year selector works (dropdown, URL updates with ?year=UUID)
- [x] "New Standard" button visible
- [x] Table/By Department view toggle visible
- [x] Standard names are clickable links to detail pages
- [ ] Create new standard via "New Standard" button
- [ ] Standard detail page shows sections and subjects
- [ ] Edit/delete standard via action buttons

## Academic Years (`/academic-years`)

- [x] List renders with active year "2025-2026" (01 Apr 2025 - 31 Mar 2026), "No terms", "New Academic Year" button
- [ ] Create academic year
- [ ] Activate / Archive

## Billing

### Subscription Overview (`/billing`)

- [ ] Current subscription status
- [ ] Plan name, amount, period dates
- [ ] Entitlements card (max students, staff, storage)
- [ ] Status banners (PAST_DUE, PAUSED, CANCELLED)

### Invoices (`/billing/invoices`)

- [ ] Invoice list
- [ ] Invoice detail (`/billing/invoices/[id]`)
- [ ] UPI P2P: QR code + VPA + UTR form
- [ ] Online payment: Razorpay redirect
- [ ] Payment history per invoice
- [ ] PDF download

### Payments (`/billing/payments`)

- [ ] Payment list
- [ ] Method icons, status badges
- [ ] UPI verification status

## Settings

### Institute Settings (`/settings/institute`)

- [ ] Institute config page loads
- [ ] Editable fields save

### Notifications (`/settings/notifications`)

- [ ] Config matrix: types x channels
- [ ] Toggles persist via mutation

### Sessions (`/settings/sessions`)

- [ ] Sessions list
- [ ] Revoke single / all other

## Audit Logs (`/audit`)

- [ ] Table with institute-scoped logs
- [ ] Filters: entity type, action type, user, entity ID, date range
- [ ] Row click -> detail modal
- [ ] CASL permission guard

## Account (`/account`)

- [ ] Passkey manager

## Navigation

- [x] Sidebar groups: Overview (Dashboard, Users), Academic (Academic Years, Standards, Timetable), Billing (Subscriptions, Invoices, Payments), System (Audit Logs, Settings, Notification Preferences, Account)
- [ ] Nav items link correctly (all pages load without 404)
- [ ] Breadcrumbs correct
