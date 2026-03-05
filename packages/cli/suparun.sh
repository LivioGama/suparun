#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════
# suparun — Watchdog daemon for JS/TS scripts
#
# Modes:
#   suparun dev          → Ensure <pm> run dev is ALWAYS alive on its port
#   suparun build        → Run <pm> run build, retry on failure
#   suparun <anything>   → Run <pm> run <anything> with resilience
#
# Auto-detects package manager (bun/npm/yarn/pnpm) via lock files.
#
# What makes this different:
#   - Watchdog: polls the port, not just the PID
#   - If ANOTHER process started dev and it dies, suparun revives it
#   - If something steals the port, suparun kills it and reclaims
#   - Survives IDE restarts, terminal crashes, build tools killing node
# ═══════════════════════════════════════════════════════════════════

readonly VERSION="0.0.0"
readonly MAX_RAPID_CRASHES=50
readonly INITIAL_BACKOFF=1
readonly MAX_BACKOFF=10
readonly CRASH_WINDOW=5
readonly HEALTH_POLL_INTERVAL=2  # seconds between port health checks
readonly HEALTH_FAIL_THRESHOLD=3  # consecutive HTTP failures before declaring dead

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

# State
CHILD_PID=""
SHUTTING_DOWN=false
PORT=""
PM=""

# Vhost state
VHOST_ENABLED=true
VHOST_NAME=""
VHOST_DIR="$HOME/.config/suparun"
VHOST_FILE="$VHOST_DIR/vhosts.json"
VHOST_LOCK="$VHOST_DIR/.lock"
PROXY_PORT=2999
PROXY_PID_FILE="$VHOST_DIR/proxy.pid"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Package manager detection ───────────────────────────────────

detect_pm() {
  local dir
  dir="$(pwd)"
  while true; do
    if [[ -f "$dir/bun.lock" || -f "$dir/bun.lockb" ]]; then
      echo "bun"; return
    elif [[ -f "$dir/yarn.lock" ]]; then
      echo "yarn"; return
    elif [[ -f "$dir/pnpm-lock.yaml" ]]; then
      echo "pnpm"; return
    elif [[ -f "$dir/package-lock.json" ]]; then
      echo "npm"; return
    fi
    local parent
    parent="$(dirname "$dir")"
    [[ "$parent" == "$dir" ]] && break
    dir="$parent"
  done
  echo "npm"
}

# ─── Helpers ──────────────────────────────────────────────────────

readonly PLATFORM="$(uname)"

