ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER POLICY "membership_reseller_read" ON "memberships" RENAME TO "memberships_reseller_read";--> statement-breakpoint
CREATE POLICY "refresh_tokens_reseller_read" ON "refresh_tokens" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "users_app_select" ON "users" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (true);--> statement-breakpoint
CREATE POLICY "users_reseller_select" ON "users" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (true);--> statement-breakpoint
CREATE POLICY "users_admin_all" ON "users" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "payment_events_reseller_read" ON "payment_events" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (true);--> statement-breakpoint
CREATE POLICY "institute_notification_configs_reseller_read" ON "institute_notification_configs" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "academic_years_reseller_read" ON "academic_years" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "institute_affiliations_reseller_read" ON "institute_affiliations" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "institute_branding_reseller_read" ON "institute_branding" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "institute_configs_reseller_read" ON "institute_configs" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "institute_identifiers_reseller_read" ON "institute_identifiers" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "institutes_reseller_all" ON "institutes" AS PERMISSIVE FOR ALL TO "roviq_reseller" USING (reseller_id = current_setting('app.current_reseller_id', true)::uuid) WITH CHECK (reseller_id = current_setting('app.current_reseller_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "profiles_reseller_read" ON "profiles" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "roles_reseller_read" ON "roles" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "section_subjects_reseller_read" ON "section_subjects" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "sections_reseller_read" ON "sections" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "standard_subjects_reseller_read" ON "standard_subjects" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "standards_reseller_read" ON "standards" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "student_guardians_reseller_read" ON "student_guardians" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "subjects_reseller_read" ON "subjects" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
ALTER POLICY "institutes_app_select_trash" ON "institutes" TO "roviq_app" USING (
        deleted_at IS NOT NULL
        AND current_setting('app.include_deleted', true) = 'true'
      );--> statement-breakpoint
ALTER POLICY "memberships_reseller_read" ON "memberships" TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));