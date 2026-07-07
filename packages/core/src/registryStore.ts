import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { McpServerRecord, RegistryFile } from "@mcp-registry/shared";

export type NewMcpServerInput = Omit<
  McpServerRecord,
  "id" | "status" | "createdAt" | "updatedAt"
>;

export type UpdateMcpServerInput = Partial<NewMcpServerInput> & {
  status?: McpServerRecord["status"];
};

const emptyRegistry = (): RegistryFile => ({ version: 1, servers: [] });

export async function loadRegistry(path: string): Promise<RegistryFile> {
  try {
    const content = (await readFile(path, "utf8")).replace(/^\uFEFF/, "");
    const parsed = JSON.parse(content) as RegistryFile;
    return {
      version: 1,
      servers: Array.isArray(parsed.servers) ? parsed.servers : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyRegistry();
    }
    throw error;
  }
}

export async function saveRegistry(path: string, registry: RegistryFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

export async function addServer(
  path: string,
  input: NewMcpServerInput
): Promise<RegistryFile> {
  const registry = await loadRegistry(path);
  const now = new Date().toISOString();
  const server: McpServerRecord = {
    ...input,
    id: crypto.randomUUID(),
    status: "unknown",
    createdAt: now,
    updatedAt: now
  };
  const next = { ...registry, servers: [...registry.servers, server] };
  await saveRegistry(path, next);
  return next;
}

export async function updateServer(
  path: string,
  id: string,
  input: UpdateMcpServerInput
): Promise<RegistryFile> {
  const registry = await loadRegistry(path);
  const next = {
    ...registry,
    servers: registry.servers.map((server) =>
      server.id === id
        ? { ...server, ...input, id: server.id, updatedAt: new Date().toISOString() }
        : server
    )
  };
  await saveRegistry(path, next);
  return next;
}

export async function deleteServer(path: string, id: string): Promise<RegistryFile> {
  const registry = await loadRegistry(path);
  const next = {
    ...registry,
    servers: registry.servers.filter((server) => server.id !== id)
  };
  await saveRegistry(path, next);
  return next;
}
