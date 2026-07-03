import type { RegistryFile } from "@mcp-registry/shared";

declare global {
  interface Window {
    mcpRegistry?: {
      loadRegistry: () => Promise<RegistryFile>;
    };
  }
}
