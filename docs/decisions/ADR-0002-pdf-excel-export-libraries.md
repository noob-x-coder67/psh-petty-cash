# ADR-0002: Pure-JS PDF/Excel export libraries instead of headless-Chromium rendering

**Status:** Accepted
**Date:** 2026-07-27

## Context

`docs/MASTER_SRS.md` §13.1 ("Approved UI Libraries") names Recharts for charts but names no library for PDF or Excel report export, even though §10.4 ("Report Presentation") and Phase 6 of `docs/TECHNICAL_BUILD_PLAN.md` require polished, paginated PDF and Excel exports (header, filter summary, KPI strip, repeating table headers, totals, page numbers, confidentiality footer).

Two realistic approaches exist:
1. Programmatic, pure-JS document construction (a PDF library that builds the document tree directly, plus a dedicated `.xlsx` writer for Excel).
2. Render the same HTML/React report preview through a headless Chromium instance (e.g. Puppeteer) to produce the PDF.

Build Plan §3.7 already flags that "ZIP archive generation and large PDF/Excel exports will exceed Vercel Hobby execution limits once a month holds real volume" and mandates designing the export endpoint as asynchronous-capable (`{ exportId, status }` + poll endpoint) for exactly this reason.

## Decision

Use pure-JS, programmatic export libraries — a PDF-construction library (e.g. `pdfmake` or `pdf-lib`) and `exceljs` for `.xlsx` — rather than a headless-Chromium/Puppeteer render pipeline.

## Rationale

- **Serverless footprint:** a headless-Chromium dependency ships a large binary and has a materially heavier cold-start and memory profile than a pure-JS document builder — directly working against the demo's Vercel Hobby constraint the Build Plan itself calls out.
- **Streaming-friendly:** programmatic construction can write directly to a response/file stream as rows are produced, matching the async/streaming export requirement (§3.7) without buffering a rendered page image or waiting on a browser process.
- **No duplicate rendering surface:** a Chromium render would require maintaining a second, print-specific HTML layout matched to the live web preview; a programmatic document has its own explicit layout code, which is no more duplicative in practice and avoids a class of "renders differently in headless Chromium than in the browser" bugs.
- Neither library is named in SRS §13.1, so this is a genuine deviation requiring this ADR per Build Plan §1.4.

## Consequences

- New runtime dependencies in `apps/api`: a PDF-construction library and `exceljs`. CSV export needs no library (plain string construction is sufficient).
- The report layout (header, filter summary, KPI strip, table, totals, footer, page numbers) is defined once as data and rendered twice — once for PDF, once for Excel — rather than derived from a shared HTML template. This is intentional, not an oversight: the two formats have different pagination/layout primitives (fixed page geometry vs. worksheet rows), so a literal single "template" would need format-specific escape hatches anyway.
- If a future requirement demands pixel-parity between the on-screen preview and the exported PDF, this decision would need revisiting.
