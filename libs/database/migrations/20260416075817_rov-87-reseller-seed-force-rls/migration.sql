-- =============================================================
-- ROV-87: Seed 'Roviq Direct' system reseller + FORCE RLS on
-- reseller tables (Auth PRD v3.1 §7, §8)
-- =============================================================
-- The resellers table and reseller_id on institutes were created
-- in the baseline migration (with corrected UPPER_SNAKE enum values).
-- This migration:
--   1. Seeds the "Roviq Direct" system reseller with the canonical
--      deterministic UUID used throughout the codebase.
--   2. Enforces FORCE ROW LEVEL SECURITY on reseller tables.
--      (Drizzle's .enableRLS() only sets ENABLE, not FORCE.)
--
-- GRANTs for roviq_reseller/roviq_app on these tables are handled
-- entirely by the subsequent ROV-89 migration (20260416075819).
-- =============================================================

-- 1. Seed "Roviq Direct" system reseller (idempotent).
--    UUID '00000000-0000-4000-a000-000000000011' is the canonical
--    seed ID defined in scripts/seed-ids.ts. It is also the column
--    default for institutes.reseller_id.
INSERT INTO resellers (id, name, slug, is_system, tier, status)
VALUES (
  '00000000-0000-4000-a000-000000000011',
  'Roviq Direct',
  'roviq-direct',
  true,
  'FULL_MANAGEMENT',
  'ACTIVE'
)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- 2. FORCE RLS on reseller tables.
--    Drizzle's .enableRLS() sets ENABLE but NOT FORCE. Without FORCE,
--    the table owner (roviq superuser) bypasses all policies silently
--    — the safe failure mode is broken. FORCE ensures every query
--    goes through RLS even for the owner.
ALTER TABLE resellers FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE reseller_memberships FORCE ROW LEVEL SECURITY;
