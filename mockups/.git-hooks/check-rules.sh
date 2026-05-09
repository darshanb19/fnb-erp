#!/usr/bin/env bash
# mockups/.git-hooks/check-rules.sh
#
# Core rule-checking engine for the DESIGN.md token-enforcement pre-commit hook.
# Source of truth: docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md §10.8
#
# Usage:
#   check_file <relative-path>           # reads file content from disk
#   check_content <relative-path>        # reads file content from stdin
#
# Sets the global ERRORS counter and prints "X <path>: <message>" to stderr for
# each violation. The pre-commit hook iterates staged files; the test runner
# pipes fixture strings through check_content.
#
# Design notes:
# - tokens.ts is exempt from rule 1 (hex literals) — it is the canonical source.
# - Hook scope EXCLUDES mockups/src/components/ui/ (shadcn primitives are
#   neutralized via globals.css aliases, not source modification — plan §13 Q6.b).
# - Rule 7 (tenant_brand_accent in status proximity) is implemented as a
#   non-blocking warning. Reasoning: the export of `tenant_brand_accent` from
#   tokens.ts and re-imports of it for legitimate decorative use can sit near
#   the literal "status" in unrelated lines. False positive is worse than false
#   negative at scaffolding stage. Documented in test-cases.md.

set -uo pipefail

# Canonical 20 status names per DESIGN.md §6.1 / mockups/src/tokens.ts.
# Append to extend.
STATUS_NAMES=(
  status_draft
  status_pending_approval
  status_pending_gr
  status_provisional
  status_confirmed
  status_in_progress
  status_completed
  status_closed
  status_inactive
  status_archived
  status_version_published
  status_cancelled
  status_gr_rejected
  status_rejected
  status_returned
  status_template_active
  status_template_expired
  status_waiting_info
  status_overridden
  status_variance_flagged
)

ERRORS=${ERRORS:-0}
WARNINGS=${WARNINGS:-0}

_report() {
  echo "X $1" >&2
  ERRORS=$((ERRORS + 1))
}

_warn() {
  echo "! $1" >&2
  WARNINGS=$((WARNINGS + 1))
}

# Strip // line comments (best-effort) so we don't fire on commented-out hex.
# We keep block-comment content because /* #abc */ is rare in these source
# trees, and stripping block comments correctly is more code than payoff.
_strip_line_comments() {
  # Remove from "//" to end-of-line, but only when preceded by whitespace or
  # start-of-line — avoids eating "https://" inside string literals.
  sed -E 's#(^|[[:space:]])//.*$#\1#'
}

_status_is_canonical() {
  local s="$1"
  local c
  for c in "${STATUS_NAMES[@]}"; do
    [ "$s" = "$c" ] && return 0
  done
  return 1
}