sed_inplace() {
  if [[ "$PLATFORM" == "Darwin" ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

log()   { echo -e "${CYAN}[suparun]${NC} $*"; }
ok()    { echo -e "${GREEN}[suparun]${NC} $*"; }
warn()  { echo -e "${YELLOW}[suparun]${NC} $*"; }
err()   { echo -e "${RED}[suparun]${NC} $*" >&2; }
dim()   { echo -e "${DIM}[suparun]${NC} ${DIM}$*${NC}"; }

usage() {
  echo -e "${BOLD}suparun${NC} v${VERSION} — Watchdog daemon for JS/TS scripts"
  echo ""
  echo -e "  ${CYAN}Usage:${NC}  suparun <script> [args...]"
  echo ""
  echo -e "  Auto-detects package manager (bun/npm/yarn/pnpm) via lock files."
  echo ""
  echo -e "  ${CYAN}Examples:${NC}"
  echo "    suparun dev            # watches port, auto-revives"
  echo "    suparun build          # retries on failure"
  echo "    suparun start          # watches port, auto-revives"
  echo "    suparun dev --turbopack"
  echo ""
  echo -e "  ${CYAN}Commands:${NC}"
  echo "    init          Install the --hard flag into your shell"
  echo "    uninstall     Remove the --hard flag from your shell"
  echo "    hosts sync    Show /etc/hosts entries for Safari support"
  echo ""
  echo -e "  ${CYAN}Options:${NC}"
  echo "    --port <n>    Override port detection"
  echo "    --no-restart  Don't auto-restart on crash"
  echo "    --no-vhost    Disable vhost reverse proxy"
  echo "    --help        Show this help"
  exit 0
}

# ─── Shell integration (suparun init) ─────────────────────────────

__suparun_shell_hooks() {
  cat <<'HOOK'
# suparun: "<pm> run <script> --hard" activates watchdog mode
__suparun_hard() {
  local args=("${@}")
  local has_hard=false
  local filtered=()
  for arg in "${args[@]}"; do
    if [[ "$arg" == "--hard" ]]; then has_hard=true
    else filtered+=("$arg"); fi
  done
  if [[ "$has_hard" == true ]]; then
    command suparun "${filtered[@]}"
    return $?
  fi
  return 1
}
bun()  { if [[ "$1" =~ ^(run|r)$ ]]; then __suparun_hard "${@:2}" && return; fi; command bun "$@"; }
npm()  { if [[ "$1" == "run" ]]; then __suparun_hard "${@:2}" && return; fi; command npm "$@"; }
yarn() { if [[ "$1" == "run" ]]; then __suparun_hard "${@:2}" && return; fi; command yarn "$@"; }
pnpm() { if [[ "$1" == "run" ]]; then __suparun_hard "${@:2}" && return; fi; command pnpm "$@"; }
HOOK
}

install_shell_hook() {
  local shell_rc=""
  case "${SHELL:-/bin/bash}" in
    */zsh)  shell_rc="$HOME/.zshrc" ;;
    */bash) shell_rc="$HOME/.bashrc" ;;
    *)      shell_rc="$HOME/.profile" ;;
  esac

  if [[ -f "$shell_rc" ]] && grep -q 'suparun.*--hard' "$shell_rc" 2>/dev/null; then
    ok "Shell hook already installed in $shell_rc"
    dim "Restart your shell or run: source $shell_rc"
    return 0
  fi

  {
    echo ""
    __suparun_shell_hooks
  } >> "$shell_rc"

  ok "Installed --hard flag into $shell_rc"
  log "Now you can use: ${BOLD}<bun|npm|yarn|pnpm> run dev --hard${NC}"
  dim "Restart your shell or run: source $shell_rc"
}

uninstall_shell_hook() {
  local shell_rc=""
  case "${SHELL:-/bin/bash}" in
    */zsh)  shell_rc="$HOME/.zshrc" ;;
    */bash) shell_rc="$HOME/.bashrc" ;;
    *)      shell_rc="$HOME/.profile" ;;
  esac

  if [[ ! -f "$shell_rc" ]]; then
    err "Shell config not found: $shell_rc"
    return 1
  fi

  if ! grep -q '# suparun:' "$shell_rc" 2>/dev/null; then
    ok "No suparun hooks found in $shell_rc"
    return 0
  fi

  # Remove all blocks between "# suparun:" markers and the closing "}"
  sed_inplace '/^# suparun:/,/^}$/d' "$shell_rc"
  # Remove the __suparun_hard helper if present
  sed_inplace '/^__suparun_hard()/,/^}$/d' "$shell_rc"
  # Clean up any trailing blank lines left over
  sed_inplace -e :a -e '/^\n*$/{$d;N;ba;}' "$shell_rc"

  ok "Removed suparun hooks from $shell_rc"
  dim "Restart your shell or run: source $shell_rc"
}

# ─── Vhost functions ─────────────────────────────────────────────

