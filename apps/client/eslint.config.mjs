import boundaries from "eslint-plugin-boundaries";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      boundaries,
    },
    settings: {
      "boundaries/elements": [
        { type: "app", pattern: "src/app/*" },
        { type: "features", pattern: "src/features/*" },
        { type: "components", pattern: "src/components/*" },
        { type: "hooks", pattern: "src/hooks/*" },
        { type: "lib", pattern: "src/lib/*" },
        { type: "types", pattern: "src/types/*" },
        { type: "utils", pattern: "src/utils/*" },
        { type: "core", pattern: "src/core/*" },
        { type: "context", pattern: "src/context/*" },
        { type: "pages", pattern: "src/pages/*" },
        { type: "services", pattern: "src/services/*" },
        { type: "shared", pattern: "src/shared/*" },
      ],
      "boundaries/ignore": ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    },
    rules: {
      "boundaries/element-types": [
        2,
        {
          default: "disallow",
          rules: [
            {
              from: "app",
              allow: [
                "features",
                "components",
                "hooks",
                "lib",
                "types",
                "utils",
                "core",
                "context",
                "pages",
                "services",
                "shared",
              ],
            },
            {
              from: "pages",
              allow: [
                "features",
                "components",
                "hooks",
                "lib",
                "types",
                "utils",
                "core",
                "context",
                "services",
                "shared",
              ],
            },
            {
              from: "features",
              allow: [
                "features",
                "components",
                "hooks",
                "lib",
                "types",
                "utils",
                "core",
                "context",
                "services",
                "shared",
              ],
            },
            {
              from: "components",
              allow: ["components", "lib", "types", "utils", "context", "features", "hooks", "core"],
            },
            {
              from: "hooks",
              allow: ["hooks", "lib", "types", "utils", "core", "context", "features", "services"],
            },
            {
              from: "context",
              allow: ["context", "lib", "types", "utils", "core", "hooks", "features", "services"],
            },
            {
              from: "core",
              allow: ["lib", "types", "utils", "core"],
            },
            {
              from: "services",
              allow: ["lib", "types", "utils", "core", "services"],
            },
            {
              from: "lib",
              allow: ["lib", "types", "utils"],
            },
            {
              from: "utils",
              allow: ["utils", "types", "lib"],
            },
            {
              from: "types",
              allow: ["types"],
            },
            {
              from: "shared",
              allow: ["shared", "types", "utils", "lib"],
            },
          ],
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/*", "!@/features/*/index", "!@/features/shared-kernel/*"],
              message:
                "Import from feature barrel (@/features/chat) not internals. Exception: shared-kernel.",
            },
          ],
        },
      ],
    },
  },
];