# check_content <relative-path>
# Reads file content from stdin and applies all rules.
check_content() {
  local rel="$1"
  local content
  content="$(cat)"

  # Decide rule-1 exemption.
  local hex_exempt=0
  case "$rel" in
    *tokens.ts) hex_exempt=1 ;;
  esac

  # Strip line comments for rules that should ignore commented examples.
  local code
  code="$(printf '%s\n' "$content" | _strip_line_comments)"

  # ---- Rule 1: hex literals ----
  if [ "$hex_exempt" -eq 0 ]; then
    local hex_hits
    hex_hits="$(printf '%s\n' "$code" | grep -nE '#[0-9a-fA-F]{3,8}\b' || true)"
    if [ -n "$hex_hits" ]; then
      _report "$rel: hex literal (rule 1) — use tokens via Tailwind classes / globals.css aliases"
      printf '%s\n' "$hex_hits" | head -5 >&2
    fi
  fi

  # ---- Rule 2: invented tokens ----
  local invented_hits
  invented_hits="$(printf '%s\n' "$code" | grep -nE '\b(font-body|font-display|border-default|space-md|space-lg)\b' || true)"
  if [ -n "$invented_hits" ]; then
    _report "$rel: invented token (rule 2) — these are not in the Tailwind v4 namespace"
    printf '%s\n' "$invented_hits" | head -5 >&2
  fi

  # ---- Rule 3: Material Symbols / Material Icons ----
  local mat_hits
  # imports
  mat_hits="$(printf '%s\n' "$code" | grep -nE "from[[:space:]]+['\"]@?material-(symbols|icons)|from[[:space:]]+['\"]@mui/icons" || true)"
  if [ -n "$mat_hits" ]; then
    _report "$rel: Material Symbols/Icons import (rule 3) — use lucide-react"
    printf '%s\n' "$mat_hits" | head -5 >&2
  fi
  # class names
  local mat_class_hits
  mat_class_hits="$(printf '%s\n' "$code" | grep -nE 'material-icons|material-symbols|\bms-(outlined|rounded|sharp)\b|\bmso-' || true)"
  if [ -n "$mat_class_hits" ]; then
    _report "$rel: Material Symbols/Icons class name (rule 3) — use lucide-react"
    printf '%s\n' "$mat_class_hits" | head -5 >&2
  fi

  # ---- Rule 4: inline font-family not Inter ----
  # We use awk with PCRE-like negative lookahead substitute: match
  # font-family: <something>, then check whether "Inter" appears in the value.
  local ff_hits
  ff_hits="$(printf '%s\n' "$code" | awk '
    /font-family[[:space:]]*:/ {
      line = $0
      # extract value portion after the colon
      n = index(line, "font-family")
      if (n > 0) {
        rest = substr(line, n)
        sub(/^font-family[[:space:]]*:[[:space:]]*/, "", rest)
        if (rest !~ /Inter/) {
          printf("%d:%s\n", NR, $0)
        }
      }
    }
  ' || true)"
  if [ -n "$ff_hits" ]; then
    _report "$rel: non-Inter font-family (rule 4)"
    printf '%s\n' "$ff_hits" | head -5 >&2
  fi

  # ---- Rule 6: <Separator> ----
  # Skip lines that look like JSDoc / block-comment continuations (start with
  # optional whitespace + `*`) and lines starting with `*` mid-block. This is a
  # heuristic but it cleanly avoids false positives from JSDoc that mentions
  # `<Separator>` by name (e.g. SectionShift.tsx's documentation).
  local sep_hits
  sep_hits="$(printf '%s\n' "$code" \
    | grep -vE '^[[:space:]]*\*([[:space:]]|$|/)' \
    | grep -vE '^[[:space:]]*/\*' \
    | grep -nE "from[[:space:]]+['\"]@/components/ui/separator['\"]|<[[:space:]]*Separator\b|</[[:space:]]*Separator[[:space:]]*>" || true)"
  if [ -n "$sep_hits" ]; then
    _report "$rel: Separator import or JSX (rule 6) — use <SectionShift> per §10.7"
    printf '%s\n' "$sep_hits" | head -5 >&2
  fi

  # ---- Rule 5: invented status_* names ----
  # Find every status_<name> token and check membership.
  #
  # Exclusion: skip matches where status_ is preceded by `.` — those are
  # namespaced identifiers from other subsystems (e.g. notification type keys
  # `'issue.status_changed'` from migration 0011), NOT design-token references.
  # The rule's intent is to catch invented design-token names (Tailwind class
  # references like `text-status_<x>` or token-string usage); dotted-namespace
  # identifiers in string literals are a different namespace.
  local seen_invented=""
  while IFS= read -r tok; do
    [ -z "$tok" ] && continue
    if ! _status_is_canonical "$tok"; then
      # de-dupe per file
      case " $seen_invented " in
        *" $tok "*) ;;
        *)
          _report "$rel: invented status \"$tok\" (rule 5) — not in canonical 20"
          seen_invented="$seen_invented $tok"
          ;;
      esac
    fi
  done < <(printf '%s\n' "$code" | awk '
    {
      s = $0
      while (match(s, /status_[a-z_]+/) > 0) {
        pre = (RSTART > 1) ? substr(s, RSTART - 1, 1) : ""
        if (pre != ".") {
          print substr(s, RSTART, RLENGTH)
        }
        s = substr(s, RSTART + RLENGTH)
      }
    }
  ' | sort -u)

  # ---- Rule 7: tenant_brand_accent near status / state context ----
  # Implemented as warning per design note above. We only warn when the literal
  # `tenant_brand_accent` appears within the same line as `status` or `state`,
  # AND the file is not tokens.ts (which legitimately exports the token).
  case "$rel" in
    *tokens.ts) ;;
    *)
      local tba_hits
      tba_hits="$(printf '%s\n' "$code" | grep -nE 'tenant.brand.accent.*\b(status|state)\b|\b(status|state)\b.*tenant.brand.accent' || true)"
      if [ -n "$tba_hits" ]; then
        _warn "$rel: review — tenant_brand_accent used in proximity to 'status'/'state' (rule 7, decorative-only per DESIGN.md §3 §6)"
        printf '%s\n' "$tba_hits" | head -3 >&2
      fi
      ;;
  esac

  # ---- Rule 8: border / divide bans with allow-list ----
  # Per-line scan over lines containing className= or cn(.
  # Tokenize on whitespace + quotes; check each token.
  while IFS= read -r line_match; do
    [ -z "$line_match" ] && continue
    local lineno rest
    lineno="${line_match%%:*}"
    rest="${line_match#*:}"
    # Replace non-class characters with spaces so we tokenize on whitespace.
    # Allowed class chars: a-zA-Z0-9, : (modifiers), - (separators), _ (rare),
    # / (arbitrary values like border-l-[2px]), [ ] (arbitrary values).
    local toks
    toks="$(printf '%s' "$rest" | tr -c 'a-zA-Z0-9:_\-/[]' ' ')"
    local tok
    for tok in $toks; do
      # Quick filter: must contain border or divide as a whole-ish word.
      case "$tok" in
        *border*|*divide*) ;;
        *) continue ;;
      esac

      # Allow narrow pips (with optional colour suffix is fine; we only see
      # a class name like `border-l-4` here — colour is a separate token).
      case "$tok" in
        border-l-2|border-l-4|border-l-8) continue ;;
      esac

      # Allow any class with focus:, focus-visible:, or aria-invalid: prefix.
      case "$tok" in
        focus:border|focus:border-*|focus:divide-*) continue ;;
        focus-visible:border|focus-visible:border-*|focus-visible:divide-*) continue ;;
        aria-invalid:border|aria-invalid:border-*|aria-invalid:divide-*) continue ;;
      esac

      # Enumerate banned bare classes.
      case "$tok" in
        border|border-t|border-b|border-r|border-x|border-y|divide-y|divide-x|border-2)
          _report "$rel:$lineno: banned class '$tok' (rule 8) — see allow-list in plan §10.8"
          ;;
      esac
    done
  done < <(printf '%s\n' "$code" | grep -nE 'className=|cn\(' || true)
}

