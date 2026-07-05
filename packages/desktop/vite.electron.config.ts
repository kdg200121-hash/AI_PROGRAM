import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@mcp-registry/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      "@mcp-registry/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url))
    }
  },
  build: {
    emptyOutDir: true,
    outDir: "dist-electron",
    target: "node20",
    rollupOptions: {
      external: ["electron", ...builtinModules, ...builtinModules.map((module) => `node:${module}`)],
      input: {
        main: "electron/main.ts",
        preload: "electron/preload.ts"
      },
      output: {
        entryFileNames: "[name].cjs",
        format: "cjs"
      }
    }
  }
});
