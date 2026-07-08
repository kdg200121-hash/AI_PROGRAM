import type { SavedCustomFlow } from "./customFlowLibrary";

export interface GithubFlowDocument {
  name: string;
  description: string;
  version: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  graph: SavedCustomFlow["graph"];
}

function safePart(value: string, fallback: string) {
  const normalized = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function githubFlowFileName(flow: Pick<SavedCustomFlow, "name" | "version">) {
  const name = safePart(flow.name, "custom-flow");
  const version = (flow.version ?? "1.0.0").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${name}-${version}.json`;
}

export function createGithubFlowDocument(
  flow: SavedCustomFlow,
  author = flow.author ?? "MCP Registry"
): GithubFlowDocument {
  return {
    name: flow.name,
    description: flow.description,
    version: flow.version ?? "1.0.0",
    author,
    createdAt: flow.createdAt,
    updatedAt: flow.updatedAt,
    graph: flow.graph
  };
}

export function serializeGithubFlowDocument(document: GithubFlowDocument) {
  return `${JSON.stringify(document, null, 2)}\n`;
}
