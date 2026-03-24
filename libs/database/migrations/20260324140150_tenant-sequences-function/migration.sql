-- ROV-152: next_sequence_value() — atomic increment + format (custom migration)
-- Cannot be defined in Drizzle schema — PostgreSQL functions require raw SQL.

CREATE OR REPLACE FUNCTION next_sequence_value(p_tenant_id UUID, p_sequence_name VARCHAR)
RETURNS TABLE (next_val BIGINT, formatted VARCHAR) AS $$
  UPDATE tenant_sequences
  SET current_value = current_value + 1
  WHERE tenant_id = p_tenant_id AND sequence_name = p_sequence_name
  RETURNING current_value, REPLACE(
    REPLACE(format_template, '{value:04d}', LPAD(current_value::text, 4, '0')),
    '{prefix}', COALESCE(prefix, '')
  )::varchar;
$$ LANGUAGE SQL;

-- GRANTs: all three roles can EXECUTE the function.
-- RLS on the underlying table controls which rows are visible/updatable.
GRANT EXECUTE ON FUNCTION next_sequence_value(UUID, VARCHAR) TO roviq_app;
GRANT EXECUTE ON FUNCTION next_sequence_value(UUID, VARCHAR) TO roviq_reseller;
GRANT EXECUTE ON FUNCTION next_sequence_value(UUID, VARCHAR) TO roviq_admin;

-- FORCE RLS (db:push only does ENABLE, not FORCE)
ALTER TABLE "tenant_sequences" FORCE ROW LEVEL SECURITY;