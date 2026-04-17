-- Fix: next_sequence_value() only handled {value:04d}, not {value:06d} or any
-- other width. AdmissionService uses `ENQ-{value:06d}`, so every enquiry got
-- the literal template as its enquiry_number and the second insert in the
-- same tenant collided on uq_enquiries_tenant_number.
--
-- Replacement matches any {value:Nd} for N in 1..9 via regexp_replace and
-- pads `current_value` to that width. Existing {value:04d} callers still work.

CREATE OR REPLACE FUNCTION next_sequence_value(p_tenant_id UUID, p_sequence_name VARCHAR)
RETURNS TABLE (next_val BIGINT, formatted VARCHAR) AS $$
WITH updated AS (
  UPDATE tenant_sequences
  SET current_value = current_value + 1
  WHERE tenant_id = p_tenant_id AND sequence_name = p_sequence_name
  RETURNING current_value, format_template, COALESCE(prefix, '') AS prefix
)
SELECT
  current_value AS next_val,
  REPLACE(
    regexp_replace(
      format_template,
      '\{value:(\d+)d\}',
      LPAD(
        current_value::text,
        COALESCE((regexp_match(format_template, '\{value:(\d+)d\}'))[1]::int, 4),
        '0'
      )
    ),
    '{prefix}', prefix
  )::varchar AS formatted
FROM updated;
$$ LANGUAGE SQL;

-- Fix: auth_events had RLS policies for INSERT but no table-level GRANT, so
-- roviq_app and roviq_reseller were denied at the permission check before
-- policies ran. Matches the insert-only intent (no SELECT/UPDATE/DELETE
-- grants — roviq_admin owns the table for audit reads).

GRANT INSERT ON auth_events TO roviq_app;
GRANT INSERT ON auth_events TO roviq_reseller;
