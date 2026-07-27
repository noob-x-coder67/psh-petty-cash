import { readFileSync } from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";

// Proves the Phase 0 exit gate (Technical Build Plan §5): the dependency-boundary
// rules in eslint.config.js actually reject the imports Build Plan §1.3 forbids,
// and don't reject the ones it allows. Fixtures are linted in-memory (ESLint#lintText)
// against real, on-disk import targets — nothing illegal is ever committed.

const repoRoot = process.cwd();
const eslint = new ESLint({ cwd: repoRoot });

let failures = 0;

function pass(message: string): void {
  console.log(`PASS: ${message}`);
}

function fail(message: string, detail?: unknown): void {
  failures += 1;
  console.error(`FAIL: ${message}`);
  if (detail !== undefined) console.error(detail);
}

async function ruleFired(code: string, filePath: string, ruleId: string): Promise<boolean> {
  const results = await eslint.lintText(code, { filePath: path.join(repoRoot, filePath) });
  const messages = results[0]?.messages ?? [];
  if (process.env.DEBUG_BOUNDARIES) {
    console.error(`[debug] ${filePath}:`, JSON.stringify(messages, null, 2));
  }
  return messages.some((m) => m.ruleId === ruleId);
}

async function main(): Promise<void> {
  // 1. The real codebase must lint clean under the boundary rules.
  const realResults = await eslint.lintFiles(["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"]);
  const realErrors = realResults.flatMap((r) => r.messages.filter((m) => m.severity === 2));
  if (realErrors.length === 0) {
    pass("real codebase lints clean under the boundary rules.");
  } else {
    fail(`real codebase has ${realErrors.length} lint error(s).`, realErrors);
  }

  // 2. apps/web -> apps/api must be rejected.
  if (
    await ruleFired(
      'import { AppModule } from "../../api/src/app.module";\nexport const fixture = AppModule;\n',
      "apps/web/src/__boundary_fixture__.ts",
      "boundaries/dependencies",
    )
  ) {
    pass("apps/web -> apps/api import is rejected.");
  } else {
    fail("apps/web -> apps/api import was NOT rejected.");
  }

  // 3. apps/api -> packages/ui must be rejected (the reverse boundary).
  if (
    await ruleFired(
      'import "../../../packages/ui/src/index";\n',
      "apps/api/src/__boundary_fixture__.ts",
      "boundaries/dependencies",
    )
  ) {
    pass("apps/api -> packages/ui import is rejected.");
  } else {
    fail("apps/api -> packages/ui import was NOT rejected.");
  }

  // 4. apps/web -> packages/contracts must remain allowed (sanity control — the
  //    rule set must not be so broad it rejects everything).
  if (
    await ruleFired(
      'import "../../../packages/contracts/src/index";\n',
      "apps/web/src/__boundary_fixture__.ts",
      "boundaries/dependencies",
    )
  ) {
    fail("apps/web -> packages/contracts was rejected, but this import is allowed.");
  } else {
    pass("apps/web -> packages/contracts import remains allowed.");
  }

  // 5. Only *.repository.ts, prisma.service.ts (and prisma/) may import PrismaClient as a value.
  if (
    await ruleFired(
      'import { PrismaClient } from "@prisma/client";\nexport const client = new PrismaClient();\n',
      "apps/api/src/__prisma_fixture__.ts",
      "@typescript-eslint/no-restricted-imports",
    )
  ) {
    pass("PrismaClient value import outside *.repository.ts is rejected.");
  } else {
    fail("PrismaClient value import outside *.repository.ts was NOT rejected.");
  }

  // 5b. A type-only import from @prisma/client (e.g. RoleKey) is fine anywhere — only
  //     the runtime value is restricted.
  if (
    await ruleFired(
      'import type { RoleKey } from "@prisma/client";\nexport type Fixture = RoleKey;\n',
      "apps/api/src/__prisma_type_fixture__.ts",
      "@typescript-eslint/no-restricted-imports",
    )
  ) {
    fail("a type-only @prisma/client import was rejected, but type imports are allowed.");
  } else {
    pass("type-only @prisma/client imports remain allowed outside *.repository.ts.");
  }

  // 5c. prisma.service.ts itself is the one designated exception besides *.repository.ts.
  if (
    await ruleFired(
      'import { PrismaClient } from "@prisma/client";\nexport class Fixture extends PrismaClient {}\n',
      "apps/api/src/common/prisma/prisma.service.ts",
      "@typescript-eslint/no-restricted-imports",
    )
  ) {
    fail("prisma.service.ts was rejected, but it is the designated PrismaClient wrapper.");
  } else {
    pass("prisma.service.ts remains allowed to import PrismaClient.");
  }

  // 5d. Prisma.Decimal (money arithmetic, rule 14 — never float) is a value import from
  // @prisma/client too, but it is not database access — only the PrismaClient class
  // itself is restricted (importNames), so this must remain allowed everywhere.
  if (
    await ruleFired(
      'import { Prisma } from "@prisma/client";\nexport const amount = new Prisma.Decimal("1.00");\n',
      "apps/api/src/common/ledger/__decimal_fixture__.ts",
      "@typescript-eslint/no-restricted-imports",
    )
  ) {
    fail("Prisma.Decimal was rejected outside *.repository.ts, but it is not database access.");
  } else {
    pass("Prisma.Decimal remains usable anywhere — only PrismaClient itself is restricted.");
  }

  // 5e. Rule 18: only apps/api/src/storage/** may reference a driver by name.
  if (
    await ruleFired(
      'import { FilesystemStorageDriver } from "../../storage/filesystem.driver";\nexport const fixture = FilesystemStorageDriver;\n',
      "apps/api/src/modules/__storage_fixture__/x.service.ts",
      "no-restricted-imports",
    )
  ) {
    pass("storage driver import outside apps/api/src/storage/** is rejected.");
  } else {
    fail("storage driver import outside apps/api/src/storage/** was NOT rejected.");
  }

  // 5f. AC-018/Build Plan §4.6: packages/ui exports no component named Sidebar — a
  // grep-based check (not an ESLint rule) since this is an export-naming invariant,
  // not an import-boundary one.
  const uiIndexSource = readFileSync(path.join(repoRoot, "packages/ui/src/index.ts"), "utf8");
  if (/\bSidebar\b/.test(uiIndexSource)) {
    fail("packages/ui/src/index.ts references something named Sidebar (AC-018).");
  } else {
    pass("packages/ui exports no component named Sidebar (AC-018).");
  }

  // 5g. AC-018/Build Plan §4.6: a fixed, full-height, side-anchored element (the
  // permanent-sidebar shape) is rejected in apps/web.
  if (
    await ruleFired(
      'export const fixture = "fixed inset-y-0 left-0 h-full w-64 border-r";\n',
      "apps/web/src/__sidebar_shape_fixture__.ts",
      "no-restricted-syntax",
    )
  ) {
    pass("fixed full-height left/right-anchored className in apps/web is rejected (AC-018).");
  } else {
    fail("fixed full-height left/right-anchored className in apps/web was NOT rejected.");
  }

  // 5g2. packages/ui/src/primitives/sheet.tsx's own equivalent classes are NOT rejected
  // — the rule is scoped to apps/web only, since Sheet is a legitimate temporary drawer.
  if (
    await ruleFired(
      'export const fixture = "fixed inset-y-0 right-0 h-full w-full max-w-md border-l";\n',
      "packages/ui/src/primitives/__sheet_shape_fixture__.ts",
      "no-restricted-syntax",
    )
  ) {
    fail("packages/ui was rejected for the same className Sheet legitimately uses.");
  } else {
    pass("packages/ui remains allowed to use fixed inset-y-0 side-anchoring (Sheet's own shape).");
  }

  // 5h. Rule 14 / Build Plan §4.6: toFixed() is banned in apps/web and packages/ui —
  // money display must go through <Money />.
  if (
    await ruleFired(
      "export const amount = (1234.5).toFixed(2);\n",
      "apps/web/src/__tofixed_fixture__.ts",
      "no-restricted-syntax",
    )
  ) {
    pass("toFixed() in apps/web is rejected (rule 14).");
  } else {
    fail("toFixed() in apps/web was NOT rejected.");
  }

  // 6. packages/contracts has zero runtime dependencies beyond zod.
  const contractsPkg = JSON.parse(
    readFileSync(path.join(repoRoot, "packages/contracts/package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  const extraDeps = Object.keys(contractsPkg.dependencies ?? {}).filter((dep) => dep !== "zod");
  if (extraDeps.length === 0) {
    pass("packages/contracts has zero runtime dependencies beyond zod.");
  } else {
    fail(`packages/contracts has extra runtime dependencies: ${extraDeps.join(", ")}`);
  }

  if (failures > 0) {
    console.error(`\n${failures} boundary check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll boundary checks passed.");
}

void main();
