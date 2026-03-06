-- Memberships RLS
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_memberships ON memberships
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- Profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_profiles ON profiles
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- Student Guardians RLS
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_guardians FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_student_guardians ON student_guardians
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);
