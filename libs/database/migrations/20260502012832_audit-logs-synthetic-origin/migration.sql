-- ROV-243: Tag synthetic-context use in audit logs.
-- Adds synthetic_origin to audit_logs so reviewers can trace which workflow,
-- consumer, or seeder produced a row written by the synthetic-user actor
-- (NULL for normal JWT-driven requests).

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "synthetic_origin" text;
--> statement-breakpoint

-- Partial index — most rows are JWT-driven (NULL); reviewers filter by origin
-- when investigating workflow/consumer activity, so a partial index is the
-- right shape (small, lookup-only).
CREATE INDEX IF NOT EXISTS "audit_logs_synthetic_origin_idx"
  ON "audit_logs" ("synthetic_origin")
  WHERE "synthetic_origin" IS NOT NULL;
