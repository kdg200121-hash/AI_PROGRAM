import { Socket } from "node:net";
import type { McpStatus } from "@mcp-registry/shared";

export function checkPortStatus(
  port: number,
  host = "127.0.0.1",
  timeoutMs = 600
): Promise<McpStatus> {
  return new Promise((resolve) => {
    const socket = new Socket();
    let settled = false;

    const finish = (status: McpStatus) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(status);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish("running"));
    socket.once("timeout", () => finish("stopped"));
    socket.once("error", () => finish("stopped"));
    socket.connect(port, host);
  });
}
