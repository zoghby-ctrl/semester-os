import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  { ignores: ["dist/**", "node_modules/**", "public/**", "output/**", "tmp/**", ".playwright-cli/**"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ["**/*.{ts,tsx}"], rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }], "no-undef": "off" } },
  { files: ["**/*.mjs"], languageOptions: { globals: { process: "readonly", console: "readonly", Buffer: "readonly", URL: "readonly", setTimeout: "readonly" } } },
);
