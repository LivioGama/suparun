#!/usr/bin/env bash
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

pass() { echo -e "${GREEN}[PASS]${RESET} $*"; }
fail() { echo -e "${RED}[FAIL]${RESET} $*"; OVERALL_PASS=false; }
step() { echo -e "\n${CYAN}${BOLD}── $* ──${RESET}"; }
info() { echo -e "${YELLOW}[INFO]${RESET} $*"; }

# ── Config ───────────────────────────────────────────────────────────────────
PORT=3003
APP_DIR="${SUPARUN_TEST_APP_DIR:-/Users/livio/Documents/anbiti-apps/apps/reflecta}"
SUPARUN_LOG="/tmp/suparun-test-$$.log"
SUPARUN_PID=""
OVERALL_PASS=true
TESTS_RUN=0
TESTS_PASSED=0

# ── Cleanup trap ────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  step "Cleanup"
  if [[ -n "$SUPARUN_PID" ]] && kill -0 "$SUPARUN_PID" 2>/dev/null; then
    info "Killing suparun (PID $SUPARUN_PID)..."
    kill "$SUPARUN_PID" 2>/dev/null || true
    sleep 1
    kill -9 "$SUPARUN_PID" 2>/dev/null || true
  fi
  # Kill anything left on the port
  local pids
  pids=$(lsof -ti "tcp:$PORT" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
  rm -f "$SUPARUN_LOG"
  info "Cleanup done."

  echo ""
  echo -e "${BOLD}Results: ${TESTS_PASSED}/${TESTS_RUN} tests passed${RESET}"
  if [[ "$OVERALL_PASS" == "true" ]]; then
    echo -e "${GREEN}${BOLD}══════════════════════════════════════════${RESET}"
    echo -e "${GREEN}${BOLD}  ALL TESTS PASSED                        ${RESET}"
    echo -e "${GREEN}${BOLD}══════════════════════════════════════════${RESET}"
  else
    echo -e "${RED}${BOLD}══════════════════════════════════════════${RESET}"
    echo -e "${RED}${BOLD}  SOME TESTS FAILED                       ${RESET}"
    echo -e "${RED}${BOLD}══════════════════════════════════════════${RESET}"
  fi
}
trap cleanup EXIT

# ── Helpers ─────────────────────────────────────────────────────────────────
pid_on_port() {
  lsof -ti "tcp:$PORT" 2>/dev/null | head -n 1 || echo ""
}

http_code() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://localhost:${PORT}" 2>/dev/null || echo "000"
}

wait_for_healthy() {
  local timeout="$1" elapsed=0
  while (( elapsed < timeout )); do
    local code
    code=$(http_code)
    if [[ "$code" == "200" ]]; then return 0; fi
    info "  HTTP $code — waiting... (${elapsed}s / ${timeout}s)"
    sleep 2
    (( elapsed += 2 ))
  done
  return 1
}

wait_for_port_down() {
  local timeout="$1" elapsed=0
  while (( elapsed < timeout )); do
    if ! lsof -ti "tcp:$PORT" &>/dev/null; then return 0; fi
    sleep 1
    (( elapsed += 1 ))
  done
  return 1
}

