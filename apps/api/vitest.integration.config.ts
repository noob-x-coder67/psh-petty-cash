import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: fileURLToPath(new URL(".", import.meta.url)),
    include: ["test/**/*.integration.spec.ts"],
    testTimeout: 20_000,
    // All integration test files share one live Postgres instance and several files
    // read-then-assert-unchanged on the same seeded units (e.g. PSH-SOH) — running
    // files in parallel produces genuine cross-file races, not flaky tests.
    fileParallelism: false,
  },
});
