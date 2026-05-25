import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@odinfra/schema": src("./packages/schema/src/index.ts"),
      "@odinfra/generator": src("./packages/generator/src/index.ts"),
      "@odinfra/adapter-opencode": src("./packages/adapter-opencode/src/index.ts"),
      "@odinfra/templates": src("./packages/templates/src/index.ts")
    }
  },
  test: {
    include: ["tests/**/*.test.ts"]
  }
});
