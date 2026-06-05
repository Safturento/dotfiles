# Crew dispatch (`crew run`) conventions

Read when investigating a `crew run <KEY>` failure — environment setup, `npm install`, Playwright, or "I fixed it but the symptom didn't go away" cases. Also read before adding a new step to `prepareAgentEnvironment`.

This file is for gotchas specific to crew's dispatch flow — the host-CLI / bare-worktree split, environment-prep ordering, log-file conventions. Add new entries here as encountered (per `self-improvement.md`).

## "I merged the dispatch fix to `origin/main` and it still reproduces"

`crew run` invokes the **local** `crew` CLI (resolved from `packages/cli/bin/crew` in your host repo). Behaviour is whatever's in your local HEAD, not `origin/main`. Merging a fix on GitHub doesn't change the binary you dispatch with — only `git pull` does.

How to recognize:

- `git merge-base --is-ancestor <fix-commit> HEAD` returns nonzero
- The log file the fix was supposed to write (e.g. `/tmp/crew-<new-step>-<key>.log`) doesn't exist for the failed dispatch
- The failure mode is identical to the pre-fix symptom

Fix:

```bash
git -C ~/Repos/crew pull --ff-only origin main
```

Then re-dispatch.

## `npx <tool>` in a dispatch worktree no-ops silently

Worktrees are bare — `git worktree add` produces a checkout with no `node_modules`. The bare-worktree design is intentional (documented in `packages/cli/src/lib/mcp-config/write-mcp-file.ts:73-79`).

Consequence: any dispatch step that runs `npx <tool>` in the worktree falls back to non-project resolution. `npx playwright install chromium`, for example, prints a "no project dependencies" warning and exits `rc=0` without downloading anything useful — the dispatch continues thinking the install succeeded.

When adding a new dispatch step in `prepareAgentEnvironment` that needs project-resolved binaries: ensure `npm install` runs in the worktree first. As of CREW-184, `prepareAgentEnvironment` runs `npm install` before `installPlaywrightBrowsers` when `playwrightEnabled(config)`; extend the same gate (or add a new one) for any sibling tooling that needs the same.

For MCP-side resolution that needs a binary's path without touching the worktree (e.g. visual-fidelity-check's Chrome executable), resolve from `config.repo_path` instead — see `resolveChromiumExecutablePath` in `write-mcp-file.ts` for the established pattern.

## Playwright pins to a specific Chromium revision

Symptom: `playwright test` fails with `Executable doesn't exist at ~/.cache/ms-playwright/chromium_headless_shell-<N>/...` even though `~/.cache/ms-playwright/` contains a `chromium_headless_shell-<M>` directory.

Playwright doesn't use the system Chrome and has no fallback to "use whatever's installed." Each `@playwright/test@X.Y.Z` is hardcoded to a single Chromium revision (e.g. 1.59.x → revision 1217, 1.60.x → 1223). The CDP wire protocol, DOM event timing, and headless-shell automation hooks shift between Chromium builds, so the pin is real, not paranoid.

When a different workspace pulls in a newer Playwright, the cache fills with the new revision but the older one isn't deleted — multiple revisions coexist fine. The issue is that `npx playwright install` only downloads the revision matching the currently-resolved `@playwright/test`. If you bump Playwright (or branches diverge), re-run `npx playwright install` from inside the affected workspace.
