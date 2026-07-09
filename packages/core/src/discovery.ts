import type { NewMcpServerInput } from "./registryStore";
import type { RegistryFile } from "@mcp-registry/shared";
import { checkPortStatus } from "./connectionStatus";

export const defaultMcpDiscoveryPorts = [
  3000,
  3333,
  4200,
  5000,
  5101,
  5100,
  5101,
  5173,
  5174,
  6274,
  6277,
  8000,
  8001,
  8080
];

export async function discoverLocalMcpServers(
  registry: RegistryFile,
  ports = defaultMcpDiscoveryPorts
): Promise<NewMcpServerInput[]> {
  const registeredPorts = new Set(
    registry.servers
      .map((server) => server.port)
      .filter((port): port is number => typeof port === "number")
  );
  const registeredUrls = new Set(registry.servers.map((server) => server.url));
  const uniquePorts = [...new Set(ports)].filter((port) => !registeredPorts.has(port));
  const statuses = await Promise.all(
    uniquePorts.map(async (port) => ({
      port,
      status: await checkPortStatus(port, "127.0.0.1", 250)
    }))
  );

  return statuses
    .filter(({ port, status }) => {
      const url = `http://localhost:${port}/mcp`;
      return status === "running" && !registeredUrls.has(url);
    })
    .map(({ port }) => ({
      name: `Local MCP Server :${port}`,
      target: "other",
      connectionType: "http",
      url: `http://localhost:${port}/mcp`,
      port,
      launchCommand: "",
      workingDirectory: "",
      environment: {},
      notes: "자동 추가로 감지된 로컬 MCP 서버입니다."
    }));
}