generate_vhost_name() {
  local name=""

  # 1. From package.json "name" field
  if [[ -f "package.json" ]]; then
    name=$(grep -m1 '"name"' package.json 2>/dev/null | sed 's/.*"name"[[:space:]]*:[[:space:]]*"//;s/".*//' || echo "")
    # Strip @scope/ prefix
    name="${name#@*/}"
  fi

  # 2. Fallback to directory basename
  if [[ -z "$name" ]]; then
    name="$(basename "$(pwd)")"
  fi

  # 3. Sanitize: lowercase, replace non-alnum with -, collapse, trim
  name=$(echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g; s/--*/-/g; s/^-//; s/-$//')

  echo "$name"
}

_vhost_lock() {
  local attempts=0
  while ! mkdir "$VHOST_LOCK" 2>/dev/null; do
    ((attempts++))
    if [[ $attempts -ge 50 ]]; then
      # Stale lock — force remove
      rm -rf "$VHOST_LOCK"
      mkdir "$VHOST_LOCK" 2>/dev/null || true
      break
    fi
    sleep 0.1
  done
}

_vhost_unlock() {
  rmdir "$VHOST_LOCK" 2>/dev/null || true
}

vhost_register() {
  local name="$1"
  local port="$2"
  local pid="$$"

  mkdir -p "$VHOST_DIR"
  _vhost_lock

  # Read existing, or start fresh
  local json="{}"
  if [[ -f "$VHOST_FILE" ]]; then
    json=$(cat "$VHOST_FILE")
  fi

  # Collision check: if name taken by a live PID, append suffix
  local final_name="$name"
  local suffix=2
  while true; do
    local existing_pid=""
    if [[ "$json" != "{}" ]]; then
      existing_pid=$(echo "$json" | bun -e "
        const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));
        const e = d['$final_name'];
        console.log(e ? e.pid : '');
      " 2>/dev/null || echo "")
    fi

    if [[ -z "$existing_pid" ]]; then
      break
    fi

    # Check if that PID is still alive
    if kill -0 "$existing_pid" 2>/dev/null; then
      final_name="${name}-${suffix}"
      ((suffix++))
    else
      break  # Dead PID, we can reuse
    fi
  done

  # Write entry
  local cwd
  cwd="$(pwd)"

  # Ensure file exists before bun reads it
  if [[ ! -f "$VHOST_FILE" ]]; then
    echo '{}' > "$VHOST_FILE"
  fi

  bun -e "
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync('$VHOST_FILE','utf-8').trim() || '{}');
    d['$final_name'] = { port: $port, pid: $pid, cwd: '$cwd' };
    fs.writeFileSync('$VHOST_FILE', JSON.stringify(d, null, 2));
  " 2>/dev/null

  _vhost_unlock
  VHOST_NAME="$final_name"
}

