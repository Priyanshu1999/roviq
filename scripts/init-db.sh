#!/bin/bash
# Create roviq_admin role for RLS bypass (used by admin portal)
psql -U roviq -d roviq -c "CREATE ROLE roviq_admin WITH LOGIN PASSWORD 'roviq_admin_dev' BYPASSRLS;"
psql -U roviq -d roviq -c "GRANT ALL PRIVILEGES ON DATABASE roviq TO roviq_admin;"
psql -U roviq -d roviq -c "GRANT USAGE ON SCHEMA public TO roviq_admin;"
psql -U roviq -d roviq -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO roviq_admin;"
psql -U roviq -d roviq -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO roviq_admin;"
psql -U roviq -d roviq -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO roviq_admin;"
psql -U roviq -d roviq -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO roviq_admin;"