# check_file <relative-path>
# Reads file from disk via `git show :<path>` so we check the staged version,
# falling back to working tree if the file is not in git's index.
#
# IMPORTANT: We use process substitution rather than a pipe so that ERRORS /
# WARNINGS counters incremented inside check_content propagate back to the
# caller. With a pipe, the right-hand side runs in a subshell and counter
# increments are lost — the hook would print violations but exit 0.
check_file() {
  local rel="$1"
  local body=""
  if body="$(git show ":$rel" 2>/dev/null)"; then
    :
  elif [ -f "$rel" ]; then
    body="$(cat "$rel")"
  else
    return 0
  fi
  check_content "$rel" <<< "$body"
}

# When sourced, expose functions. When run directly with args, treat as
# `check-rules.sh <file> [file...]` and check each.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  if [ "$#" -eq 0 ]; then
    echo "usage: $0 <relative-path> [<relative-path>...]" >&2
    echo "       OR pipe content via stdin and pass a single name:" >&2
    echo "       cat fixture.tsx | $0 --stdin some/path/fake.tsx" >&2
    exit 2
  fi
  if [ "$1" = "--stdin" ]; then
    shift
    [ "$#" -ne 1 ] && { echo "expected exactly one path with --stdin" >&2; exit 2; }
    check_content "$1"
  else
    for f in "$@"; do
      check_file "$f"
    done
  fi
  if [ "$ERRORS" -gt 0 ]; then
    exit 1
  fi
  exit 0
fi