vhost_deregister() {
  local name="$1"
  [[ -z "$name" ]] && return 0

  _vhost_lock

  if [[ -f "$VHOST_FILE" ]]; then
    local remaining
    remaining=$(bun -e "
      const fs = require('fs');
      const d = JSON.parse(fs.readFileSync('$VHOST_FILE','utf-8').trim() || '{}');
      delete d['$name'];
      fs.writeFileSync('$VHOST_FILE', JSON.stringify(d, null, 2));
      console.log(Object.keys(d).length);
    " 2>/dev/null || echo "0")

    _vhost_unlock
    echo "$remaining"
    return
  fi

  _vhost_unlock
  echo "0"
}

ensure_proxy_running() {
  # Check if proxy is already alive
  if [[ -f "$PROXY_PID_FILE" ]]; then
    local proxy_pid
    proxy_pid=$(cat "$PROXY_PID_FILE" 2>/dev/null || echo "")
    if [[ -n "$proxy_pid" ]] && kill -0 "$proxy_pid" 2>/dev/null; then
      return 0  # Already running
    fi
  fi

  # Start proxy
  local proxy_script="$SCRIPT_DIR/vhost-proxy.ts"
  if [[ ! -f "$proxy_script" ]]; then
    warn "vhost-proxy.ts not found at $proxy_script — skipping vhost"
    VHOST_ENABLED=false
    return 1
  fi

  bun "$proxy_script" &>/dev/null &
  disown
  # Give it a moment to write PID file
  sleep 0.3
  dim "vhost proxy started on port $PROXY_PORT"
}

maybe_stop_proxy() {
  local remaining="$1"
  if [[ "$remaining" == "0" ]] && [[ -f "$PROXY_PID_FILE" ]]; then
    local proxy_pid
    proxy_pid=$(cat "$PROXY_PID_FILE" 2>/dev/null || echo "")
    if [[ -n "$proxy_pid" ]] && kill -0 "$proxy_pid" 2>/dev/null; then
      kill "$proxy_pid" 2>/dev/null || true
      dim "vhost proxy stopped"
    fi
  fi
}

# ─── Port detection ───────────────────────────────────────────────

detect_port() {
  local port=""

  # 1. Extract --port or -p from package.json script definition
  if [[ -f "package.json" ]]; then
    local script_cmd
    script_cmd=$(grep -o "\"$SCRIPT\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" package.json 2>/dev/null | head -1 | sed 's/.*:[[:space:]]*"//;s/"$//' || echo "")

    if [[ "$script_cmd" =~ --port[[:space:]]+([0-9]+) ]]; then
      port="${BASH_REMATCH[1]}"
    elif [[ "$script_cmd" =~ -p[[:space:]]+([0-9]+) ]]; then
      port="${BASH_REMATCH[1]}"
    elif [[ "$script_cmd" =~ PORT=([0-9]+) ]]; then
      port="${BASH_REMATCH[1]}"
    fi
  fi

  # 2. Check PORT env var
  if [[ -z "$port" && -n "${PORT:-}" ]]; then
    port="$PORT"
  fi

  # 3. Check .env files
  if [[ -z "$port" ]]; then
    for envfile in .env.local .env.development .env; do
      if [[ -f "$envfile" ]]; then
        local env_port
        env_port=$(grep -E '^PORT=' "$envfile" 2>/dev/null | head -1 | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
        if [[ -n "$env_port" ]]; then
          port="$env_port"
          break
        fi
      fi
    done
  fi

  # 4. Framework defaults
  if [[ -z "$port" ]]; then
    if [[ -f "vite.config.ts" || -f "vite.config.js" ]]; then
      port=5173
    elif [[ -f "next.config.ts" || -f "next.config.mjs" || -f "next.config.js" ]]; then
      port=3000
    elif [[ -f "astro.config.mjs" || -f "astro.config.ts" ]]; then
      port=4321
    elif [[ -f "remix.config.js" || -f "remix.config.ts" ]]; then
      port=3000
    else
      port=3000
    fi
  fi

  echo "$port"
}

# ─── Port & process utilities ─────────────────────────────────────

port_is_alive() {
  # Returns 0 if something is listening on the port
  lsof -ti :"$1" &>/dev/null
}

port_is_healthy() {
  curl -sf -o /dev/null --max-time 3 "http://localhost:$1/" 2>/dev/null
}

port_pids() {
  lsof -ti :"$1" 2>/dev/null || true
}

pid_is_alive() {
  kill -0 "$1" 2>/dev/null
}

kill_tree() {
  local pid="$1"
  local signal="${2:-TERM}"
  local children
  children=$(pgrep -P "$pid" 2>/dev/null || true)
  for child in $children; do
    kill_tree "$child" "$signal"
  done
  kill -"$signal" "$pid" 2>/dev/null || true
}

kill_port() {
  local port="$1"
  local pids
  pids=$(port_pids "$port")

  if [[ -z "$pids" ]]; then
    return 0
  fi

  warn "Killing processes on port $port: $(echo "$pids" | tr '\n' ' ')"

  # SIGTERM each process tree
  for pid in $pids; do
    kill_tree "$pid" TERM
  done

  # Wait up to 3s
  local waited=0
  while [[ $waited -lt 30 ]]; do
    if ! port_is_alive "$port"; then
      ok "Port $port freed"
      return 0
    fi
    sleep 0.1
    ((waited++))
  done

  # Force kill
  pids=$(port_pids "$port")
  if [[ -n "$pids" ]]; then
    warn "Force-killing on port $port"
    for pid in $pids; do
      kill_tree "$pid" 9
    done
    sleep 0.5
  fi

  if ! port_is_alive "$port"; then
    ok "Port $port freed (force)"
    return 0
  fi

  err "Cannot free port $port"
  return 1
}

# ─── Cleanup ──────────────────────────────────────────────────────

cleanup() {
  SHUTTING_DOWN=true

  # Deregister vhost
  if [[ "$VHOST_ENABLED" == true ]] && [[ -n "$VHOST_NAME" ]]; then
    local remaining
    remaining=$(vhost_deregister "$VHOST_NAME")
    maybe_stop_proxy "$remaining"
  fi

  # Kill our own child if we spawned one
  if [[ -n "$CHILD_PID" ]] && pid_is_alive "$CHILD_PID"; then
    dim "Shutting down (PID $CHILD_PID)..."
    kill_tree "$CHILD_PID" TERM

    local waited=0
    while pid_is_alive "$CHILD_PID" && [[ $waited -lt 30 ]]; do
      sleep 0.1
      ((waited++))
    done

    if pid_is_alive "$CHILD_PID"; then
      kill_tree "$CHILD_PID" 9
    fi
  fi

  # Clean up the port too (catches orphaned grandchildren)
  if [[ -n "$PORT" ]]; then
    local stragglers
    stragglers=$(port_pids "$PORT")
    if [[ -n "$stragglers" ]]; then
      dim "Cleaning up stragglers on port $PORT..."
      for s in $stragglers; do
        kill -9 "$s" 2>/dev/null || true
      done
    fi
  fi

  ok "Stopped."
  exit 0
}

trap cleanup SIGINT SIGTERM SIGHUP

# ─── Script classification ────────────────────────────────────────

is_server_script() {
  case "$1" in
    dev|start|serve|preview) return 0 ;;
    *) return 1 ;;
  esac
}

