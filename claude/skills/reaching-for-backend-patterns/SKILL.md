---
name: reaching-for-backend-patterns
description: Invoke any time you are about to write or edit Node backend code — routes, services, request/body validation, DB queries, error handling, config/env reads, or service wiring. Teaches the canonical layering (Fastify + Zod + Kysely + typed errors + Awilix DI); you must consult before writing in any of those locations even when libraries are already chosen by the plan or surrounding code.
---

# Reaching for backend patterns

## Overview

Node backends have well-trodden problems with canonical solutions plus a layering pattern that holds up across project sizes. When you reach for inline validation, embedded DB queries in route handlers, or per-route try/catch, **pause** — the canonical answer is almost always one of: a Zod schema, a service method, a typed error thrown from the service, or a Fastify route resolving from an Awilix container.

The pattern is more important than any individual library. The libraries are picked deliberately to align with the frontend stack (Zod, Vitest) so the same schema language and the same testing primitives carry across the wire.

## When to use

You're about to write any of these in a backend file:

- An `if (!body.email || typeof body.email !== 'string')` chain inside a route handler.
- A Kysely query embedded directly in a route handler.
- A `try/catch` in a route handler to convert errors to `reply.code(404).send(...)`.
- A `process.env.PORT ?? 3000` read scattered across the codebase.
- A `new ServiceX(...)` instantiated inside a route or another service.

**Don't use** for: throwaway scripts, one-off CLIs, or migration scripts that don't need long-term structure.

## Decision framework

| Problem | Reach for |
|---|---|
| **HTTP framework** | Fastify |
| **Schema validation** (request bodies, params, env, configs) | Zod (with `fastify-type-provider-zod` on Fastify) |
| **DB query builder** | Kysely |
| **Migrations** | Kysely's migration runner |
| **Auth** | Better Auth |
| **DI when warranted** (see threshold below) | `@fastify/awilix` (or plain Awilix) |
| **Logging** | `pino` |
| **Config / env vars** | Zod schema parsed once at boot |
| **Testing** | Vitest + real DB fixtures (see CLAUDE.md "tmpdir-based fixtures over mocks") |

## The layering pattern

