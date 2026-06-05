# Fixing CRLF/LF line-ending issues on WSL + Windows

If you're working in a git repo from both Windows and WSL (or just Windows with Git for Windows defaults), you'll eventually hit:

- "warning: LF will be replaced by CRLF" on every git command
- Shell scripts that worked yesterday now fail with `bad interpreter: /usr/bin/env\r` or silent `set -e` exits
- Strict linters/formatters flagging entire files as changed
- Docker builds where `COPY`'d shell scripts won't execute

Root cause: Git for Windows installs with `core.autocrlf=true` globally, so it rewrites text files with CRLF on checkout. WSL tools (bash, node, docker) want LF.

The fix is two parts: **prevent it from happening again** (`.gitattributes`), and **clean up files that already got CRLF'd** (the script).

---

## Part 1 — `.gitattributes` (prevention)

Drop this at the repo root. It tells git "store and check out everything as LF, regardless of what the user's `core.autocrlf` says."

```gitattributes
# Force LF line endings on every text file in the working tree.
* text=auto eol=lf

# Common text formats — explicit even though * text=auto covers them.
*.sh        text eol=lf
*.md        text eol=lf
*.ts        text eol=lf
*.tsx       text eol=lf
*.js        text eol=lf
*.jsx       text eol=lf
*.json      text eol=lf
*.yml       text eol=lf
*.yaml      text eol=lf
*.css       text eol=lf
*.html      text eol=lf
*.toml      text eol=lf

# Binary types — tell git not to attempt CRLF detection on them.
*.png       binary
*.jpg       binary
*.jpeg      binary
*.gif       binary
*.webp      binary
*.ico       binary
*.pdf       binary
*.woff      binary
*.woff2     binary
*.ttf       binary
*.otf       binary
```

The first two rules (`* text=auto eol=lf` plus the explicit `*.sh` line) are the load-bearing ones; the rest is documentation of intent for the next contributor. Add file types as the project demands.

Commit `.gitattributes` first. New checkouts and any future file rewrites will respect it. **Files that were already CRLF'd in a working tree won't auto-fix** — that's what part 2 is for.

---

## Part 2 — `normalize-line-endings.sh` (cleanup)

Save this as `scripts/normalize-line-endings.sh` in the repo, `chmod +x` it, and run from any worktree that pre-dates the `.gitattributes` commit. It:

1. Refuses to run if there are uncommitted changes (it would clobber them)
2. Re-checks out every tracked file via `git checkout-index --all --force` (applies the `eol=lf` smudge)
3. As a brute-force fallback, `sed`-strips any stray `\r` that the smudge left behind (this happens when `core.autocrlf=true` is set globally)
4. Re-stats with `git add -u` so any real normalizations land in the index, ready to commit

```bash
#!/usr/bin/env bash
# Re-checkout every tracked file using the repo's current .gitattributes,
# then strip any stray CRLF from the working tree as a fallback.
#
# Why two passes:  `git checkout-index --all --force` _should_ apply the
# `eol=lf` smudge filter and write LF to disk, but in practice on systems
# with `core.autocrlf=true` set globally (Git for Windows install inherited
# into WSL, etc.) the smudge sometimes leaves CRLF in place anyway.  A
# direct `sed -i 's/\r$//'` on the surviving CRLF files is a brute-force
# guarantee.
#
# Use this on worktrees that pre-date the .gitattributes commit.  Safe:
# does not modify git history or the index; refuses to run if there are
# uncommitted changes.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if ! git diff --quiet || ! git diff --cached --quiet; then
  cat >&2 <<EOF
error: working tree has uncommitted changes.
       checkout-index --force would silently overwrite them.
       commit, stash, or discard first, then re-run.
EOF
  exit 1
fi

# List tracked files whose working-tree representation is CRLF, one per line.
# `git ls-files --eol` output: "i/<idx>  w/<wt>  attr/<attrs>\t<path>"
list_crlf() {
  git ls-files --eol | awk -F'\t' '$1 ~ /w\/crlf/ { print $2 }'
}

before_count="$(list_crlf | wc -l | awk '{print $1}')"

if [ "$before_count" = "0" ]; then
  echo "→ No CRLF working-tree files found.  Nothing to normalize."
  exit 0
fi

echo "→ $before_count CRLF working-tree file(s) found.  Normalizing…"

# --- Pass 1: git checkout-index ---
echo "  pass 1: git checkout-index --all --force"
git checkout-index --all --force

after_pass1="$(list_crlf | wc -l | awk '{print $1}')"
echo "          after pass 1: $after_pass1 CRLF file(s) remain"

# --- Pass 2: brute-force sed on whatever survived ---
if [ "$after_pass1" -gt 0 ]; then
  echo "  pass 2: stripping \\r from $after_pass1 surviving file(s) via sed"
  list_crlf | while IFS= read -r f; do
    [ -f "$f" ] || continue
    # In-place edit; -i works on GNU sed (BSD/macOS would need '-i ""').
    sed -i 's/\r$//' "$f"
  done
fi

after_count="$(list_crlf | wc -l | awk '{print $1}')"

echo
echo "  before: $before_count CRLF files"
echo "  after:  $after_count CRLF files"

if [ "$after_count" -ne 0 ]; then
  echo "  (any remaining CRLF files have explicit eol=crlf attrs — that's fine)"
fi

# Refresh git's stat cache.  sed -i bumps mtime on every rewritten file, which
# leaves git status reporting them as "modified" even when content matches the
# index (a common stat-cache staleness footgun).  `git add -u` re-stats every
# tracked file, drops the dirty bit when content actually matches, and stages
# any real content drift (e.g. when the index itself contained CRLF and is
# now legitimately ahead — that's the case the user wants to commit).
git add -u

if ! git diff --cached --quiet; then
  cat <<EOF

note: index now contains line-ending normalizations that you should commit:
        git status
        git diff --cached --stat
        git commit -m "chore: normalize line endings to LF"
EOF
elif ! git diff --quiet; then
  cat >&2 <<EOF

note: working tree differs from index after normalization — content drift
      beyond just line endings.  Inspect with:
        git diff
EOF
fi

echo "→ Done."
```

---

## Suggested workflow

From a clean (no uncommitted changes) worktree:

```bash
# 1. Add .gitattributes and commit it on its own
git add .gitattributes
git commit -m "chore: enforce LF line endings via .gitattributes"

# 2. Run the normalizer — it'll rewrite CRLF files in place and stage them
chmod +x scripts/normalize-line-endings.sh
scripts/normalize-line-endings.sh

# 3. Commit the normalization pass
git commit -m "chore: normalize line endings to LF"
```

Run the normalizer once per worktree that predates the `.gitattributes` commit. New clones and new worktrees won't need it.

## Optional: stop the warnings globally

If you also want git to stop printing CRLF warnings on the *Windows* side:

```bash
git config --global core.autocrlf false
```

This is less critical once `.gitattributes` exists (the repo's rules win), but it removes the noisy warnings and prevents the global setting from leaking into other repos that don't have a `.gitattributes`.
