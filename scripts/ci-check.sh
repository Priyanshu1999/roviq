#!/usr/bin/env bash
# Unified CI gate. Local: nx affected against origin/main. CI=true: full suite.
#
# Bypass (local only):
#   SKIP_PREPUSH=1 git push   |   HUSKY=0 git push   |   git push --no-verify
#   NX_SKIP_NX_CACHE=1 git push  (forces re-execution of cached targets)
#
# Requires bash >= 4.3. Linux default; macOS users: `brew install bash`.

set -euo pipefail
set -m # job control: each child gets its own pgroup so we can kill it cleanly

log() { printf '[ci:check] %s\n' "$*"; }
warn() { printf '[ci:check] WARN: %s\n' "$*" >&2; }

if [[ -z "${BASH_VERSION:-}" ]] \
   || (( BASH_VERSINFO[0] < 4 )) \
   || (( BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] < 3 )); then
  log "ERROR: bash >= 4.3 required (got ${BASH_VERSION:-unknown})"
  exit 1
fi

IS_CI=0
[[ "${CI:-}" == "true" ]] && IS_CI=1

if (( ! IS_CI )); then
  if [[ "${SKIP_PREPUSH:-0}" == "1" || "${HUSKY:-}" == "0" ]]; then
    log "skipped via env var"; exit 0
  fi
fi

# ── Single-instance lock — concurrent runs share roviq_test DB and would race ─
LOCK_FD=200
LOCK_FILE=/tmp/roviq-ci-check.lock
exec {LOCK_FD}>"$LOCK_FILE" || { log "ERROR: cannot open $LOCK_FILE"; exit 1; }
if ! flock -n "$LOCK_FD"; then
  log "another ci:check is running (lock: $LOCK_FILE) — exiting"
  exit 1
fi

# ── Resolve base/head from pre-push stdin or origin/main ────────────────────
# Edge cases per githooks(5): new branch (rsha=zeros), deletion (lsha=zeros or
# lref=='(delete)'), force-push (rsha unreachable), multi-ref, empty stdin,
# detached HEAD.
base=""; head=""
if (( ! IS_CI )); then
  if [[ ! -t 0 ]]; then
    input=$(cat || true)
    if [[ -n "$input" ]]; then
      has_push=0
      while read -r lref lsha rref rsha _rest || [[ -n "${lref:-}" ]]; do
        [[ -z "${lref:-}" ]] && continue
        if [[ "$lref" == "(delete)" || "${lsha:-}" =~ ^0+$ ]]; then continue; fi
        has_push=1
        if [[ -n "${rsha:-}" && ! "$rsha" =~ ^0+$ ]] \
           && git cat-file -e "${rsha}^{commit}" 2>/dev/null; then
          base="$rsha"; break
        fi
      done <<< "$input"
      (( has_push == 0 )) && { log "only deletions in push; skipping"; exit 0; }
    fi
  fi
  if [[ -z "$base" ]]; then
    log "resolving base from origin/main"
    if ! git fetch --no-tags --quiet origin main 2>/dev/null; then
      warn "git fetch origin/main failed; affected set may be stale"
      base_age=$(git log -1 --format='%cr' origin/main 2>/dev/null || echo unknown)
      warn "local origin/main last updated: $base_age"
    fi
    base=$(git merge-base HEAD origin/main 2>/dev/null || git rev-parse HEAD)
  fi
  head=$(git rev-parse HEAD)
  log "mode=affected base=${base:0:10} head=${head:0:10}"
else
  log "mode=ci (full suite)"
fi

