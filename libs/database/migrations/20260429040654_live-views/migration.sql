-- ROV: <table>_live security_invoker views — soft-delete visibility moves to
-- the application layer. RLS now handles tenant isolation only.
--
-- The view definitions themselves come from `libs/database/src/schema/live-views.ts`
-- (Drizzle pgView with `.as((qb) => qb.select().from(table).where(isNull(deletedAt)))`),
-- so `drizzle-kit push` issues the `CREATE VIEW <name> AS …` statements.
-- This migration completes the picture by:
--
--   1. Setting `WITH (security_invoker = true)` on each view so SELECT runs
--      RLS as the calling role (roviq_app/roviq_reseller/roviq_admin) instead
--      of the view owner. Without this, an roviq_app connection would read
--      every tenant's rows because RLS would evaluate as the owner.
--   2. Granting SELECT on each view to the three app DB roles.
--
-- ALTER VIEW … SET (security_invoker = true) is supported on PG 15+.
-- The DO block uses information_schema so a missing view (e.g. during initial
-- bootstrap when this migration runs before push) is a no-op rather than a
-- fatal error.

DO $$
DECLARE
  v TEXT;
  views TEXT[] := ARRAY[
    'institutes_live',
    'institute_group_branding_live',
    'academic_years_live',
    'attendance_entries_live',
    'attendance_sessions_live',
    'holidays_live',
    'institute_affiliations_live',
    'institute_branding_live',
    'institute_configs_live',
    'institute_identifiers_live',
    'leaves_live',
    'memberships_live',
    'roles_live',
    'sections_live',
    'section_subjects_live',
    'standards_live',
    'standard_subjects_live',
    'subjects_live',
    'admission_applications_live',
    'enquiries_live',
    'issued_certificates_live',
    'tc_register_live',
    'groups_live',
    'bot_profiles_live',
    'guardian_profiles_live',
    'staff_profiles_live',
    'student_academics_live',
    'student_profiles_live'
  ];
BEGIN
  FOREACH v IN ARRAY views LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = v
    ) THEN
      EXECUTE format('ALTER VIEW %I SET (security_invoker = true)', v);
      EXECUTE format('GRANT SELECT ON %I TO roviq_app, roviq_reseller, roviq_admin', v);
    END IF;
  END LOOP;
END $$;
