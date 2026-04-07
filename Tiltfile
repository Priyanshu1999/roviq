# Roviq Development Environment
# Infra runs in Docker, apps run locally for fast iteration
# Resources ordered so dev pipeline appears first in Tilt UI

load('ext://dotenv', 'dotenv')

# Auto-create .env from .env.example on first run
if not os.path.exists('.env'):
  local('cp .env.example .env', command_bat='copy .env.example .env')
  print('Created .env from .env.example')

# Load .env vars so all resources can access them
dotenv('./.env')

# Re-evaluate Tiltfile when .env changes
watch_file('.env')

# ─── Dev (startup pipeline + apps) ───────────────────────────────────────────

# Package manager — auto-runs on dependency changes
local_resource(
  'pnpm-install',
  cmd='pnpm install',
  deps=['package.json'],
  labels=['dev'],
)

# Schema push — auto-runs, retries until postgres is ready
local_resource(
  'db-push',
  cmd='''
    for i in $(seq 1 30); do
      if pnpm run db:push 2>/dev/null; then
        echo "Schema push completed successfully"
        exit 0
      fi
      echo "Waiting for PostgreSQL... (attempt $i/30)"
      sleep 2
    done
    echo "Schema push failed after 30 attempts"
    exit 1
  ''',
  deps=['libs/database/src/schema'],
  resource_deps=['pnpm-install', 'postgres'],
  labels=['dev'],
)

# Database seed — auto-runs after schema push, skips if already seeded
local_resource(
  'db-seed',
  cmd='pnpm run db:seed',
  resource_deps=['db-push'],
  labels=['dev'],
)

# API Gateway (NestJS) — core backend, all frontends depend on this
# Dev server watches apps/api-gateway/src and ee/apps/api-gateway/src via tsconfig
local_resource(
  'api-gateway',
  labels=['dev'],
  serve_cmd='pnpm run dev:gateway',
  serve_dir='.',
  deps=[],
  resource_deps=['db-push', 'redis', 'nats'],
  readiness_probe=probe(
    http_get=http_get_action(port=3000, path='/api/health'),
    period_secs=10,
  ),
  links=['http://localhost:3000/api/graphql'],
)

# GraphQL Codegen — watches schema introspection + document files, regenerates types
# Uses @parcel/watcher for efficient file monitoring. Waits for API to be healthy first.
local_resource(
  'codegen',
  labels=['dev'],
  serve_cmd='pnpm codegen --watch',
  serve_dir='.',
  deps=[],
  resource_deps=['api-gateway'],
)

# Web (Next.js) — merged admin + institute portal
local_resource(
  'web',
  labels=['dev'],
  serve_cmd='pnpm run dev:web',
  serve_dir='.',
  deps=['.env'],
  resource_deps=['pnpm-install'],
  links=['http://localhost:4200'],
)

# Notification Service (NestJS) — async event processing via NATS
local_resource(
  'notification-service',
  labels=['dev'],
  serve_cmd='pnpm run dev:notifications',
  serve_dir='.',
  deps=[],
  resource_deps=['db-push', 'nats'],
  auto_init=False,
)

# ─── Infra ────────────────────────────────────────────────────────────────────

docker_compose('./docker/compose.infra.yaml')

# Core infra — required for all dev work
dc_resource('postgres', labels=['infra'])
dc_resource('redis', labels=['infra'])
dc_resource('nats', labels=['infra'],
            links=['http://localhost:8222'])
dc_resource('mongodb', labels=['infra'])
dc_resource('minio', labels=['infra'],
            links=['http://localhost:9001'])

# Temporal — workflow engine, only needed when working on async workflows
dc_resource('temporal', labels=['infra'], resource_deps=['postgres'])
dc_resource('temporal-ui', labels=['infra'], auto_init=False,
            links=['http://localhost:8233'])

# ─── Novu Self-Hosted (manual) ───────────────────────────────────────────────
# Start manually when working with local notifications
# Dashboard: http://localhost:4000 | API: http://localhost:3340

docker_compose('./docker/compose.novu.yaml')

dc_resource('novu-api', labels=['novu'], resource_deps=['redis', 'mongodb'],
            auto_init=False, links=['http://localhost:3340'])
dc_resource('novu-worker', labels=['novu'], resource_deps=['novu-api'],
            auto_init=False)
dc_resource('novu-ws', labels=['novu'], resource_deps=['novu-api'],
            auto_init=False, links=['http://localhost:3342'])
dc_resource('novu-dashboard', labels=['novu'], resource_deps=['novu-api'],
            auto_init=False, links=['http://localhost:4000'])

# One-click setup: register, get API key, update .env, remove branding, sync bridge
local_resource(
  'novu-setup',
  cmd='scripts/novu-setup.sh',
  resource_deps=['novu-api'],
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['novu'],
)

# ─── DB Utils ─────────────────────────────────────────────────────────────────

# Database cleanup — nukes DB and re-runs full pipeline
local_resource(
  'db-clean',
  cmd='pnpm run db:reset --seed',
  resource_deps=['postgres'],
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['dev-utils'],
)

# Drizzle Studio — visual database browser
local_resource(
  'database-gui',
  serve_cmd='pnpm run db:studio',
  resource_deps=['postgres'],
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['dev-utils'],
  links=['http://localhost:5555'],
)

# ─── Tests ────────────────────────────────────────────────────────────────────

local_resource(
  'unit-tests',
  cmd='pnpm run test',
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['tests'],
)

local_resource(
  'e2e-gateway',
  cmd='pnpm run test:e2e:api',
  resource_deps=['api-gateway'],
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['tests'],
)

local_resource(
  'e2e-web-admin',
  cmd='pnpm run e2e:web-admin',
  resource_deps=['web'],
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['tests'],
)

local_resource(
  'e2e-web-institute',
  cmd='pnpm run e2e:web-institute',
  resource_deps=['web'],
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['tests'],
)

local_resource(
  'lint',
  cmd='pnpm run lint',
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['tests'],
)

# ─── NX ───────────────────────────────────────────────────────────────────────

local_resource(
  'typecheck',
  cmd='pnpm run typecheck',
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['nx'],
)

local_resource(
  'build-all',
  cmd='pnpm run build',
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['nx'],
)

local_resource(
  'nx-graph',
  serve_cmd='npx nx graph',
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['nx'],
  links=['http://localhost:4211'],
)

local_resource(
  'nx-reset',
  cmd='npx nx reset',
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['nx'],
)

# ─── Observability (manual) ──────────────────────────────────────────────────
# Start manually when debugging performance or tracing issues

dc_resource('prometheus', labels=['observability'], auto_init=False)
dc_resource('tempo', labels=['observability'], auto_init=False)
dc_resource('loki', labels=['observability'], auto_init=False)
dc_resource('otel-collector', labels=['observability'], resource_deps=['tempo', 'loki'],
            auto_init=False)
dc_resource('grafana', labels=['observability'], resource_deps=['prometheus', 'tempo', 'loki'],
            auto_init=False, links=['http://localhost:3001'])
