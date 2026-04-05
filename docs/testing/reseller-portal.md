# Reseller Portal (`reseller.localhost:4200`)

> Coverage: 74/140 (53%) | Last tested: 2026-04-05

## Authentication

- [x] Login page loads at `/en/reseller/login`
- [x] Dev credentials displayed (reseller1 / reseller123)
- [x] Login with valid credentials -> redirects to `/dashboard`
- [x] Session auto-redirects to dashboard if already logged in
- [ ] Login with invalid credentials -> error message
- [ ] Login with empty fields -> validation errors
- [ ] Passkey login button visible and clickable
- [ ] Session persists on page refresh
- [ ] Logout -> redirects to login, clears tokens
- [ ] Token refresh works silently (after 10 min TTL)

## Dashboard (`/dashboard`)

- [x] Page loads with welcome card ("Reseller Dashboard")
- [x] Quick links render: View Institutes, Manage Team, View Settings
- [x] Quick links navigate to correct pages
- [ ] Theme toggle (light/dark) works
- [ ] Language switch (EN/HI) works and persists

## Institutes (`/institutes`)

### List View

- [x] Table: Name, Code, Type, Status, Group, Created
- [x] Shows "Showing 2 of 2" count
- [x] Search by name filters (typed "Demo" -> 1 result)
- [x] URL updates with `?search=Demo` (nuqs)
- [x] "Clear filters" button appears when filter active
- [ ] Status filter dropdown
- [ ] Type filter dropdown
- [ ] Group filter
- [ ] "Awaiting Approval" tab
- [ ] Empty state when no results match

### Institute Detail (`/institutes/[id]`)

- [x] Row click navigates to detail page
- [x] Overview tab: Identity card (Name, Code, Type, Framework, Timezone, Currency, Group)
- [x] Contact section renders
- [x] Academic Structure tab renders
- [x] Tab selection persists in URL (`?tab=academic`)
- [x] Breadcrumb shows institute name (Bug #1 fixed)
- [ ] Compliance Data tab content
- [ ] Users tab content
- [ ] Audit Log tab content
- [ ] Suspend -> confirmation -> status changes
- [ ] Reactivate -> status back to ACTIVE

### Create Institute (`/institutes/new`)

- [x] Form renders: name (EN/HI), code, type, framework, board, departments (5 checkboxes), group, phone (+91), address
- [x] Hindi i18n field accepts Devanagari: "सनराइज़ पब्लिक स्कूल"
- [x] Department checkboxes show translated labels (was Bug — i18n key casing fixed)
- [x] State dropdown populates with Indian states, selects correctly (Rajasthan)
- [x] Submit creates institute -> redirects to list with "Awaiting Approval" status
- [x] New institute shows code (SPS-JDH-01), type (School), created time
- [ ] Form validation: empty required fields -> error messages
- [ ] Error: duplicate institute code -> error toast
- [ ] Error: duplicate slug

### Institute Groups (`/institute-groups`)

- [ ] Page loads
- [ ] List renders (or empty state)
- [ ] Create group

## Billing Dashboard (`/billing/dashboard`)

- [x] 4 KPI cards: MRR, Active Subs, Churn Rate, Overdue Invoices
- [x] Subscriptions by Status chart
- [x] Revenue Trend placeholder
- [ ] KPI cards update with real data
- [ ] Indian currency formatting

## Plans (`/billing/plans`)

### List

- [x] Table: Name, Amount, Interval, Status, Subscribers, Created, Actions
- [x] 3 plans: Basic Plan, Pro, Free
- [x] Status badges, subscriber count, amount formatting
- [x] "Create Plan" button

### Create Plan

- [x] Dialog: Plan Name (EN/HI), Code, Description (EN/HI), Amount, Interval, Trial Days, Sort Order, Max Students/Staff/Storage
- [x] Hindi i18n: "बेसिक प्लान"
- [x] Submit creates plan (verified in DB: 500000 paise)
- [ ] Validation: empty name, duplicate code
- [ ] Interval options: Monthly, Quarterly, Half-Yearly, Yearly

### Edit Plan

- [x] Action menu: Edit Plan, Archive, Delete
- [ ] Edit dialog with prefilled data
- [ ] Save changes
- [ ] Plan Code read-only in edit

### Plan Lifecycle

- [ ] Archive -> ARCHIVED badge
- [ ] Restore -> ACTIVE
- [ ] Delete -> confirmation -> removed
- [ ] Cannot delete with active subscribers

## Subscriptions (`/billing/subscriptions`)

- [x] Table: Institute, Plan, Status, Period Ends, Created
- [x] Empty state, status filter, "Assign Plan" button
- [x] Assign dialog: Institute + Plan selects (both institutes shown — Bug #10 fix confirmed)
- [x] Assign plan -> subscription created (Free plan to Saraswati Vidya Mandir)
- [x] Subscription shows in table: institute name, plan name, amount, status=Active, period dates
- [!] **BUG #12 (FIXED)**: `roviq_reseller` GRANTs lost after db-clean — added to `db-reset.ts` + `init-db.sh`
- [!] **BUG #13 (FIXED)**: Free plan toast said "Share checkout URL" — split message for free vs paid
- [ ] Status filter works
- [ ] Detail drawer
- [ ] Cancel/Pause/Resume

## Invoices (`/billing/invoices`)

- [x] Page loads (empty state)
- [ ] Table after subscriptions exist
- [ ] Status filter, detail drawer
- [ ] Record Payment, Refund, PDF download

## Payment Gateways (`/billing/gateway-configs`)

- [x] Shows UPI_DIRECT config with VPA
- [x] "Add Gateway" button
- [x] VPA autofills in edit (Bug #2 fixed)
- [ ] Create RAZORPAY/CASHFREE gateway
- [ ] Edit/Delete gateway

## UPI Verification (`/billing/upi-verification`)

- [x] Empty state: "No unverified UPI payments."
- [ ] Table with payments, verify/reject, nav badge

## Audit Logs (`/audit`)

- [x] Table with real data, columns, type badges
- [ ] Filters (entity type, action type, date range)
- [ ] Detail side-sheet, trace page, pagination

## Sessions (`/settings/sessions`)

- [x] Sessions list (curl sessions visible)
- [x] User agent, IP, created date per session
- [x] Revoke + Revoke All buttons
- [ ] Current session badge
- [ ] Revoke actions work

## Account (`/account`)

- [x] Passkey manager, empty state, "+ Add passkey"
- [ ] Add/remove passkey flow
