import { createServer, type Server } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { checkPortStatus } from "../connectionStatus";

let server: Server | null = null;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
  }
});

describe("checkPortStatus", () => {
  it("reports running when a port is open", async () => {
    server = createServer();
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    await expect(checkPortStatus(port)).resolves.toBe("running");
  });

  it("reports stopped when a port is closed", async () => {
    await expect(checkPortStatus(9)).resolves.toBe("stopped");
  });
});
