# Crew dispatch (`crew run`) conventions

Read when investigating a `crew run <KEY>` failure — environment setup, `npm install`, Playwright, or "I fixed it but the symptom didn't go away" cases. Also read before adding a new step to `prepareAgentEnvironment`.

This file is for gotchas specific to crew's dispatch flow — the host-CLI / bare-worktree split, environment-prep ordering, log-file conventions, injected session hooks + settings-source loading, the host-side event pipelines (`~/.crew/*` → daemon), and worktree-stack boot. Add new entries here as encountered (per `self-improvement.md`).

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

## Injected `settings.local.json` hooks never run under `claude -p`

`crew run` spawns the agent as `claude --dangerously-skip-permissions -p <prompt>` (`packages/cli/src/commands/run.ts`; resume/fix-pr in `packages/cli/src/lib/claude/spawn.ts`). In non-interactive print mode, Claude Code does **not** load the `local` settings source by default — only `user` + `project`. So a hook injected into `<worktree>/.claude/settings.local.json` (e.g. the `pr_created` PostToolUse hook from `injectStateEventHook`) is silently never registered — while a hook in the committed `.claude/settings.json` (project source) *does* fire during the same dispatch.

How to recognize:

- The injected hook is correctly present in `<worktree>/.claude/settings.local.json` (right command, right templated key) and the script file exists — yet it never produces output.
- A *different* hook living in the committed `settings.json` works during the same dispatch (proves `project` loads but `local` doesn't).

Fix: pass `--setting-sources user,project,local` on the claude spawn (both the initial-run and resume/fix-pr spawns), or inject the hook config inline via `--settings '<json>'` (more hermetic — it also survives the fix-pr rebase that can clobber the worktree file). `claude --help` documents `--setting-sources <user,project,local>`. (CREW-262)

## Docker creates a bind-mounted `~/.crew/<dir>` as `nobody` → host writers silently fail

docker-compose mounts host dirs into the daemon container (e.g. `${HOME}/.crew/state-events:/root/.crew/state-events:ro`). If the host dir does **not** exist at `docker compose up`, Docker creates it owned by root/`nobody`. Host-side writers — the CLI event emitters (`packages/cli/src/lib/state-events/writer.ts`) and injected hooks — then `appendFile` into it, hit **EACCES**, and (being best-effort) swallow the error to stderr. Net effect: the entire producer pipeline silently writes nothing.

How to recognize:

- `ls -ld ~/.crew/<dir>` shows owner `nobody` — compare to a working sibling (`~/.crew/startup` is owned by you and writes fine).
- The per-key `~/.crew/<dir>/<key>.jsonl` files never appear, even though the producing code is correct and on `HEAD`.

Fix (immediate): `sudo chown -R "$(id -u):$(id -g)" ~/.crew/<dir>`. Durable: crew should ensure the dir is host-owned/writable *before* the daemon mounts it — mirror the runner-log handling (`packages/cli/src/lib/runner/supervisor.ts` `ensureLogDir` + the `CREW_RUNNER_LOG_DIR` chown remediation). (CREW-263)

## Bisecting a silent producer→daemon pipeline: read the durable artifact first

crew's event pipelines (`~/.crew/startup`, `~/.crew/state-events`) are: a producer (CLI / runner / injected hook) **appends a JSONL line** → the daemon **chokidar-tails the dir** and reacts. When the end state is wrong and nothing obvious errored, **read `~/.crew/<dir>/<key>.jsonl`** to split producer from consumer before theorizing:

- File missing / empty → the **producer** broke: not wired, EACCES on a `nobody`-owned dir, a hook gate bailing early, or `settings.local.json` not loaded under `-p`.
- File has the expected lines but the daemon didn't react → the **consumer** broke: daemon stale / not rebuilt, watcher not attached, migration not applied, or reducer logic.

This bisection is what turned a multi-layered "still stuck in `running`/`finished`" mystery into one fix at a time. Don't reason about the daemon before confirming the producer actually produced.

## Detect run outcomes by their result, not by parsing command text

When deciding whether a Bash command *did* something (e.g. the `pr_created` hook deciding a PR was opened), gate on the **observable outcome in the command output** (a real PR URL), not on brittle position-matching of the command text. Position-anchored `gh pr create` regexes (`(^|&&|;|\|)…`) kept missing real forms — `;`/`&&` chains (CREW-251), then newline-separated `cd <wt>`⏎`gh pr create` (CREW-266) — each a silent `→ idle` miss. With an output signal available (the hook sees `tool_response.stdout`), "command mentions `gh pr create` anywhere **and** stdout contains a PR URL" is both simpler and complete: the URL is proof of success and does the false-positive filtering the anchoring was for. The position-anchoring was a holdover from the old transcript-only world, where no command output was available to confirm. (CREW-266)

## Worktree daemon stacks crash on boot with `AVV_ERR_READY_TIMEOUT`

Spinning up multiple worktree stacks at once can crash their daemons on boot. The Fastify `onReady` hook (`packages/daemon/src/app.ts`) serially awaits three chokidar **initial scans** (transcript tail + `~/.crew/startup` + `~/.crew/state-events`); on slow WSL2/docker bind-mounts — especially under the I/O contention of two stacks booting together — the total exceeds Fastify's default 10s `pluginTimeout`. The canonical daemon boots fine because it isn't racing a sibling.

How to recognize: `FST_ERR_HOOK_TIMEOUT` / `AVV_ERR_READY_TIMEOUT` ("onReady hook timed out") in the daemon log right after the `CREW_SEED_FIXTURES=1` line, then `[nodemon] app crashed`.

Fix (immediate): bring stacks up one at a time, or raise `pluginTimeout` on the Fastify constructor. Durable: don't block `onReady` on the watchers' `ready` event — attach them non-blockingly / post-`listen`. (CREW-265, PR #381)
