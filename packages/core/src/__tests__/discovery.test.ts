import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import { discoverLocalMcpServers } from "../discovery";

function listenOnRandomPort(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not bind test server."));
        return;
      }

      resolve({
        port: address.port,
        close: () => new Promise((done) => server.close(() => done()))
      });
    });
  });
}

describe("discoverLocalMcpServers", () => {
  it("returns open local ports as Other MCP server candidates", async () => {
    const server = await listenOnRandomPort();

    try {
      const discovered = await discoverLocalMcpServers(
        { version: 1, servers: [] },
        [server.port]
      );

      expect(discovered).toEqual([
        {
          name: `Local MCP Server :${server.port}`,
          target: "other",
          connectionType: "http",
          url: `http://localhost:${server.port}/mcp`,
          port: server.port,
          launchCommand: "",
          workingDirectory: "",
          environment: {},
          notes: "자동 추가로 감지된 로컬 MCP 서버입니다."
        }
      ]);
    } finally {
      await server.close();
    }
  });

  it("skips ports that are already registered", async () => {
    const server = await listenOnRandomPort();

    try {
      const discovered = await discoverLocalMcpServers(
        {
          version: 1,
          servers: [
            {
              id: "existing",
              name: "Existing",
              target: "other",
              connectionType: "http",
              url: `http://localhost:${server.port}/mcp`,
              port: server.port,
              launchCommand: "",
              workingDirectory: "",
              environment: {},
              status: "running",
              notes: "",
              createdAt: "2026-07-03T00:00:00.000Z",
              updatedAt: "2026-07-03T00:00:00.000Z"
            }
          ]
        },
        [server.port]
      );

      expect(discovered).toEqual([]);
    } finally {
      await server.close();
    }
  });
});
