#!/usr/bin/env bash
# mockups/.git-hooks/run-tests.sh
#
# Validates check-rules.sh against the snapshot test cases in test-cases.md.
# Run manually after editing the hook:
#
#   bash mockups/.git-hooks/run-tests.sh
#
# Each test feeds a fixture string (or file body) to check-rules.sh in --stdin
# mode with a fake path. Allow cases must exit 0; ban cases must exit non-zero.

set -uo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECKER="$HOOK_DIR/check-rules.sh"

if [ ! -x "$CHECKER" ]; then
  echo "FATAL: check-rules.sh missing or not executable at $CHECKER" >&2
  exit 2
fi

PASS=0
FAIL=0
FAIL_NAMES=()

# run_case <expected: allow|ban> <name> <fake-path> <fixture>
run_case() {
  local expected="$1" name="$2" path="$3" fixture="$4"
  local out rc
  out="$(printf '%s' "$fixture" | "$CHECKER" --stdin "$path" 2>&1)"
  rc=$?
  case "$expected" in
    allow)
      if [ "$rc" -eq 0 ]; then
        printf '  PASS  [allow] %s\n' "$name"
        PASS=$((PASS + 1))
      else
        printf '  FAIL  [allow] %s — expected exit 0, got %d\n' "$name" "$rc"
        printf '         output: %s\n' "$out"
        FAIL=$((FAIL + 1))
        FAIL_NAMES+=("[allow] $name")
      fi
      ;;
    ban)
      if [ "$rc" -ne 0 ]; then
        printf '  PASS  [ban]   %s\n' "$name"
        PASS=$((PASS + 1))
      else
        printf '  FAIL  [ban]   %s — expected non-zero exit, got 0\n' "$name"
        printf '         output: %s\n' "$out"
        FAIL=$((FAIL + 1))
        FAIL_NAMES+=("[ban]   $name")
      fi
      ;;
  esac
}

echo "== Allow cases =="

run_case allow "border-l-4 (4-px pip)" "mockups/src/screens/Sample.tsx" \
'export const X = () => <div className="border-l-4 border-tertiary" />;'

run_case allow "border-l-2 (narrow pip)" "mockups/src/screens/Sample.tsx" \
'export const X = () => <div className="border-l-2 border-error" />;'

run_case allow "focus:border focus:border-primary" "mockups/src/screens/Sample.tsx" \
'export const X = () => <input className="focus:border focus:border-primary" />;'

run_case allow "aria-invalid:border aria-invalid:border-error" "mockups/src/screens/Sample.tsx" \
'export const X = () => <input className="aria-invalid:border aria-invalid:border-error" />;'

run_case allow "focus-visible:border-2 paired" "mockups/src/screens/Sample.tsx" \
'export const X = () => <input className="focus-visible:border-2 focus-visible:border-primary" />;'

run_case allow "canonical status_pending_approval" "mockups/src/screens/Sample.tsx" \
'export const X = () => <span className="status_pending_approval" />;'

run_case allow "hex literal inside tokens.ts" "mockups/src/tokens.ts" \
'export const colour = "#3f484a";'

run_case allow "<SectionShift /> from src/shell/" "mockups/src/screens/Sample.tsx" \
'import { SectionShift } from "@/shell"; export const X = () => <SectionShift />;'

run_case allow "Inter font-family" "mockups/src/screens/Sample.tsx" \
'export const X = () => <div style={{ fontFamily: "Inter, sans-serif" }} />;'

run_case allow "border-radius unaffected" "mockups/src/screens/Sample.tsx" \
'export const X = () => <div className="rounded-lg p-2 bg-surface" />;'

run_case allow "ts file in lib/ — utility code" "mockups/src/lib/util.ts" \
'export function foo() { return 1; }'

run_case allow "tokens.ts exports tenant_brand_accent" "mockups/src/tokens.ts" \
'export const tenant_brand_accent = { hex: "#abcdef" };'

echo ""
echo "== Ban cases =="

run_case ban "bare border + outline_variant" "mockups/src/screens/Sample.tsx" \
'export const X = () => <div className="border border-outline_variant" />;'

run_case ban "border-t (top divider)" "mockups/src/screens/Sample.tsx" \
'export const X = () => <div className="border-t border-outline_variant" />;'

run_case ban "divide-y (sibling divider)" "mockups/src/screens/Sample.tsx" \
'export const X = () => <ul className="divide-y divide-outline_variant" />;'

run_case ban "border-2 without focus-visible" "mockups/src/screens/Sample.tsx" \
'export const X = () => <div className="border-2 border-outline" />;'

run_case ban "hex literal outside tokens.ts" "mockups/src/screens/Sample.tsx" \
'export const X = () => <div style={{ color: "#3f484a" }} />;'

run_case ban "Material Symbols import" "mockups/src/screens/Sample.tsx" \
"import { Check } from '@material-symbols/svg';"

run_case ban "material-symbols-outlined class" "mockups/src/screens/Sample.tsx" \
'export const X = () => <span className="material-symbols-outlined">check</span>;'

run_case ban "Separator import" "mockups/src/screens/Sample.tsx" \
"import { Separator } from '@/components/ui/separator';"

run_case ban "<Separator /> JSX" "mockups/src/screens/Sample.tsx" \
'import { Separator } from "x"; export const X = () => <Separator />;'

run_case ban "invented status_pending_revision" "mockups/src/screens/Sample.tsx" \
'export const X = () => <span className="status_pending_revision" />;'

run_case ban "invented font-body class" "mockups/src/screens/Sample.tsx" \
'export const X = () => <p className="font-body" />;'

run_case ban "invented space-md class" "mockups/src/screens/Sample.tsx" \
'export const X = () => <div className="space-md" />;'

run_case ban "non-Inter inline font-family in CSS string" "mockups/src/screens/Sample.tsx" \
'export const css = "font-family: Helvetica, sans-serif";'

run_case ban "border-x (horizontal)" "mockups/src/screens/Sample.tsx" \
'export const X = () => <div className="border-x border-outline" />;'

run_case ban "border-b (bottom)" "mockups/src/screens/Sample.tsx" \
'export const X = () => <div className="border-b" />;'

echo ""
echo "==============================="
printf 'Passed: %d   Failed: %d\n' "$PASS" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failures:"
  for n in "${FAIL_NAMES[@]}"; do
    echo "  - $n"
  done
  exit 1
fi
echo "All test cases pass."
exit 0
