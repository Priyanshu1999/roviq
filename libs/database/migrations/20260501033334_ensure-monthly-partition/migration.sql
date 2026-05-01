-- Generic monthly partition creator. Time-RANGE partitioned tables drift broken
-- the moment wall-clock crosses the last static partition's upper bound; this
-- function is idempotent so it can be called from app boot, daily timers, and
-- db-reset without coordination. See drizzle-database skill for the call sites.

-- SECURITY DEFINER + owned by roviq so callers (roviq_admin from withAdmin)
-- can create partitions of tables owned by the superuser without needing a
-- separate superuser pool — no special wiring in the app or in tests.
CREATE OR REPLACE FUNCTION ensure_monthly_partition(
  parent regclass,
  month_start timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  truncated_start timestamptz := date_trunc('month', month_start);
  truncated_end   timestamptz := date_trunc('month', month_start) + interval '1 month';
  parent_name     text := parent::text;
  partition_name  text := parent_name || to_char(truncated_start, '_YYYY_MM');
  is_partitioned  boolean;
BEGIN
  SELECT (relkind = 'p' AND
          (SELECT partstrat FROM pg_partitioned_table WHERE partrelid = parent) = 'r')
    INTO is_partitioned
    FROM pg_class WHERE oid = parent;

  IF NOT is_partitioned THEN
    RAISE EXCEPTION '% is not a RANGE-partitioned table', parent_name;
  END IF;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF %s FOR VALUES FROM (%L) TO (%L)',
    partition_name, parent_name, truncated_start, truncated_end
  );
END;
$$;

ALTER FUNCTION ensure_monthly_partition(regclass, timestamptz) OWNER TO roviq;
REVOKE ALL ON FUNCTION ensure_monthly_partition(regclass, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_monthly_partition(regclass, timestamptz) TO roviq_admin;

-- Backfill audit_logs from the earliest existing partition through current+6
-- months — covers any gap left by the static partition list and primes the
-- forward buffer the day this migration runs.
DO $$
DECLARE
  earliest_month timestamptz;
  current_month  timestamptz := date_trunc('month', NOW());
  i              integer;
BEGIN
  SELECT MIN(
      to_timestamp(
        (regexp_match(c.relname, '_(\d{4})_(\d{2})$'))[1]
          || '-' || (regexp_match(c.relname, '_(\d{4})_(\d{2})$'))[2]
          || '-01',
        'YYYY-MM-DD'
      )
    )
    INTO earliest_month
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    WHERE i.inhparent = 'audit_logs'::regclass;

  IF earliest_month IS NULL THEN
    earliest_month := current_month;
  END IF;

  FOR i IN 0..((EXTRACT(YEAR FROM age(current_month + interval '6 months', earliest_month)) * 12
                + EXTRACT(MONTH FROM age(current_month + interval '6 months', earliest_month)))::int)
  LOOP
    PERFORM ensure_monthly_partition(
      'audit_logs'::regclass,
      earliest_month + (i || ' months')::interval
    );
  END LOOP;
END;
$$;
