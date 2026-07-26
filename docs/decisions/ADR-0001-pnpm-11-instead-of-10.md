# ADR-0001: Pin pnpm to the 11.x line instead of the Technical Build Plan's stated 10.x baseline

**Status:** Accepted
**Date:** 2026-07-26

## Context

`docs/TECHNICAL_BUILD_PLAN.md` §1.1 specifies pnpm 10 as the package manager baseline. The development machine already has pnpm 11.17.0 installed globally, and no lockfile or prior workspace commitment exists yet to force compatibility with 10.x.

## Decision

Pin the repository to pnpm 11.x (`packageManager: "pnpm@11.17.0"`, activated via corepack) rather than downgrading tooling to match the Build Plan's stated 10.x baseline.

## Rationale

pnpm's version line is a toolchain choice, not a business rule (BR-xxx/FR-xxx/AC-xxx/NFR-xxx) or an approved-library decision under SRS §13.1. Matching the already-installed, current pnpm release avoids an artificial downgrade with no corresponding benefit.

## Consequences

- `package.json#packageManager` and `engines.pnpm` are pinned to the 11.x line; CI and all contributors must use corepack to activate the matching version.
- This document is the authoritative deviation record; `TECHNICAL_BUILD_PLAN.md` §1.1 is not edited and remains historically accurate to the original baseline.
