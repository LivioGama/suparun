#!/usr/bin/env bash
set -euo pipefail

# ─── Test suite for suparun vhost functions ──────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_VHOST_DIR=$(mktemp -d)
VHOST_DIR="$TEST_VHOST_DIR"
VHOST_FILE="$VHOST_DIR/vhosts.json"
VHOST_LOCK="$VHOST_DIR/.lock"

PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
DIM='\033[2m'
NC='\033[0m'

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo -e "  ${GREEN}PASS${NC} $label"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}FAIL${NC} $label"
    echo -e "    ${DIM}expected: $expected${NC}"
    echo -e "    ${DIM}actual:   $actual${NC}"
    FAIL=$((FAIL+1))
  fi
}

assert_file_exists() {
  local label="$1" path="$2"
  if [[ -f "$path" ]]; then
    echo -e "  ${GREEN}PASS${NC} $label"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}FAIL${NC} $label (file not found: $path)"
    FAIL=$((FAIL+1))
  fi
}

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -q "$needle"; then
    echo -e "  ${GREEN}PASS${NC} $label"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}FAIL${NC} $label (not found: $needle)"
    FAIL=$((FAIL+1))
  fi
}

test_cleanup() {
  rm -rf "$TEST_VHOST_DIR"
}
trap test_cleanup EXIT

# ─── Extract functions from suparun.sh ───────────────────────────────
# Use awk to properly extract complete function bodies (handles nesting)

extract_fn() {
  awk "/^${1}\\(\\)/{found=1; depth=0} found{if(/\\{/)depth++; if(/\\}/)depth--; print; if(found && depth==0){found=0}}" "$SCRIPT_DIR/suparun.sh"
}

VHOST_NAME=""

eval "$(extract_fn generate_vhost_name)"
eval "$(extract_fn _vhost_lock)"
eval "$(extract_fn _vhost_unlock)"
eval "$(extract_fn vhost_register)"
eval "$(extract_fn vhost_deregister)"

echo ""
echo "=== suparun vhost tests ==="
echo ""

# ─── Test: generate_vhost_name ───────────────────────────────────────
echo "# generate_vhost_name"

tmpdir=$(mktemp -d)
pushd "$tmpdir" > /dev/null

echo '{"name": "@scope/my-app", "version": "1.0.0"}' > package.json
result=$(generate_vhost_name)
assert_eq "strips @scope/ prefix" "my-app" "$result"

echo '{"name": "Simple App", "version": "1.0.0"}' > package.json
result=$(generate_vhost_name)
assert_eq "lowercases and sanitizes" "simple-app" "$result"

echo '{"version": "1.0.0"}' > package.json
result=$(generate_vhost_name)
dir_name=$(basename "$tmpdir" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g; s/--*/-/g; s/^-//; s/-$//')
assert_eq "falls back to directory name" "$dir_name" "$result"

rm package.json
result=$(generate_vhost_name)
assert_eq "no package.json uses dir name" "$dir_name" "$result"

popd > /dev/null
rm -rf "$tmpdir"

# ─── Test: vhost_register creates file on first run ──────────────────
echo ""
echo "# vhost_register"

rm -f "$VHOST_FILE"
vhost_register "test-app" "3000"
assert_file_exists "creates vhosts.json" "$VHOST_FILE"

content=$(cat "$VHOST_FILE")
assert_contains "registers name" "$content" '"test-app"'
assert_contains "registers port" "$content" '"port": 3000'

# ─── Test: vhost_register adds second entry ──────────────────────────
vhost_register "another-app" "3001"
content=$(cat "$VHOST_FILE")
assert_contains "adds second entry" "$content" '"another-app"'
assert_contains "keeps first entry" "$content" '"test-app"'

# ─── Test: collision with dead PID reuses name ───────────────────────
echo ""
echo "# collision handling"

echo '{"taken":{"port":4000,"pid":999999,"cwd":"/tmp"}}' > "$VHOST_FILE"
vhost_register "taken" "4001"
content=$(cat "$VHOST_FILE")
assert_contains "reuses name with dead PID" "$content" '"port": 4001'
assert_eq "VHOST_NAME is original name" "taken" "$VHOST_NAME"

# ─── Test: collision with live PID appends suffix ────────────────────
echo "{\"live\":{\"port\":5000,\"pid\":$$,\"cwd\":\"/tmp\"}}" > "$VHOST_FILE"
vhost_register "live" "5001"
assert_eq "appends suffix for live collision" "live-2" "$VHOST_NAME"

# ─── Test: vhost_deregister ──────────────────────────────────────────
echo ""
echo "# vhost_deregister"

echo '{"app1":{"port":3000,"pid":1,"cwd":"/"},"app2":{"port":3001,"pid":2,"cwd":"/"}}' > "$VHOST_FILE"
remaining=$(vhost_deregister "app1")
assert_eq "returns remaining count" "1" "$remaining"

content=$(cat "$VHOST_FILE")
assert_contains "keeps app2" "$content" '"app2"'

if echo "$content" | grep -q '"app1"'; then
  echo -e "  ${RED}FAIL${NC} removes app1"
  FAIL=$((FAIL+1))
else
  echo -e "  ${GREEN}PASS${NC} removes app1"
  PASS=$((PASS+1))
fi

# ─── Test: deregister last entry returns 0 ───────────────────────────
remaining=$(vhost_deregister "app2")
assert_eq "returns 0 when empty" "0" "$remaining"

# ─── Test: deregister nonexistent key ────────────────────────────────
echo '{"x":{"port":1,"pid":1,"cwd":"/"}}' > "$VHOST_FILE"
remaining=$(vhost_deregister "nonexistent")
assert_eq "nonexistent returns remaining count" "1" "$remaining"

# ─── Test: lock/unlock ───────────────────────────────────────────────
echo ""
echo "# locking"

rmdir "$VHOST_LOCK" 2>/dev/null || true
_vhost_lock
if [[ -d "$VHOST_LOCK" ]]; then
  echo -e "  ${GREEN}PASS${NC} lock creates directory"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} lock creates directory"
  FAIL=$((FAIL+1))
fi

_vhost_unlock
if [[ ! -d "$VHOST_LOCK" ]]; then
  echo -e "  ${GREEN}PASS${NC} unlock removes directory"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} unlock removes directory"
  FAIL=$((FAIL+1))
fi

# ─── Summary ─────────────────────────────────────────────────────────
echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="
echo ""

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