# ── tmpdir + signal-safe cleanup ────────────────────────────────────────────
tmpdir=$(mktemp -d -t roviq-ci-check.XXXXXX)
cleanup() {
  local rc=$?
  trap - INT TERM EXIT
  local pgs=()
  mapfile -t pgs < <(jobs -pr 2>/dev/null || true)
  if (( ${#pgs[@]} )); then
    # Negative pid = entire process group; covers granchildren (docker compose etc.)
    for pid in "${pgs[@]}"; do
      kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    done
    # Reap before deleting log files they may still be writing to.
    wait 2>/dev/null || true
  fi
  rm -rf "$tmpdir"
  exit "$rc"
}
trap cleanup INT TERM EXIT

# ── Affected list (local only) — drives lint/typecheck/unit decisions ───────
affected=""
if (( ! IS_CI )); then
  set +e
  affected=$(NX_BASE="$base" NX_HEAD="$head" \
    pnpm -s nx show projects --affected --base="$base" --head="$head" \
    2>"$tmpdir/affected.err")
  affected_rc=$?
  set -e
  if (( affected_rc != 0 )); then
    log "✗ nx show projects --affected failed (exit $affected_rc)"
    cat "$tmpdir/affected.err"
    exit 1
  fi
  if [[ -z "$affected" ]]; then
    log "no affected projects — skipping lint/typecheck/unit"
  fi
fi

run_lint=0; run_typecheck=0; run_unit=0
run_int=1; run_e2e=1
if (( IS_CI )) || [[ -n "$affected" ]]; then
  run_lint=1; run_typecheck=1; run_unit=1
fi

# ── Pre-warm: 4-way parallel infra/build, then sequential seed + app start ──
# Phase 1 (parallel): infra containers + backend image build + frontend build.
# Phase 2 (sequential): seed (needs postgres up AND migrate-and-seed image).
# Phase 3 (sequential): start app containers (need built images + seeded DB).
if (( run_e2e )); then
  COMPOSE=(docker compose -p roviq-e2e -f docker/compose.e2e.yaml)
  log "phase 1 (parallel): infra start + backend image build + web build"

  # Stream A: pull up infra services that don't depend on migrate-and-seed.
  # `--wait` blocks on healthy + completes one-shot novu-bootstrap.
  ( "${COMPOSE[@]}" up -d --wait \
        postgres redis nats temporal mongodb novu-api novu-worker novu-bootstrap \
      > "$tmpdir/infra.log" 2>&1 ) & infra_pid=$!

  # Stream B: build backend images (no runtime). COMPOSE_BAKE dedupes the
  # shared `dev` stage across api-gateway, migrate-and-seed, vitest-e2e,
  # rls-tests; notification-service builds its own production stage.
  ( COMPOSE_BAKE=true "${COMPOSE[@]}" build \
        api-gateway notification-service migrate-and-seed \
      > "$tmpdir/backend-build.log" 2>&1 ) & build_pid=$!

  # Stream C: frontend build on host. Independent of Docker.
  ( cd apps/web && \
      NEXT_PUBLIC_API_URL=http://localhost:3004 \
      NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER='' \
      pnpm exec next build > "$tmpdir/web-build.log" 2>&1 ) & web_pid=$!

  infra_rc=0; build_rc=0; web_rc=0
  wait "$infra_pid" || infra_rc=$?
  wait "$build_pid" || build_rc=$?
  wait "$web_pid"   || web_rc=$?

  if (( infra_rc != 0 || build_rc != 0 || web_rc != 0 )); then
    (( infra_rc != 0 )) && { log "✗ infra startup failed"; cat "$tmpdir/infra.log"; }
    (( build_rc != 0 )) && { log "✗ backend image build failed"; cat "$tmpdir/backend-build.log"; }
    (( web_rc   != 0 )) && { log "✗ next build failed"; cat "$tmpdir/web-build.log"; }
    exit 1
  fi

  # Phase 2: seed. --force-recreate ensures fresh seed even when the named
  # container completed in a prior run. --wait blocks until exit code is set.
  log "phase 2: migrate + seed e2e DB"
  if ! "${COMPOSE[@]}" up -d --wait --force-recreate migrate-and-seed > "$tmpdir/seed.log" 2>&1; then
    log "✗ seed failed"; cat "$tmpdir/seed.log"; exit 1
  fi

  # Phase 3: start app containers. Images built in phase 1 (no --build needed),
  # seed completed in phase 2 (depends_on satisfied).
  log "phase 3: start backend apps"
  if ! "${COMPOSE[@]}" up -d --wait \
       api-gateway notification-service novu-bridge-sync > "$tmpdir/apps.log" 2>&1; then
    log "✗ app startup failed"; cat "$tmpdir/apps.log"; exit 1
  fi

  # Phase 4: GraphQL warmup probe. The basic /api/health curl says healthy as
  # soon as the HTTP server binds, but `nx serve` lazy-compiles libraries on
  # first use — early test queries hit UND_ERR_SOCKET while compilation
  # finishes. Hit a real GraphQL query and wait for a stable response before
  # declaring the api-gateway ready for tests.
  log "phase 4: api-gateway GraphQL warmup probe"
  warmup_start=$SECONDS
  warmup_ok=0
  while (( SECONDS - warmup_start < 90 )); do
    if response=$(curl -sf -X POST http://localhost:3004/api/graphql \
         -H 'Content-Type: application/json' \
         -d '{"query":"{ __typename }"}' \
         --max-time 5 2>/dev/null) \
       && [[ "$response" == *'"Query"'* ]]; then
      warmup_ok=1
      break
    fi
    sleep 1
  done
  if (( ! warmup_ok )); then
    log "✗ api-gateway warmup probe timed out after 90s"
    docker logs roviq-e2e-api-gateway-1 --tail 40 2>&1 | sed 's/^/  /'
    exit 1
  fi
  log "✓ api-gateway ready ($((SECONDS - warmup_start))s warmup)"
fi

# ── Build Nx invocation prefix for affected/full-suite split ────────────────
if (( IS_CI )); then
  nx_prefix=(pnpm -s nx run-many)
else
  nx_prefix=(pnpm -s nx affected --base="$base" --head="$head")
fi

# ── Launch suites in parallel (per-suite log isolation; pid array tracks order) ─
declare -a names pids
launch() {
  local name=$1; shift
  (
    if (( ! IS_CI )); then
      export NX_BASE="$base" NX_HEAD="$head"
    fi
    start=$(date +%s)
    if "$@" > "$tmpdir/$name.log" 2>&1; then rc=0; else rc=$?; fi
    end=$(date +%s)
    printf '%s\n' "$((end - start))" > "$tmpdir/$name.dur"
    exit "$rc"
  ) &
  pids+=("$!"); names+=("$name")
}

(( run_lint ))      && launch lint      "${nx_prefix[@]}" -t lint --parallel=3
(( run_typecheck )) && launch typecheck "${nx_prefix[@]}" -t typecheck --parallel=3
(( run_unit ))      && launch unit      "${nx_prefix[@]}" -t test \
                              --exclude='integration-tests,*-e2e,web-e2e-suite' --parallel=3
(( run_int ))       && launch int       pnpm -s nx run integration-tests:test:int

# e2e-api → e2e-ui run sequentially: they share roviq_test on port 5435.
# Wrapped in one launched job so the whole e2e suite executes alongside the
# other parallel jobs without racing them on the DB.
# JetStream drift gate runs first — needs the e2e NATS up but no DB seed,
# fails fast so a stream-config PR doesn't waste a full e2e run before the
# drift becomes the obvious fix.
(( run_e2e )) && launch e2e bash -c 'set -e
  pnpm -s check:jetstream-drift
  pnpm -s nx run api-gateway-e2e:test-e2e
  pnpm -s nx run web-e2e-suite:e2e'

# Schema-coverage gates — fast (<1s total), always run regardless of affected
# set since they catch global drift (live views / RLS / testid registry /
# drizzle migration↔snapshot consistency).
launch gates bash -c 'set -e
  pnpm -s check:live-views
  pnpm -s check:live-views-coverage
  pnpm -s check:rls-coverage
  pnpm -s check:testids
  pnpm -s check:no-double-cast
  pnpm -s check:db-drift'

# ── Collect results ────────────────────────────────────────────────────────
overall=0
for i in "${!pids[@]}"; do
  if wait "${pids[$i]}"; then rc=0; else rc=$?; fi
  name=${names[$i]}
  dur=$(cat "$tmpdir/$name.dur" 2>/dev/null || echo "?")
  if (( rc == 0 )); then
    log "✓ $name (${dur}s)"
  else
    log "✗ $name (${dur}s, exit=$rc)"
    echo "─── $name output ───"
    cat "$tmpdir/$name.log"
    echo "─── end $name ───"
    overall=1
  fi
done

if (( overall != 0 )); then
  log "FAILED — review output above"
  log "emergency bypass (review before pushing): SKIP_PREPUSH=1 git push"
fi

# Remove EXIT trap so cleanup() doesn't run twice with the wrong rc.
trap - INT TERM EXIT
rm -rf "$tmpdir"
exit "$overall"
