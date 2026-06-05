---
name: reaching-for-frontend-libraries
description: Invoke any time you are about to write or edit React component code — components, hooks, state, fetch/mutations, forms, async error handling, or class-name variants. Teaches the canonical library for each problem; you must consult before writing or extending orchestration even when a library has already been chosen by the plan or surrounding code.
---

# Reaching for frontend libraries

## Overview

Web frontends have well-trodden problems with canonical solutions. When you reach for `useState` + `useEffect` + manual orchestration, **pause** — there is almost always a small library that does the orchestration better than you will, and the cost is a one-line install plus a few imports. The most common failure mode is rolling your own from scratch because "the job is small enough" — but small jobs grow, and the canonical libraries are designed to be lightweight enough that the small case is also their happy path.

## When to use

You're about to write any of these in a frontend file:

- A `useEffect` that calls `fetch()` plus `useState`s for data + loading + error.
- A form with validation logic in a custom function (or worse, inline in `onChange` handlers).
- A `try/catch` in a component to recover from a failed fetch.
- A new component with `className` ternaries branching on a `variant` or `size` prop.
- A copy-pasted version of a component you've already written, with one prop tweaked.

**Don't use** for: throwaway prototypes, or projects with a documented "no new deps" rule from the architecture (see "Don't use as a hammer" below — vibes from a tech-lead message don't count as that rule).

## Decision framework

| Problem | Reach for |
|---|---|
| **Server state** (fetch + loading + error + refetch + cache) | TanStack Query |
| **Client state — small/scoped** | Zustand |
| **Client state — large** (devtools, time-travel, middleware) | Redux Toolkit |
| **Form state + validation** | React Hook Form + Zod (`@hookform/resolvers/zod`) |
| **Validation schemas (no form)** | Zod |
| **Async error → boundary** | TanStack Query's `throwOnError` (or `react-error-boundary`'s `useErrorBoundary` hook) feeding a boundary |
| **Error boundary itself** | `react-error-boundary` (`<ErrorBoundary fallback={…}>`) |
| **Component variants** | `cva` (`class-variance-authority`) |
| **Headless interactive primitives** (modal, dropdown, popover, tabs, tooltip) | Radix UI |
| **Toasts / notifications** | `sonner` |

## Common rationalizations

Stop and reconsider when you hear yourself thinking any of these:

| Rationalization | Reality |
|---|---|
| "Single endpoint, not worth React Query" | The first endpoint is the cheapest possible test of the lib. By the second one you've rebuilt the same orchestration. `useQuery` ships with cache, retry, refetch, dedupe, and stale-time. Manual refresh is `query.refetch()` — one line. |
| "Manual refresh, not worth a library" | Manual refresh = `query.refetch()`. The "library" you're skipping is one line. |
| "30 minutes to ship, no time for fancy stuff" | RHF + Zod is *faster* to wire than four `useState`s + a hand-written `validate()`. The library IS the shortcut. |
| "Lead said don't restructure" | Wrapping one subtree in `<ErrorBoundary>` is not restructuring — it's adding 3 lines around a component. Restructuring means changing other components' contracts. Adopting a small library inside one component IS surgical. |
| "Error boundaries don't catch async errors" | True, but the canonical pattern is to *throw* async errors INTO a boundary via TanStack Query's `throwOnError: true` or `useErrorBoundary` from `react-error-boundary`. Boundary + async-thrower is the pair, not "boundary alone fails." |
| "3 variants is too small for cva" | The next variant request lands in 1 line with cva, vs forking a hand-rolled class map. By the time you have an icon-only variant + a loading state + a size axis, the class map is unreadable. The threshold is 2 variants, not 5. |
| "Plain code ships zero bytes" | cva is ~700 bytes gz. Your "free" hand-rolled solution costs more in re-reading time once compound variants exist. Bundle size is the wrong axis to optimize on. |
| "I'll just useState for everything" | `useState` is the *primitive*, not the *answer*. Reach for it when no canonical library applies, not as your default. |
| "I'll add it later if we need it" | "Later" means a refactor of the consumer. Adding it on day one means writing one fewer custom orchestration. |

## Red flags — stop and reconsult this skill

If you catch yourself doing any of these, you're about to make the mistake the skill exists to prevent:

- Writing `const [data, setData] = useState(...)` followed by `useEffect(() => { fetch(...) ... })`.
- Writing a `validate(values)` function alongside a form's `useState`s.
- Adding `try/catch` inside a component's render or effect to "recover from a failed fetch."
- Writing the second `className={variant === 'X' ? ... : variant === 'Y' ? ... : ...}` ternary.
- Copy-pasting a component file and tweaking one prop value.
- Reasoning about whether a library is "worth it" based on the size of the *first* use case.
- Citing a true technical fact about a tool (e.g. "boundaries don't catch async") to justify skipping the canonical pattern (boundary + thrower).

## Spirit vs letter

This skill is about *defaulting to the canonical solution*. Violating that default by bikeshedding bundle size, line count, or "this case is special" is violating the skill — even if your custom code happens to work. The point isn't "shortest code wins"; it's "future-you (or future-Claude) inherits a consistent pattern" — usually the libraries above, but consistency *within a project* beats consistency *across projects* when a project has committed to its own pattern.

## Don't use as a hammer

This skill says "reach for the canonical library" — not "every problem needs a library." Counter-cases:

- **One-off prototype that won't ship.** Rolling your own is fine — no maintenance cost.
- **The library doesn't exist for your stack.** Check before assuming; usually it does.
- **Framework or project with an established pattern that overlaps the skill's recommendation.** If the project committed to a framework's data layer (Vike `+data.ts`, Next.js / Remix / Astro loaders, server actions), framework-native forms (Remix `<Form>` + actions), or a styling system that already handles variants — follow it. Don't introduce the canonical library alongside an established convention without an explicit migration decision; mixing standards is worse than either standard alone. The team's pattern *is* the project's canonical solution. (Schema libraries like Zod are an exception — they slot into either pattern as a *value* validator, not a form/data-layer replacement.)
- **Project-internal hook conventions count too.** If a codebase consistently uses domain-scoped `useX` hooks that own data fetching, caching, polling, and optimistic updates, follow that pattern. Adding TanStack Query alongside creates two truths in the same codebase. The carve-out covers any *committed* pattern, not just framework-native ones — a custom hook layer rolled in-house is the project's canonical solution just as much as a framework's data layer is.
- **The architecture explicitly forbids new deps.** Rare, but if a real, documented constraint exists (in CLAUDE.md or similar), use the manual approach. A vibe like "the project is heavy" from a one-off message is *not* this constraint — ask for explicit confirmation before letting it block you.