is_build_script() {
  case "$1" in
    build|generate|export) return 0 ;;
    *) return 1 ;;
  esac
}

# ─── Run: one-shot (build etc.) ───────────────────────────────────

run_oneshot() {
  local retries=0
  local max=3
  local exit_code=0

  while [[ $retries -lt $max ]]; do
    if [[ $retries -gt 0 ]]; then
      log "Running ${BOLD}$PM run $SCRIPT ${EXTRA_ARGS[*]+"${EXTRA_ARGS[*]}"}${NC} (attempt $((retries + 1))/$max)"
    else
      log "Running ${BOLD}$PM run $SCRIPT ${EXTRA_ARGS[*]+"${EXTRA_ARGS[*]}"}${NC}"
    fi

    set +e
    $PM run "$SCRIPT" ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
    exit_code=$?
    set -e

    if [[ $exit_code -eq 0 ]]; then
      ok "Done."
      return 0
    fi

    ((retries++))
    if [[ $retries -lt $max ]]; then
      warn "Exit code $exit_code — retrying in 2s..."
      sleep 2
    fi
  done

  err "Failed after $max attempts (exit code $exit_code)"
  return 1
}

# ─── CORE: Watchdog server loop ───────────────────────────────────
#
# This is the heart of suparun. It works in two alternating phases:
#
# Phase A — WATCH: Something is already on the port (we started it
#   or an external process did). Poll the port. The moment nothing
#   is listening, fall through to Phase B.
#
# Phase B — REVIVE: Port is dead. Kill any zombies, start bun,
#   wait for it to bind, then loop back to Phase A.
#
# This means suparun doesn't care WHO started the server.
# IDE, another terminal, a build tool — doesn't matter.
# If the port goes down, suparun brings it back.
# ───────────────────────────────────────────────────────────────────

