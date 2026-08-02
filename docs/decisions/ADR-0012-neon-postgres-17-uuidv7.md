# ADR-0012: Match Neon's PostgreSQL 17 UUIDv7 support

**Status:** Accepted
**Date:** 2026-08-02

## Context

A read-only production preflight confirmed that the Neon database runs
PostgreSQL 17.10, not PostgreSQL 18. Its database catalog reports `pg_uuidv7`
1.6 as both available and installed in `public`.

The initial migration installed that extension and created `public.uuidv7()` as
a compatibility wrapper around the extension-owned C function
`public.uuid_generate_v7()`. Production recorded the migration with checksum
`41293403be8333e02621defe4471507d9a0159148abf6d1a03a7977ace9e5b4a`.
Existing database defaults call the wrapper and genuinely generate UUIDv7
values through `pg_uuidv7` today.

An earlier investigation incorrectly assumed production used PostgreSQL 18 and
treated `uuidv7()` as a native function. That assumption was disproved by the
project-specific Neon catalog and migration history.

## Decision

Keep the `pg_uuidv7` extension and `public.uuidv7()` compatibility wrapper in
the initial migration. This block is necessary for the deployed PostgreSQL 17
environment and is the migration version production actually applied.

Local development and integration databases must match production's major
version and extension: PostgreSQL 17 with `pg_uuidv7` 1.6 available. The local
Docker image builds the upstream v1.6.0 source at immutable commit
`d186b2516a49392f9d32db246e2339a2ed6d356a` on PostgreSQL 17.10.

The production catalog is the deployment authority when public extension
documentation and the project-specific extension list disagree. Any future
PostgreSQL major-version upgrade must be handled as a deliberate, separately
rehearsed database change.

## Consequences

- Fresh local, test, and Neon PostgreSQL 17 databases can replay the initial
  migration before any table uses `DEFAULT uuidv7()`.
- Existing UUID values, columns, foreign keys, defaults, and Prisma
  `dbgenerated("uuidv7()")` declarations remain unchanged.
- The repository migration checksum matches the checksum recorded by Neon.
- PostgreSQL 18's native UUIDv7 function is not relied on by this deployment.
