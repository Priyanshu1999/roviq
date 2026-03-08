# Roviq Development Environment
# Infra runs in Docker, apps run locally for fast iteration

# Infrastructure (Postgres, Redis, NATS, MinIO, Temporal)
docker_compose('./docker-compose.yml')

# Mark infra resources
dc_resource('postgres', labels=['infra'])
dc_resource('redis', labels=['infra'])
dc_resource('nats', labels=['infra'])
dc_resource('minio', labels=['infra'])
dc_resource('temporal', labels=['infra'], resource_deps=['postgres'])
dc_resource('temporal-ui', labels=['infra'])

# API Gateway (NestJS)
local_resource(
  'api-gateway',
  labels=['backend'],
  serve_cmd='pnpm run dev:gateway',
  serve_dir='.',
  deps=[],
  resource_deps=['postgres', 'redis', 'nats'],
  links=['http://localhost:3000/api/graphql'],
)

# Institute Service (NestJS microservice)
local_resource(
  'institute-service',
  labels=['backend'],
  serve_cmd='pnpm run dev:institute',
  serve_dir='.',
  deps=[],
  resource_deps=['postgres', 'redis', 'nats'],
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
