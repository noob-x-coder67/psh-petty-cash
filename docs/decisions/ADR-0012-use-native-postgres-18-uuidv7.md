# ADR-0012: Use PostgreSQL 18's native UUIDv7 function

**Status:** Accepted
**Date:** 2026-08-02

## Context

The application targets PostgreSQL 18, which provides `uuidv7()` as a built-in
function. Neon PostgreSQL 18 does not list the third-party `pg_uuidv7` extension
as available because the extension is unnecessary on that version.

Commit `e5fd891` added `CREATE EXTENSION pg_uuidv7` and a compatibility wrapper
to the already-created initial migration. That changed applied migration history
and made a fresh PostgreSQL 18 migration fail before reaching the valid native
`uuidv7()` defaults.

## Decision

Use PostgreSQL 18's native `uuidv7()` function directly. Do not install
`pg_uuidv7`, create a wrapper named `uuidv7`, or modify the initial migration to
support older PostgreSQL versions. PostgreSQL 18 is a database requirement.

The initial migration is restored byte-for-byte to its original contents and
checksum. Any future database compatibility change must be made as a new forward
migration or deployment prerequisite, never by editing an applied migration.

## Consequences

- Existing UUID columns, values, foreign keys, migration defaults, and Prisma
  `dbgenerated("uuidv7()")` declarations remain unchanged.
- Fresh local, test, and Neon PostgreSQL 18 databases need no UUID extension.
- Disposable databases created from the erroneous migration must be rebuilt.
- A coordinated Neon deployment must first verify the server is PostgreSQL 18
  and that native `uuidv7()` generates a version-7 UUID.