start_suparun() {
  # Kill anything on the port first
  local pids
  pids=$(lsof -ti "tcp:$PORT" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
  cd "$APP_DIR"
  rm -rf .next
  suparun dev --port "$PORT" > "$SUPARUN_LOG" 2>&1 &
  SUPARUN_PID=$!
  info "suparun started (PID $SUPARUN_PID)"
}

stop_suparun() {
  if [[ -n "$SUPARUN_PID" ]] && kill -0 "$SUPARUN_PID" 2>/dev/null; then
    kill "$SUPARUN_PID" 2>/dev/null || true
    sleep 1
    kill -9 "$SUPARUN_PID" 2>/dev/null || true
  fi
  SUPARUN_PID=""
  local pids
  pids=$(lsof -ti "tcp:$PORT" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

assert_pass() {
  ((TESTS_RUN++))
  ((TESTS_PASSED++))
  pass "$@"
}

assert_fail() {
  ((TESTS_RUN++))
  fail "$@"
}

# ════════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}suparun Revival Integration Tests${RESET}"
echo -e "${DIM}Port: $PORT | App: $APP_DIR${RESET}"

# ════════════════════════════════════════════════════════════════════════════
# TEST 1: Process crash recovery (kill -9 dev process)
#   Suparun should detect the port went down and restart the dev server.
# ════════════════════════════════════════════════════════════════════════════
step "TEST 1: Process crash recovery (kill -9)"

start_suparun
if wait_for_healthy 30; then
  INITIAL_PID=$(pid_on_port)
  info "Dev server healthy on :$PORT (PID $INITIAL_PID)"

  # Kill the dev process directly (simulates a crash)
  info "Killing dev process (PID $INITIAL_PID) with SIGKILL..."
  kill -9 "$INITIAL_PID" 2>/dev/null || true

  # Wait for suparun to detect + revive (port goes down → restart)
  info "Waiting for suparun to revive..."
  if wait_for_healthy 30; then
    NEW_PID=$(pid_on_port)
    if [[ "$NEW_PID" != "$INITIAL_PID" && -n "$NEW_PID" ]]; then
      assert_pass "Process revived: PID $INITIAL_PID → $NEW_PID"
    else
      assert_fail "PID did not change after crash (still $INITIAL_PID)"
    fi
  else
    assert_fail "Dev server did not come back after crash (timeout 30s)"
    tail -15 "$SUPARUN_LOG" 2>/dev/null || true
  fi
else
  assert_fail "Dev server never became healthy initially"
  tail -15 "$SUPARUN_LOG" 2>/dev/null || true
fi

stop_suparun

# ════════════════════════════════════════════════════════════════════════════
# TEST 2: Multiple rapid crashes — suparun should keep reviving
# ════════════════════════════════════════════════════════════════════════════
step "TEST 2: Multiple rapid crashes (3x kill)"

start_suparun
if wait_for_healthy 30; then
  CRASH_SUCCESS=true
  for i in 1 2 3; do
    DEV_PID=$(pid_on_port)
    info "Crash #$i — killing PID $DEV_PID..."
    kill -9 "$DEV_PID" 2>/dev/null || true
    if wait_for_healthy 30; then
      NEW_PID=$(pid_on_port)
      info "  Revived: PID $DEV_PID → $NEW_PID"
    else
      CRASH_SUCCESS=false
      assert_fail "Failed to revive after crash #$i"
      break
    fi
  done
  if [[ "$CRASH_SUCCESS" == "true" ]]; then
    assert_pass "Survived 3 consecutive crashes"
  fi
else
  assert_fail "Dev server never became healthy initially"
fi

stop_suparun

# ════════════════════════════════════════════════════════════════════════════
# TEST 3: Graceful stop (SIGTERM) — suparun should detect and revive
# ════════════════════════════════════════════════════════════════════════════
step "TEST 3: Graceful stop (SIGTERM to dev process)"

start_suparun
if wait_for_healthy 30; then
  INITIAL_PID=$(pid_on_port)
  info "Dev server healthy (PID $INITIAL_PID)"

  # Send SIGTERM (graceful shutdown) to the dev process
  info "Sending SIGTERM to PID $INITIAL_PID..."
  kill -TERM "$INITIAL_PID" 2>/dev/null || true

  if wait_for_healthy 30; then
    NEW_PID=$(pid_on_port)
    if [[ "$NEW_PID" != "$INITIAL_PID" && -n "$NEW_PID" ]]; then
      assert_pass "Revived after SIGTERM: PID $INITIAL_PID → $NEW_PID"
    else
      assert_fail "PID did not change after SIGTERM"
    fi
  else
    assert_fail "Dev server did not come back after SIGTERM (timeout 30s)"
  fi
else
  assert_fail "Dev server never became healthy initially"
fi

stop_suparun

# ════════════════════════════════════════════════════════════════════════════
# TEST 4: Port detection — suparun correctly detects PORT=3003
# ════════════════════════════════════════════════════════════════════════════
step "TEST 4: Port detection (PORT=3003 in script)"

start_suparun
sleep 3
# Check suparun log for "guarding port 3003"
if grep -q "guarding port $PORT" "$SUPARUN_LOG" 2>/dev/null; then
  assert_pass "suparun detected PORT=$PORT from script"
else
  assert_fail "suparun did not detect PORT=$PORT — check detect_port"
  tail -10 "$SUPARUN_LOG" 2>/dev/null || true
fi

if wait_for_healthy 30; then
  # Verify actual listening port
  ACTUAL_PID=$(pid_on_port)
  if [[ -n "$ACTUAL_PID" ]]; then
    assert_pass "Dev server listening on :$PORT (PID $ACTUAL_PID)"
  else
    assert_fail "Nothing listening on :$PORT"
  fi
else
  assert_fail "Dev server never started on :$PORT"
fi

stop_suparun

# ════════════════════════════════════════════════════════════════════════════
# TEST 5: Suparun survives when its child is replaced by an external process
#   Start suparun, kill the dev process, manually start another process on
#   the same port, verify suparun adopts it.
# ════════════════════════════════════════════════════════════════════════════
step "TEST 5: External process adoption"

start_suparun
if wait_for_healthy 30; then
  INITIAL_PID=$(pid_on_port)
  info "Dev server healthy (PID $INITIAL_PID)"

  # Kill the child
  kill -9 "$INITIAL_PID" 2>/dev/null || true
  sleep 1

  # Start a fake server on the port before suparun can revive
  # (python http.server as a quick fake)
  python3 -m http.server "$PORT" &>/dev/null &
  FAKE_PID=$!
  sleep 2

  # Suparun should detect the external process and adopt it
  if grep -q "External process detected on port $PORT" "$SUPARUN_LOG" 2>/dev/null; then
    assert_pass "suparun adopted external process on :$PORT"
  else
    # Give it more time
    sleep 5
    if grep -q "External process detected on port $PORT" "$SUPARUN_LOG" 2>/dev/null; then
      assert_pass "suparun adopted external process on :$PORT"
    else
      assert_fail "suparun did not detect external process"
    fi
  fi

  kill -9 "$FAKE_PID" 2>/dev/null || true
else
  assert_fail "Dev server never became healthy initially"
fi

stop_suparun