run_watchdog() {
  local port="$1"
  local rapid_crashes=0
  local backoff=$INITIAL_BACKOFF

  while [[ "$SHUTTING_DOWN" == false ]]; do

    # ── Phase A: Is something already alive on the port? ──────────
    if port_is_alive "$port"; then
      local existing_pids
      existing_pids=$(port_pids "$port")

      # Check if it's our child or an external process
      if [[ -n "$CHILD_PID" ]] && echo "$existing_pids" | grep -q "^${CHILD_PID}$"; then
        dim "Our process (PID $CHILD_PID) is running on port $port"
      else
        ok "External process detected on port $port (PIDs: $(echo "$existing_pids" | tr '\n' ' '))"
        ok "Watching it — will revive if it dies"
        CHILD_PID=""  # not ours, don't try to `wait` on it
      fi

      # Poll until the port goes down or becomes unresponsive
      local health_failures=0
      while port_is_alive "$port" && [[ "$SHUTTING_DOWN" == false ]]; do
        sleep "$HEALTH_POLL_INTERVAL"
        if ! port_is_healthy "$port"; then
          ((health_failures++))
          if [[ $health_failures -ge $HEALTH_FAIL_THRESHOLD ]]; then
            warn "Port $port is listening but not responding — killing stale process"
            kill_port "$port"
            break
          fi
        else
          health_failures=0
        fi
      done

      if [[ "$SHUTTING_DOWN" == true ]]; then
        return 0
      fi

      warn "Port $port went down — entering revive phase"
    fi

    # ── Phase B: Port is dead — revive ────────────────────────────

    # Respect crash limits
    if [[ $rapid_crashes -ge $MAX_RAPID_CRASHES ]]; then
      err "Giving up after $MAX_RAPID_CRASHES rapid crashes"
      return 1
    fi

    # Clean up any zombie processes on the port
    kill_port "$port" 2>/dev/null || true

    if [[ $rapid_crashes -eq 0 ]]; then
      log "Starting ${BOLD}$PM run $SCRIPT ${EXTRA_ARGS[*]+"${EXTRA_ARGS[*]}"}${NC} on port $port"
    else
      warn "Reviving (attempt $((rapid_crashes + 1))/$MAX_RAPID_CRASHES, backoff ${backoff}s)..."
      sleep "$backoff"
    fi

    local start_time
    start_time=$(date +%s)

    # Launch process
    set +e
    $PM run "$SCRIPT" ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"} &
    CHILD_PID=$!
    set -e

    # Wait for the process to either:
    #   a) bind to the port (success → go to Phase A)
    #   b) exit (failure → stay in Phase B)
    local boot_waited=0
    local boot_timeout=60  # max seconds to wait for port to come up

    while [[ $boot_waited -lt $boot_timeout ]] && pid_is_alive "$CHILD_PID" && [[ "$SHUTTING_DOWN" == false ]]; do
      if port_is_alive "$port"; then
        ok "Up on port $port (PID $CHILD_PID)"
        rapid_crashes=0
        backoff=$INITIAL_BACKOFF
        break  # → back to Phase A (the outer while loop)
      fi
      sleep 0.5
      ((boot_waited++))
    done

    if [[ "$SHUTTING_DOWN" == true ]]; then
      return 0
    fi

    # If port is alive now, go back to Phase A
    if port_is_alive "$port"; then
      continue
    fi

    # Port never came up — process died or timed out
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Clean up the dead child
    if pid_is_alive "$CHILD_PID"; then
      warn "Boot timeout (${boot_timeout}s) — killing stuck process"
      kill_tree "$CHILD_PID" 9
    else
      wait "$CHILD_PID" 2>/dev/null || true
    fi
    CHILD_PID=""

    if [[ $duration -gt $CRASH_WINDOW ]]; then
      # It ran for a while — not a rapid crash, reset counter
      rapid_crashes=0
      backoff=$INITIAL_BACKOFF
      warn "Process died after ${duration}s — reviving immediately..."
    else
      # Rapid crash — apply backoff
      ((rapid_crashes++))
      warn "Crashed in ${duration}s (rapid crash $rapid_crashes/$MAX_RAPID_CRASHES)"

      if [[ "$NO_RESTART" == true ]]; then
        err "Auto-restart disabled — exiting"
        return 1
      fi

      backoff=$((backoff * 2))
      if [[ $backoff -gt $MAX_BACKOFF ]]; then
        backoff=$MAX_BACKOFF
      fi
    fi

  done
}

# ─── Main ─────────────────────────────────────────────────────────

