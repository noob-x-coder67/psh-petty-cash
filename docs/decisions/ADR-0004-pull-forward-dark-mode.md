# ADR-0004: Pull forward dark-mode implementation ahead of core UAT

**Status:** Accepted
**Date:** 2026-07-28

## Context

`docs/MASTER_SRS.md` §11.4's Design Tokens table states: "Theme: Light-first; dark theme supported after core UAT" — core UAT is Phase 9 of the Build Plan. The project is currently mid-Phase 7/8. `packages/ui/src/tokens/tokens.css`'s own header comment confirms this was a deliberate sequencing decision, not an oversight: "dark theme is explicitly deferred until after core UAT."

A full application-wide UI redesign was requested, with a complete light/dark theme system as a core, non-negotiable requirement (persisted preference, system-preference support, no flash of incorrect theme, every component verified in both themes). Building the redesign's shell, navigation, and page-level visual language without dark-mode-aware tokens from the start would mean redoing that work a second time once Phase 9 lifts the original gate — the token architecture (semantic CSS custom properties consumed by Tailwind v4's `@theme`) is the same substrate either way, so there is no technical reason to build it twice.

## Decision

Dark mode is implemented now, as part of this redesign, rather than deferred to post-UAT. `docs/MASTER_SRS.md` §11.4's Theme row is updated to read "Light and dark, both first-class; theme choice persisted client-side" to keep the binding baseline document truthful about current system behavior.

## Rationale

The original deferral was about sequencing effort sensibly (don't spend design time on a second theme before the primary UI is even validated with real users), not about dark mode being architecturally risky or undesirable. Since the redesign already requires rebuilding the token layer, shell, and every page's visual treatment from scratch, the marginal cost of making every token dark-mode-aware from the start is far lower than retrofitting it later — and shipping a design system with only one theme baked in would make a genuine post-hoc dark-mode addition a much larger, riskier change than doing it now.

## Consequences

- `packages/ui/src/tokens/tokens.css` gains a full dark-mode override block; every semantic token (surface, border, ink, status colors, shadows, focus ring) has a light and dark value from this point forward. Any new token added later must supply both.
- Theme preference (light/dark/system) is persisted client-side (`localStorage`) and applied via a `data-theme` attribute on `<html>`, set by a blocking inline script before first paint to avoid a flash of the wrong theme.
- The pre-UAT plan no longer has a "ship light-only, add dark mode after Phase 9" milestone — that item is considered complete as of this redesign, not deferred.
- Every subsequent page redesign in this effort must be verified in both themes before being considered done, per the acceptance criteria set for this redesign.
