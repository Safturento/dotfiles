---
name: bruno-collection-maintenance
description: Use when authoring or modifying HTTP routes (Fastify route registration, controller files, OpenAPI schemas, or anything that adds/changes a request/response shape) in a project with a `bruno/` directory. Even if the change is small, even if a quick `npm run bruno:smoke` looks green, the matching `bruno/endpoints/<group>/<verb>-<name>.bru` must be added or updated in the same commit. Skip only when the change is in a project without `bruno/` at all.
---

# Bruno collection maintenance

This skill applies whenever you author or modify HTTP routes in a project that has a `bruno/` directory. Crew's per-project setup writes a generated `bruno/environments/<envName>.bru` and exports `CREW_BRUNO_ENV=<envName>`, so the project's `npm run bruno:smoke` script can be invoked directly. Your job is to keep the collection in sync with the code.

## File layout

```
bruno/
├── bruno.json                              # collection metadata
├── .gitignore                              # excludes environments/
├── environments/<envName>.bru              # generated per-worktree by crew — never commit
├── endpoints/
│   └── <route-group>/
│       ├── post-create.bru
│       ├── get-show.bru
│       ├── get-list.bru
│       └── delete-destroy.bru
└── flows/
    ├── login.bru                           # the auth flow other flows depend on
    └── main-smoke.bru                      # the canonical end-to-end smoke
```

- **`endpoints/`** — one `.bru` per (route, verb) pair. Filename `<verb>-<name>[-<case>].bru` (e.g. `post-create-with-tags.bru` for a variant). Mirror the project's route grouping (`endpoints/recipes/`, `endpoints/auth/`).
- **`flows/`** — multi-step user journeys. Each flow chains endpoint requests with `vars:post-response` to thread state.

## When you change a route, you change a `.bru`

- **New endpoint** → add a new `.bru` under `endpoints/<group>/`. Pick the closest existing sibling and copy its shape (auth header, body shape, asserts).
- **Renamed endpoint** → rename the `.bru` to match (`mv` it, don't leave the old name dangling).
- **Changed request body** → update the `body { ... }` block.
- **Changed response shape** → update the `assert { ... }` block. Asserts that exercise the new field count as test coverage; vague asserts (e.g. `assert: res.status: 200`) are not.
- **Removed endpoint** → delete the `.bru` and remove any flow steps that called it.

`npm run bruno:smoke` passing is **necessary** but not **sufficient**. Smoke flows hit a small subset of endpoints; coverage drift in less-trafficked endpoints is what this skill prevents.

## Auth chaining pattern

The project's `flows/login.bru` runs first and saves a token via `vars:post-response`:

```
vars:post-response {
  token: res.body.token
}
```

Subsequent flow steps read it from the env (it's set on the env for the duration of the run, scoped to the flow):

```
auth {
  bearer: {
    token: {{token}}
  }
}
```

When you add an authenticated endpoint, copy this shape — do not hand-roll a token by pasting one in.

## What does NOT trigger this skill

- Pure refactors that don't change the request/response shape (renaming an internal helper, splitting a controller into two files where the route signature is identical).
- Backend changes outside the HTTP layer (worker jobs, scheduled tasks, internal services).
- Documentation, comments, formatting.

If you're unsure, the safe default is to update the `.bru` — false positives (a touched-but-unchanged `.bru`) cost a tiny diff; false negatives (an out-of-date `.bru`) hide regressions.
