# Roviq Development Environment
# Infra runs in Docker, apps run locally for fast iteration

load('ext://dotenv', 'dotenv')

# Auto-create .env from .env.example on first run
if not os.path.exists('.env'):
  local('cp .env.example .env', command_bat='copy .env.example .env')
  print('Created .env from .env.example')

# Load .env vars so all resources can access them
dotenv('./.env')

# Re-evaluate Tiltfile when .env changes
watch_file('.env')

# Package manager — auto-runs on dependency changes
local_resource(
  'pnpm-install',
  cmd='pnpm install',
  deps=['package.json'],
  labels=['setup'],
)

# Infrastructure (Postgres, Redis, NATS, MinIO, Temporal)
docker_compose('./docker/compose.infra.yaml')

# Mark infra resources
dc_resource('postgres', labels=['infra'])
dc_resource('redis', labels=['infra'])
dc_resource('nats', labels=['infra'])
dc_resource('minio', labels=['infra'])
dc_resource('temporal', labels=['infra'], resource_deps=['postgres'])
dc_resource('temporal-ui', labels=['infra'])

# Observability (Grafana, Prometheus, Loki, Tempo, OTel Collector)
dc_resource('otel-collector', labels=['observability'], resource_deps=['tempo', 'loki'])
dc_resource('prometheus', labels=['observability'])
dc_resource('tempo', labels=['observability'])
dc_resource('loki', labels=['observability'])
dc_resource('grafana', labels=['observability'], resource_deps=['prometheus', 'tempo', 'loki'],
            links=['http://localhost:3001'])

# Database migrations — auto-runs, retries until postgres is ready
local_resource(
  'db-migrate',
  cmd='''
    for i in $(seq 1 30); do
      if pnpm run db:migrate 2>/dev/null; then
        echo "Migration completed successfully"
        exit 0
      fi
      echo "Waiting for PostgreSQL... (attempt $i/30)"
      sleep 2
    done
    echo "Migration failed after 30 attempts"
    exit 1
  ''',
  deps=['libs/backend/prisma-client/prisma/migrations'],
  resource_deps=['pnpm-install', 'postgres'],
  labels=['database'],
)

# Prisma client generation — auto-runs after migration
local_resource(
  'db-generate',
  cmd='pnpm run db:generate',
  resource_deps=['db-migrate'],
  labels=['database'],
)

# Database seed — auto-runs after generation, skips if already seeded
local_resource(
  'db-seed',
  cmd='pnpm run db:seed',
  resource_deps=['db-generate'],
  labels=['database'],
)

# Database cleanup — manual trigger, nukes DB and re-triggers migration
local_resource(
  'db-clean',
  cmd='pnpm run db:reset && tilt trigger db-migrate && tilt trigger db-generate && tilt trigger db-seed',
  resource_deps=['postgres'],
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['database'],
)

# Prisma Studio — manual trigger, serves on default port (5555)
local_resource(
  'database-gui',
  serve_cmd='pnpm run db:studio',
  resource_deps=['postgres'],
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['database'],
  links=['http://localhost:5555'],
)

# API Gateway (NestJS)
local_resource(
  'api-gateway',
  labels=['backend'],
  serve_cmd='pnpm run dev:gateway',
  serve_dir='.',
  deps=[],
  resource_deps=['db-seed', 'redis', 'nats', 'otel-collector'],
  links=['http://localhost:3000/api/graphql'],
)

# Admin Portal (Next.js)
local_resource(
  'admin-portal',
  labels=['frontend'],
  serve_cmd='pnpm run dev:admin',
  serve_dir='.',
  deps=[],
  resource_deps=['api-gateway'],
  links=['http://localhost:4200'],
)

# Institute Portal (Next.js)
local_resource(
  'institute-portal',
  labels=['frontend'],
  serve_cmd='pnpm run dev:portal',
  serve_dir='.',
  deps=[],
  resource_deps=['api-gateway'],
  links=['http://localhost:4300'],
)

# Notification Service (NestJS)
local_resource(
  'notification-service',
  labels=['backend'],
  serve_cmd='pnpm run dev:notifications',
  serve_dir='.',
  deps=[],
  resource_deps=['db-seed', 'nats'],
  links=['http://localhost:3001/health'],
)
