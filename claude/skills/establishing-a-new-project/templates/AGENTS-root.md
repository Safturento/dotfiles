# AGENTS.md

Conventions for agents working on `<PROJECT>`. Universal Node + documentation
conventions live in `~/.claude/conventions/`; this file covers `<PROJECT>`-specific
rules only.

## What this is

<one-paragraph description of the project — what it is and its current scope>

## Repo layout

<fill in as the repo grows>

## When you need it

Topic docs live in `.agents/`. Load one when your work matches its row.

| Doing | Read |
| ----- | ---- |
| _(none yet — add rows as `.agents/<topic>.md` docs are created)_ | |

See [`.agents/README.md`](.agents/README.md) for how this system works and how to extend it.

## Before claiming work complete

If this repo has `.agents/<topic>.md` docs with `covers:` frontmatter, run the
`agents-doc-parity-check` skill before reporting any task complete or opening a PR.
If it has a root `README.md`, run `readme-freshness-check`. Both are additive to
`superpowers:verification-before-completion`, not replacements.
