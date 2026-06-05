#!/usr/bin/env bash
#
# Global PreToolUse hook for `gh pr create` and `git commit`. Two soft checks:
#   1. .agents/ parity — warn when changed code matches a topic doc's `covers:`
#      globs but the doc itself was not part of the diff. (No-op without .agents/.)
#   2. README freshness — warn when package.json changed but README.md did not.
#
# Soft gate: exit 1 (warn, non-blocking) on a violation, never exit 2 (block).
# Override with DOC_PARITY_OVERRIDE=1 after stating a reason.
#
# Stdin: Claude Code PreToolUse payload
#   { "cwd": "...", "tool_name": "Bash", "tool_input": { "command": "..." } }

set -euo pipefail

input=$(cat)

command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
case "$command" in
  "gh pr create"*) : ;;
  "git commit"*) : ;;
  *) exit 0 ;;
esac

cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')
[[ -z "$cwd" || ! -d "$cwd/.git" ]] && exit 0
cd "$cwd"

# Determine changed files for the active operation.
case "$command" in
  "gh pr create"*)
    base=$(git merge-base HEAD main 2>/dev/null \
        || git merge-base HEAD origin/main 2>/dev/null \
        || git merge-base HEAD master 2>/dev/null \
        || git merge-base HEAD origin/master 2>/dev/null \
        || true)
    if [[ -z "$base" ]]; then
      echo "doc-parity-gate: cannot determine merge base — skipping" >&2
      exit 0
    fi
    changed=$(git diff --name-only "$base" HEAD)
    ;;
  "git commit"*)
    changed=$(git diff --cached --name-only)
    ;;
esac

[[ -z "$changed" ]] && exit 0

shopt -s extglob globstar
violations=""

# --- Check 1: .agents/ parity (only if topic docs exist) ---
if [[ -d "$cwd/.agents" ]]; then
  for doc in .agents/*.md; do
    [[ -e "$doc" ]] || continue
    [[ "$doc" == ".agents/README.md" ]] && continue

    covers=$(awk '
      /^---$/ { fm++; next }
      fm == 1 && /^covers:[[:space:]]*$/ { in_covers = 1; next }
      in_covers && /^[[:space:]]+-[[:space:]]/ {
        line = $0
        sub(/^[[:space:]]+-[[:space:]]*/, "", line)
        gsub(/[\042\047]/, "", line)
        sub(/[[:space:]]+$/, "", line)
        print line
        next
      }
      in_covers && /^[^[:space:]]/ { in_covers = 0 }
      fm == 2 { exit }
    ' "$doc")
    [[ -z "$covers" ]] && continue

    doc_overlaps=false
    while IFS= read -r pattern; do
      [[ -z "$pattern" ]] && continue
      while IFS= read -r changed_file; do
        [[ -z "$changed_file" ]] && continue
        if [[ "$changed_file" == $pattern ]]; then
          doc_overlaps=true
          break 2
        fi
      done <<< "$changed"
    done <<< "$covers"

    if [[ "$doc_overlaps" == true ]] && ! printf '%s\n' "$changed" | grep -Fxq "$doc"; then
      violations="$violations $doc"
    fi
  done
fi

# --- Check 2: README freshness (universal signal: package.json changed) ---
readme_nudge=false
if [[ -f "$cwd/README.md" ]] \
   && printf '%s\n' "$changed" | grep -Fxq "package.json" \
   && ! printf '%s\n' "$changed" | grep -Fxq "README.md"; then
  readme_nudge=true
fi

if [[ -z "$violations" && "$readme_nudge" == false ]]; then
  exit 0
fi

{
  if [[ -n "$violations" ]]; then
    echo "doc-parity-gate: warning — these .agents/ docs cover changed code but were not updated:"
    for v in $violations; do echo "  - $v"; done
    echo "Review each: update it (and bump last_updated), or confirm it's still current."
  fi
  if [[ "$readme_nudge" == true ]]; then
    echo "doc-parity-gate: warning — package.json changed but README.md was not updated."
    echo "Confirm the README's intro/installation/usage are still accurate."
  fi
  echo ""
  echo "Override: re-run with DOC_PARITY_OVERRIDE=1 set, after stating your reason."
} >&2

if [[ "${DOC_PARITY_OVERRIDE:-}" == "1" ]]; then
  echo "doc-parity-gate: override accepted." >&2
  exit 0
fi

exit 1