**Routes are thin.** Their job is: validate input → call a service → render response. Routes never import `db` / `auth` directly; they receive their dependencies from the DI container (or via the service's exported instance for tiny apps).

```ts
// src/routes/users.ts
const CreateUserBody = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(50),
});

app.post('/api/users', { schema: { body: CreateUserBody } }, async (req, reply) => {
  const userService = req.diScope.resolve('userService');
  const user = await userService.create(req.body);
  return reply.code(201).send(user);
});
```

**Services own business logic + queries.** They throw typed errors when things go wrong; they never know about HTTP.

```ts
// src/services/UserService.ts
export class UserService {
  constructor(private db: Kysely<Database>) {}

  async create(input: CreateUserInput): Promise<User> {
    try {
      return await this.db.insertInto('users').values({...}).returningAll().executeTakeFirstOrThrow();
    } catch (err) {
      if (isUniqueViolation(err, 'users_email_key')) throw new ConflictError('email already registered');
      throw err;
    }
  }
}
```

**Typed errors → central error handler.** Define typed errors once. The framework's `setErrorHandler` converts them to HTTP responses. Routes never `try/catch` for normal control flow.

```ts
// src/errors.ts
export class NotFoundError extends Error { /* with optional resource + id */ }
export class ForbiddenError extends Error { /* */ }
export class ConflictError extends Error { /* */ }

// src/app.ts
app.setErrorHandler((err, req, reply) => {
  if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
  if (err instanceof ForbiddenError) return reply.code(403).send({ error: err.message });
  if (err instanceof ConflictError) return reply.code(409).send({ error: err.message });
  if (err.validation) return reply.code(400).send({ error: 'invalid_input', details: err.validation });
  req.log.error({ err }, 'unhandled error');
  return reply.code(500).send({ error: 'internal_error' });
});
```

**Config is validated at boot.** A Zod schema parses `process.env` once on startup. The rest of the app reads typed config from a single object — no scattered `process.env.X` reads.

```ts
// src/config.ts
const ConfigSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number(),
});
export const config = ConfigSchema.parse(process.env);
```

## Principles travel further than libraries

The layering pattern (thin route → service → typed errors → central handler) holds in any stack. The libraries above are the team default; the layering itself is the durable rule. If you're working in a codebase that committed to alternatives, *apply the principle without forcing the libraries*.

Concrete translations:

- **Express + Drizzle + Clerk** (a project that pre-dates the canonical stack): same layering. Express handler with `Schema.safeParse(req.body)` on the way in, business logic in a service module under `services/`, custom error subclasses thrown from the service, an Express `errorHandler` middleware (registered last via `app.use(errorHandler)`) that maps the error class to a status code. Awilix is optional — below the second-service threshold (next section), importing services as module singletons is fine; above it, plain `awilix` (without `@fastify/awilix`) plugs into Express via a `req.scope = container.createScope()` middleware.
- **NestJS**: same layering, expressed through Nest's pipes + providers + filter exception classes. Don't fight the framework; map the principle onto its primitives.
- **Hono / Koa / etc.**: same layering, with the framework's middleware shape playing the same role as Fastify's hooks.

The mistake to avoid is the opposite of the canon-skip mistake: don't read this skill in an Express codebase, conclude "it doesn't apply," and skip the layering entirely. The layering IS the principle. The libraries are how the team writes it.

## When to reach for Awilix

The DI threshold:

- **Yes, reach for it** when you have 2+ services with shared dependencies (db, logger, auth), OR request-scoped context (transactions, audit log, current user), OR tests need to swap implementations.
- **No, skip it** for a tiny app with one service and no test injection — a singleton import is fine. Reach for Awilix the moment a second service appears.

When you do use it: register services as `asClass(...).scoped()` (request-scoped), constructor-inject via PROXY mode (`constructor({ db, logger }: Cradle)`), and resolve from `request.diScope` in route handlers. The only file that should import `db` / `auth` directly is the container.

## Common rationalizations

Stop and reconsider when you hear yourself thinking any of these:

| Rationalization | Reality |
|---|---|
| "Fastify ships with TypeBox/Ajv, why bring in Zod?" | Zod is the team's cross-stack default — same schema lib your frontend forms use. Pair Fastify with `fastify-type-provider-zod` for the same end-to-end inference TypeBox gives, with zero ecosystem split. |
| "Lead said quick-and-dirty, no service needed" | A service is *not* ceremony for one query — it's the same code in a different file. Layering doesn't cost anything; it pays when a second consumer appears (or when you need to test the logic without spinning up a route). Extract now. |
| "It's only one query, a service file is overkill" | Same as above. Service file = same code, different home. The "overkill" framing assumes service = ceremony, which isn't true for a typed query builder method. |
| "Fastify's `decorate` IS the DI pattern" | True for tiny apps. But `decorate` doesn't give you request scope, lifetimes, or trivially swappable mocks across a graph of services. Awilix does. The threshold for moving to Awilix is the second service. |
| "I'll inline-map errors in the route, it's clearer" | Until the third route does the same thing and you're updating the mapping in 12 places. `setErrorHandler` registered once is the cheaper write. |
| "I'll extract the service when a second caller appears" | The second caller often appears as a bug report — "we forgot to apply the same auth check." Extracting on day one prevents the divergence. |
| "process.env reads scattered across files are fine" | Until you typo `process.env.SMPT_HOST` and discover at runtime in production. One Zod schema parsed at boot turns every env-var typo into a startup failure with a precise message. |
| "Try/catch in the route is more explicit" | Explicit *and copy-pasted*. The central handler is the same explicitness, written once. |
| "I'll just inject via app.decorate, it's framework-native" | Framework-native ≠ better. Awilix is the team default because it scales: container resolution + scoped lifetimes + clean test substitution. Reaching for `decorate` because it's already in Fastify is the same instinct as TypeBox-instead-of-Zod — short-term local win, long-term inconsistency cost. |

## Red flags — pause and reconsult

- Manual `if/typeof` validation in a route handler.
- A `db.selectFrom(...)` (or any DB query) inside a route handler.
- `try/catch` in a route handler that calls `reply.code(...).send(...)`.
- `process.env.X` read anywhere outside a config schema parse.
- `new ServiceX(...)` instantiated inside a route or another service.
- A Fastify route file longer than ~30 lines that has business logic in it.
- Reaching for `app.decorate(...)` for a service when there are already 2+ services in the project.

Each signals there's a canonical pattern you should be reaching for instead.

## Spirit vs letter

This skill is about *defaulting to the canonical layering*. Violating that default by saying "this case is special" or "the lead said it doesn't matter" is violating the skill — even if the inline code happens to work. The point is consistency: future-you (or future-Claude) opening any file in this codebase finds the same layering, the same validation library, the same error pattern, the same DI surface.

## Don't use as a hammer

- **One-off scripts and migrations.** Inline queries are fine.
- **Existing projects with an established stack that overlaps the skill's recommendations.** If the project committed to an alt-stack — Fastify + TypeBox + `decorate` (rather than Zod + Awilix), Express + Joi/class-validator + Sequelize, NestJS with its decorators + pipes + Nest DI, or any other coherent system — follow what's there. Don't introduce the skill's stack alongside an established convention without an explicit migration decision; mixing standards is worse than either standard alone. The team's pattern *is* the project's canonical layering. (Schema-only libraries like Zod are a partial exception — they can slot into any stack as a *value* validator without replacing the framework's request-validation convention.)
- **Codebase under documented "no new deps" rules.** Stick to manual approaches.
