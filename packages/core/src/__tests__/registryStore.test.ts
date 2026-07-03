import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addServer,
  deleteServer,
  loadRegistry,
  updateServer
} from "../registryStore";

let testDir = "";
let registryPath = "";

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "mcp-registry-"));
  registryPath = join(testDir, "registry.json");
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("registryStore", () => {
  it("creates an empty registry when the file does not exist", async () => {
    const registry = await loadRegistry(registryPath);

    expect(registry).toEqual({ version: 1, servers: [] });
  });

  it("adds, updates, and deletes a server", async () => {
    const added = await addServer(registryPath, {
      name: "Revit MCP Bridge",
      target: "revit",
      connectionType: "http",
      url: "http://localhost:5001/mcp",
      port: 5001,
      launchCommand: "revit-mcp-bridge.exe",
      workingDirectory: "C:\\Tools\\RevitMcpBridge",
      environment: {},
      notes: "Revit 2025 bridge"
    });

    expect(added.servers).toHaveLength(1);
    expect(added.servers[0].id).toBeTruthy();
    expect(added.servers[0].status).toBe("unknown");

    const updated = await updateServer(registryPath, added.servers[0].id, {
      notes: "Updated note"
    });

    expect(updated.servers[0].notes).toBe("Updated note");

    const deleted = await deleteServer(registryPath, added.servers[0].id);

    expect(deleted.servers).toHaveLength(0);

    const fileContent = JSON.parse(await readFile(registryPath, "utf8"));
    expect(fileContent).toEqual({ version: 1, servers: [] });
  });
});
