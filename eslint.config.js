import js from "@eslint/js";
import tseslint from "typescript-eslint";

const nodeGlobals = {
  Buffer: "readonly",
  console: "readonly",
  process: "readonly",
  URL: "readonly"
};

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "coverage/**", ".turbo/**"]
  },
  {
    files: ["**/*.{js,mjs,ts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: nodeGlobals
    }
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "separate-type-imports",
          prefer: "type-imports"
        }
      ]
    }
  }
);
