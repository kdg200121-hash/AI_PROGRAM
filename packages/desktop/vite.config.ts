import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@mcp-registry/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      "@mcp-registry/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url))
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});
