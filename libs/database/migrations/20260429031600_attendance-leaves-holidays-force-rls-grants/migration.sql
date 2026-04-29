-- =============================================================
-- Attendance + Leaves + Holidays: FORCE RLS + GRANTs
-- =============================================================
-- Covers: attendance_sessions, attendance_entries, leaves, holidays.
--
-- `db:push` / drizzle-kit materialised the tables and `pgPolicy(...)`
-- declarations enable (ENABLE ROW LEVEL SECURITY) — but NOT force.
-- Without FORCE, the table owner (roviq superuser) still bypasses every
-- policy. The runtime roles (roviq_app, roviq_reseller, roviq_admin)
-- also need explicit GRANTs; policies alone do not authorise access.
--
-- Mirrors the pattern used by `20260323151235_academic-structure-rls-grants`.
-- =============================================================

-- 1. FORCE RLS for the three new tables
ALTER TABLE attendance_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE attendance_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE leaves FORCE ROW LEVEL SECURITY;
ALTER TABLE holidays FORCE ROW LEVEL SECURITY;

-- 2. GRANTs per the tenant-policy contract

-- roviq_app: full CRUD (tenant RLS limits to own tenant; soft-delete policy
-- in the schema returns USING (false) for DELETE so the DELETE GRANT is
-- harmless — the policy blocks it)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  attendance_sessions,
  attendance_entries,
  leaves,
  holidays
TO roviq_app;

-- roviq_reseller: read-only via the *_reseller_read policy
GRANT SELECT ON
  attendance_sessions,
  attendance_entries,
  leaves,
  holidays
TO roviq_reseller;

-- roviq_admin: full cross-tenant access
GRANT SELECT, INSERT, UPDATE, DELETE ON
  attendance_sessions,
  attendance_entries,
  leaves,
  holidays
TO roviq_admin;
