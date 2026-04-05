# Cross-Portal Workflows

> Coverage: 4/14 (29%) | Last tested: 2026-04-05
> These require multiple browser tabs with different hostnames.

## X1. Institute Creation Flow

- [x] Reseller creates institute request (`reseller.localhost -> /institutes/new`) — "Sunrise Public School", SPS-JDH-01, all 5 departments, Jodhpur address
- [x] Admin sees pending institute immediately (`admin.localhost -> /institutes`, "Pending Approval" tab badge=1)
- [x] No memberships exist for the institute before approval (verified via DB — 0 rows)
- [x] Admin approves -> confirmation dialog -> status changes from PENDING_APPROVAL to PENDING
- [ ] Institute setup runs (Temporal workflow creates standards, sections, roles, admin user)
- [ ] Institute admin can log in (`localhost -> /institute/login`)

## X2. Billing Flow

- [ ] Reseller creates plan -> assigns to institute
- [ ] Invoice auto-generated for institute
- [ ] Institute sees invoice in `/billing/invoices`
- [ ] Institute pays via UPI P2P (submits UTR)
- [ ] Reseller sees unverified payment in `/billing/upi-verification`
- [ ] Reseller verifies -> payment confirmed -> invoice PAID

## X3. Impersonation Flow

- [ ] Admin triggers impersonation for institute user
- [ ] New tab opens at institute portal with impersonation code
- [ ] Amber banner shows impersonated user name
- [ ] Tab auto-closes after token expiry

## X4. Audit Trail Verification

- [ ] Action in institute portal -> visible in institute `/audit`
- [ ] Same action visible in admin `/audit-logs` (cross-tenant)
- [ ] Same action visible in reseller `/audit` (if reseller-scoped)
