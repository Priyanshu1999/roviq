# Agent Workflow

## Runtime Verification

Compilation passing does NOT mean it works. After any change to:
- NX project.json, tsconfig, path aliases, module resolution, or imports
- Docker compose, infra configs, or environment variables
- New library scaffolding or cross-project wiring

**You MUST run the actual app** (`nx run api-gateway:serve:development` or equivalent) and verify it starts without runtime errors. Fix iteratively until the app runs clean — do not wait for the user to tell you.

## Post-Implementation (do proactively)

- **RLS audit**: When changing models, verify and report RLS status for every affected table
- **New tests**: Proactively write tests for new code paths, report coverage gaps
- **Documentation**: Update docs in the same batch as the implementation