SCRIPT=""
PORT_OVERRIDE=""
NO_RESTART=false
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h) usage ;;
    init) install_shell_hook; exit 0 ;;
    uninstall) uninstall_shell_hook; exit 0 ;;
    --no-vhost) VHOST_ENABLED=false; shift; continue ;;
    hosts)
      if [[ "${2:-}" == "sync" ]]; then
        log "To enable Safari support, add entries to /etc/hosts:"
        if [[ -f "$VHOST_FILE" ]]; then
          bun -e "
            const d = JSON.parse(require('fs').readFileSync('$VHOST_FILE','utf-8'));
            for (const name of Object.keys(d)) {
              console.log('127.0.0.1  ' + name + '.localhost');
            }
          " 2>/dev/null
          echo ""
          log "Run: ${BOLD}sudo sh -c 'cat >> /etc/hosts'${NC} and paste the above lines"
        else
          warn "No active vhosts found"
        fi
        exit 0
      fi
      ;;
    --port)
      PORT_OVERRIDE="$2"
      if [[ ! "$PORT_OVERRIDE" =~ ^[0-9]+$ ]]; then
        err "Invalid --port value: '$PORT_OVERRIDE' (must be numeric)"
        exit 1
      fi
      shift 2
      ;;
    --no-restart)
      NO_RESTART=true
      shift
      ;;
    *)
      if [[ -z "$SCRIPT" ]]; then
        SCRIPT="$1"
      else
        EXTRA_ARGS+=("$1")
      fi
      shift
      ;;
  esac
done

if [[ -z "$SCRIPT" ]]; then
  usage
fi

if [[ ! -f "package.json" ]]; then
  err "No package.json found in $(pwd)"
  exit 1
fi

PM=$(detect_pm)

if ! command -v "$PM" &>/dev/null; then
  err "$PM not found — please install it"
  exit 1
fi

script_exists="no"
if sed -n '/"scripts"/,/^  }/p' package.json 2>/dev/null | grep -q "\"$SCRIPT\"[[:space:]]*:"; then
  script_exists="yes"
fi

if [[ "$script_exists" != "yes" ]]; then
  err "Script '$SCRIPT' not found in package.json"
  dim "Available scripts:"
  sed -n '/"scripts"/,/^  }/{ s/^[[:space:]]*"\([^"]*\)".*/  \1/p; }' package.json 2>/dev/null | grep -v 'scripts' | head -20
  exit 1
fi

echo ""
echo -e "${BOLD}${CYAN}⚡ suparun${NC} v${VERSION} ${DIM}(using $PM)${NC}"
echo ""

if is_server_script "$SCRIPT"; then
  PORT="${PORT_OVERRIDE:-$(detect_port)}"
  if [[ -z "$PORT" || ! "$PORT" =~ ^[0-9]+$ ]]; then
    err "Could not determine a valid port (got: '$PORT'). Use --port <number> to set one explicitly."
    exit 1
  fi
  log "Watchdog mode — guarding port $PORT"

  # Register vhost
  if [[ "$VHOST_ENABLED" == true ]]; then
    local_vhost_name=$(generate_vhost_name)
    vhost_register "$local_vhost_name" "$PORT"
    ensure_proxy_running
    ok "http://${VHOST_NAME}.localhost:${PROXY_PORT} → localhost:${PORT}"
  fi

  run_watchdog "$PORT"
elif is_build_script "$SCRIPT"; then
  run_oneshot
else
  if [[ -n "$PORT_OVERRIDE" ]]; then
    PORT="$PORT_OVERRIDE"
    log "Watchdog mode — guarding port $PORT"

    # Register vhost
    if [[ "$VHOST_ENABLED" == true ]]; then
      local_vhost_name=$(generate_vhost_name)
      vhost_register "$local_vhost_name" "$PORT"
      ensure_proxy_running
      ok "http://${VHOST_NAME}.localhost:${PROXY_PORT} → localhost:${PORT}"
    fi

    run_watchdog "$PORT"
  else
    run_oneshot
  fi
fi
