import js from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";

// Architectural elements and cross-boundary rules from Technical Build Plan §1.3.
const boundaryElements = [
  { type: "web-app", pattern: "apps/web/**" },
  { type: "api-app", pattern: "apps/api/**" },
  { type: "ui-pkg", pattern: "packages/ui/**" },
  { type: "contracts-pkg", pattern: "packages/contracts/**" },
  { type: "config-pkg", pattern: "packages/config/**" },
  { type: "testing-pkg", pattern: "packages/testing/**" },
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/*.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": boundaryElements,
      // Boundaries resolves each import specifier to a file before classifying it;
      // without this it can't follow extension-less relative imports or package
      // "exports" maps (e.g. @psh/config/tsconfig/base.json) and silently no-ops.
      "import/resolver": {
        typescript: true,
      },
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          policies: [
            {
              from: { element: { type: "web-app" } },
              disallow: { element: { type: "api-app" } },
              message:
                "apps/web must not import from apps/api — shared shapes travel through @psh/contracts only (Build Plan §1.3).",
            },
            {
              from: { element: { type: "api-app" } },
              disallow: { element: { type: "ui-pkg" } },
              message: "apps/api must not import from packages/ui (Build Plan §1.3).",
            },
            {
              from: { element: { type: "ui-pkg" } },
              disallow: { element: { types: ["api-app", "web-app"] } },
              message:
                "packages/ui must stay network-unaware — it receives data as props (Build Plan §1.3).",
            },
            {
              from: { element: { type: "contracts-pkg" } },
              disallow: {
                element: { types: ["web-app", "api-app", "ui-pkg", "testing-pkg", "config-pkg"] },
              },
              message:
                "packages/contracts must have zero repo-internal dependencies beyond zod (Build Plan §1.3).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@tanstack/react-query",
              message:
                "packages/ui is network-unaware — it receives data as props (Build Plan §1.3).",
            },
          ],
          patterns: [
            {
              group: ["**/api-client*"],
              message: "packages/ui must not import the API client (Build Plan §1.3).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/api/src/**/*.ts"],
    // *.repository.ts files are the module data-access layer; prisma.service.ts is the
    // single shared connection-lifecycle wrapper (onModuleInit/onModuleDestroy) that
    // repositories inject rather than each instantiating their own PrismaClient.
    ignores: ["apps/api/src/**/*.repository.ts", "apps/api/src/common/prisma/prisma.service.ts"],
    rules: {
      // Only the PrismaClient value itself is restricted to the data-access layer.
      // Type-only imports (RoleKey, UnitType, ...) and the Prisma.Decimal value (money
      // arithmetic, rule 14 — never float) are fine anywhere; they're not database access.
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              importNames: ["PrismaClient"],
              allowTypeImports: true,
              message:
                "Only *.repository.ts files, prisma.service.ts (and prisma/) may import PrismaClient (Build Plan §1.3).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/api/src/**/*.ts"],
    ignores: ["apps/api/src/storage/**"],
    rules: {
      // Rule 18: nothing outside apps/api/src/storage/** may reference a driver by
      // name — callers depend on the AttachmentStorage interface/DI token instead.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/storage/postgres-bytea.driver*", "**/storage/filesystem.driver*"],
              message:
                "Only apps/api/src/storage/** may reference a storage driver by name (CLAUDE.md rule 18).",
            },
          ],
        },
      ],
    },
  },
  {
    // apps/web-only checks. Both live in one no-restricted-syntax array deliberately —
    // a second block setting the same rule key for overlapping files would replace this
    // one wholesale rather than merge with it.
    // 1. AC-018/Build Plan §4.6: bans a fixed, full-height, side-anchored element in
    //    apps/web itself — the permanent-sidebar shape. packages/ui/src/primitives/
    //    sheet.tsx legitimately uses `fixed inset-y-0 right-0` for its temporary,
    //    dismissible detail drawer, but that file lives in packages/ui, outside this
    //    rule's scope — apps/web is only ever meant to consume <Sheet />, never
    //    hand-roll this positioning itself.
    // 2. Rule 14: never toFixed() for money display — use <Money /> from packages/ui.
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^(?=.*\\bfixed\\b)(?=.*\\binset-y-0\\b)(?=.*\\b(left-0|right-0)\\b).*/]",
          message:
            "No fixed, full-height, side-anchored element in apps/web — that's the permanent-sidebar shape AC-018 bans. Use <Sheet /> from @psh/ui for temporary drawers.",
        },
        {
          selector: "CallExpression[callee.property.name='toFixed']",
          message: "Never use toFixed() for money display — use <Money /> from packages/ui (rule 14).",
        },
      ],
    },
  },
  {
    // packages/ui gets the toFixed ban too, but not the sidebar-position one — that
    // primitive (Sheet) legitimately lives here.
    files: ["packages/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='toFixed']",
          message: "Never use toFixed() for money display — use <Money /> from packages/ui (rule 14).",
        },
      ],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
