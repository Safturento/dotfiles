# Reaching host services from the Claude Code Bash sandbox (WSL)

Read this when a sandboxed `Bash` command can't reach something that is demonstrably running:

- `curl http://localhost:<port>` gives `Couldn't connect to server` / `Connection refused` even though the service is up (a local dev server, daemon, dashboard, DB admin UI…).
- A Windows interop call from WSL (`*.exe`, `powershell.exe`, `tailscale.exe`) fails with `UtilConnectUnix:... socket failed` or hangs.

The Claude Code Bash sandbox runs in an **isolated network namespace** with outbound traffic forced through a host-side HTTP/SOCKS proxy. So "the service is up, I just can't see it from the sandbox" is the normal failure mode — not a sign the service is down. Confirm the service really is up from a non-sandboxed shell (`! curl ...` in the input box, or ask the user) before debugging the service itself.

## Problem 1 — reaching host `localhost` services

Inside the sandbox, `localhost` resolves to the **namespace's own empty loopback**, not the host's. `NO_PROXY` also lists `localhost`, so a plain `curl` skips the proxy and hits that empty loopback → refused. The fix is to route the localhost request **through the host proxy** (which can see the host's real loopback), provided `localhost`/`127.0.0.1` are in the project's `sandbox.network.allowedDomains` (they are in a standard crew-style config).

Robust recipe (each flag earns its place):

```bash
curl -4 -s --noproxy "" --retry 4 --retry-connrefused --retry-delay 0 --max-time 10 \
  http://localhost:7773/health
```

- `--noproxy ""` — force localhost **through** the proxy instead of bypassing it.
- `-4` — the in-sandbox proxy (`socat` on `*:3128`) listens IPv4-only; without this, curl may try `::1:3128` and get refused.
- `--retry 4 --retry-connrefused --retry-delay 0` — the host proxy establishes the per-target localhost tunnel lazily, so the first 1–2 attempts often refuse before it sticks. Retrying absorbs the warm-up.

Plain `curl localhost:...`, and even `-4 --noproxy ""` *without* the retry, are flaky or fail outright. Use the full recipe.

For Node/`fetch`-based tools, the equivalent is `NODE_USE_ENV_PROXY=1` so Node honors the proxy env (see the crew-specific note in that project's memory).

### Don't reach for `allowLocalBinding`

`sandbox.network.allowLocalBinding: true` governs whether a sandboxed process may **bind/listen** on a local port — it does **not** bridge the sandbox to host loopback services. It won't fix Problem 1. The proxy recipe above is what actually works.

## Problem 2 — WSL → Windows interop (`*.exe`)

Windows interop from WSL (running `tailscale.exe`, `powershell.exe`, etc.) talks over an `AF_UNIX` socket that the sandbox severs by default → `UtilConnectUnix:524: socket failed`. Re-enable unix sockets in the project's **`.claude/settings.local.json`** (gitignored; this is a machine-specific relaxation, not team-wide):

```json
{
  "sandbox": {
    "network": {
      "allowAllUnixSockets": true
    }
  }
}
```

This **merges** with the committed `sandbox` block (it does not replace `allowedDomains` or other keys). It takes effect only **after restarting Claude Code** — sandbox config is read at session start, not live. On WSL+Windows, GUI/daemon tooling like Tailscale typically runs on the **Windows** side: invoke it via the Windows binary path, e.g. `/mnt/c/Program Files/Tailscale/tailscale.exe`, not a WSL-side `tailscale`.

## Fallback — `excludedCommands`

When a command genuinely needs the **host network unmediated** (docker, e2e suites, a project CLI that brings up the stack), the established pattern is to list its prefix under `sandbox.excludedCommands` in the committed `.claude/settings.json` so it runs fully unsandboxed (crew already does this for `docker compose*`, `npx crew*`, `npm run bruno:smoke*`, `npm run test:e2e*`). Prefer the Problem-1 proxy recipe for ordinary localhost HTTP checks — it keeps the domain allowlist enforced — and reserve `excludedCommands` for commands that can't work through the proxy at all.
