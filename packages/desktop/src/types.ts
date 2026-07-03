import type { RegistryFile } from "@mcp-registry/shared";

declare global {
  interface Window {
    mcpRegistry?: {
      loadRegistry: () => Promise<RegistryFile>;
    };
    mcpWindow?: {
      setCompactMode: (enabled: boolean) => Promise<void>;
    };
  }
}
