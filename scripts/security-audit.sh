#!/usr/bin/env bash
# Security audit script — run locally before pushing, or via CI.
# Exit codes: 0 = all clean, 1 = one or more checks failed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
TAURI_DIR="$ROOT/src-tauri"
SRC_DIR="$ROOT/src"

PASS=0
FAIL=1
overall=0

# ── Helpers ─────────────────────────────────────────────────────────────────

green()  { printf '\033[0;32m%s\033[0m\n' "$*"; }
red()    { printf '\033[0;31m%s\033[0m\n' "$*"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }

require() {
    if ! command -v "$1" &>/dev/null; then
        yellow "  SKIP: $1 not found — install with: $2"
        return 1
    fi
}

section() { echo; bold "── $* ──"; }

result() {
    local label="$1" code="$2"
    if [[ "$code" -eq 0 ]]; then
        green "  PASS: $label"
    else
        red   "  FAIL: $label"
        overall=1
    fi
}

# ── 1. Rust dependency audit ─────────────────────────────────────────────────

section "Rust dependency audit (cargo-audit)"
if require cargo-audit "cargo install cargo-audit --locked"; then
    set +e
    audit_json=$(cargo audit -f "$TAURI_DIR/Cargo.lock" --json 2>/dev/null)
    audit_exit=$?
    set -e

    echo "$audit_json" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    print('  (could not parse audit JSON)')
    sys.exit(0)
vulns = data.get('vulnerabilities', {}).get('list', [])
warnings = data.get('warnings', [])
if isinstance(warnings, dict):
    warnings = warnings.get('list', [])
for v in vulns:
    adv = v.get('advisory', {})
    pkg = v.get('package', {})
    patched = v.get('versions', {}).get('patched') or []
    fix = ', '.join(patched) if patched else 'no fix available'
    print(f'  [{adv.get(\"id\")}] {pkg.get(\"name\")} {pkg.get(\"version\")} -- {adv.get(\"title\")}')
    print(f'    Fix: {fix}')
unmaintained = [w for w in warnings if w.get('kind') == 'unmaintained']
if unmaintained:
    print(f'  {len(unmaintained)} unmaintained crate warning(s) -- run cargo audit for full details')
"

    result "cargo audit" "$audit_exit"
fi

# ── 2. JS dependency audit ───────────────────────────────────────────────────

section "JS dependency audit (pnpm audit)"
if require pnpm "npm install -g pnpm"; then
    set +e
    pnpm --dir "$ROOT" audit --audit-level=high 2>&1
    result "pnpm audit --audit-level=high" $?
    set -e
fi

# ── 3. Semgrep static analysis ───────────────────────────────────────────────

section "Static analysis (semgrep)"
if require semgrep "pip install semgrep"; then
    set +e
    semgrep scan \
        --config=p/rust \
        --config=p/secrets \
        --config=p/typescript \
        --error \
        "$TAURI_DIR/src/" "$SRC_DIR/" 2>&1
    result "semgrep" $?
    set -e
fi

# ── 4. Custom pattern checks ─────────────────────────────────────────────────
# These catch project-specific patterns the generic rulesets won't flag.

section "Custom pattern checks"

check_pattern() {
    local label="$1" pattern="$2" target="$3" description="$4"
    local hits
    hits=$(grep -rn --include="*.rs" --include="*.ts" --include="*.tsx" --include="*.json" \
           -E "$pattern" "$target" 2>/dev/null || true)
    if [[ -n "$hits" ]]; then
        red   "  FAIL: $label"
        red   "        $description"
        echo  "$hits" | sed 's/^/        /'
        overall=1
    else
        green "  PASS: $label"
    fi
}

# OM-2026-001: path join with a variable argument (route handlers only).
# Matches .join(var) and .join(&var) but NOT .join("literal") or string::join(" sep").
# False positives are possible — each hit needs a manual eyeball.
check_pattern \
    "Path traversal candidates (.join with variable in route handlers)" \
    '\.join\(&?[a-zA-Z_]' \
    "$TAURI_DIR/src/daemon/routes" \
    "Review each .join(<var>) — ensure the argument is never user-supplied without validation."

# OM-2026-002: Windows file writes without ACL
check_pattern \
    "Windows cfg block with fs::write (no ACL)" \
    'cfg\(not\(unix\)\)' \
    "$TAURI_DIR/src/daemon/auth.rs" \
    "Windows code path writes files — verify ACLs are applied."

# OM-2026-003: CORS predicate (wildcard localhost)
check_pattern \
    "CORS wildcard localhost predicate" \
    'AllowOrigin::predicate' \
    "$TAURI_DIR/src/daemon/routes" \
    "Replace predicate with AllowOrigin::list() using exact origin values."

# OM-2026-004a: CSP unsafe-inline
check_pattern \
    "CSP unsafe-inline" \
    "unsafe-inline" \
    "$TAURI_DIR/tauri.conf.json" \
    "Remove unsafe-inline from style-src; use element.style.setProperty() instead."

# OM-2026-004b: dangerouslySetInnerHTML (style injection risk)
check_pattern \
    "dangerouslySetInnerHTML usage" \
    'dangerouslySetInnerHTML' \
    "$SRC_DIR" \
    "Verify no user-controlled data flows into interpolated HTML strings."


# ── Summary ──────────────────────────────────────────────────────────────────

echo
if [[ "$overall" -eq 0 ]]; then
    green "All checks passed."
else
    red   "One or more checks failed — review output above before pushing."
fi

exit "$overall"
