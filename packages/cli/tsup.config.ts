import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  banner: {
    js: "#!/usr/bin/env node"
  },
  noExternal: [/^@odinfra\//]
});
