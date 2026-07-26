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
    ignores: ["apps/api/src/**/*.repository.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Only *.repository.ts files (and prisma/) may import PrismaClient (Build Plan §1.3).",
            },
          ],
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
