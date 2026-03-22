import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      ".turbo/**",
      "backups/**",
      "**/prisma/migrations/**",
      "**/coverage/**",
    ],
  },

  // TypeScript files
  {
    files: ["apps/*/src/**/*.ts", "packages/*/src/**/*.ts"],
    extends: [tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error", "log"] }],
    },
  },

  // TSX files
  {
    files: ["apps/web/src/**/*.tsx"],
    extends: [tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Prettier compat (must be last)
  prettier
);
