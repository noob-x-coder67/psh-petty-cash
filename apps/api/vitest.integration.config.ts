import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

const envPath = fileURLToPath(new URL("./.env.test", import.meta.url));
const parsed = dotenv.config({ path: envPath, override: true }).parsed;

// Prisma's client auto-loads the nearest .env (the root one, DATABASE_URL=psh_petty_cash)
// the moment PrismaService is constructed — that's how a prior run of this suite ended up
// writing 50k+ rows into the same database the dev server and browser were pointed at.
// Loading .env.test here, with override:true, wins that race by setting DATABASE_URL/
// DIRECT_DATABASE_URL in process.env *before* any test file (and therefore PrismaClient)
// is imported. The assertion below is the actual guardrail: if apps/api/.env.test is ever
// missing, misconfigured, or edited to point somewhere else, tests refuse to run rather
// than silently falling back to the dev database.
if (!parsed?.DATABASE_URL?.includes("psh_petty_cash_test")) {
  throw new Error(
    `Integration tests must run against psh_petty_cash_test, not the dev database. ` +
      `Resolved DATABASE_URL from ${envPath}: ${parsed?.DATABASE_URL ?? "(unset)"}`,
  );
}

export default defineConfig({
  test: {
    root: fileURLToPath(new URL(".", import.meta.url)),
    include: ["test/**/*.integration.spec.ts"],
    testTimeout: 20_000,
    env: parsed,
    // All integration test files share one live Postgres instance and several files
    // read-then-assert-unchanged on the same seeded units (e.g. PSH-SOH) — running
    // files in parallel produces genuine cross-file races, not flaky tests.
    fileParallelism: false,
  },
});
