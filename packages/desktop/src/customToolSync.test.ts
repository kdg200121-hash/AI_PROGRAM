import { describe, expect, it } from "vitest";
import { mergeGithubCustomTools } from "./customToolSync";

describe("mergeGithubCustomTools", () => {
  const githubPrefix = "github:kdg200121-hash/AI_PROGRAM/tools/";

  it("preserves registered non-GitHub tools when refreshing Market tools", () => {
    const localTool = {
      id: "local-tool-1",
      sectionId: "servers",
      name: "Local CAD Tool",
      description: "A local tool currently open in the app",
      version: "1.0.0",
      author: "User",
      usageCount: 0,
      pinned: false,
      registered: true,
      approvalStatus: "approved" as const,
      isToolLike: true,
      riskWarnings: [],
      sourcePath: "C:\\Tools\\local-cad-tool.md",
      installedPath: "C:\\Tools\\local-cad-tool.md"
    };

    const result = mergeGithubCustomTools({
      items: [localTool],
      groups: [
        {
          sectionId: "servers",
          name: "Shared CAD Tool",
          versions: [
            {
              id: "github-version-1",
              version: "1.0.0",
              author: "Registry",
              description: "A GitHub shared tool",
              sourcePath: `${githubPrefix}shared-cad-tool.md`,
              installedPath: `${githubPrefix}shared-cad-tool.md`,
              isToolLike: true,
              riskWarnings: []
            }
          ]
        }
      ],
      githubToolPathPrefix: githubPrefix,
      nowIso: "2026-07-08T10:00:00.000Z",
      makeId: () => "github-tool-shared"
    });

    expect(result.map((tool) => tool.id)).toEqual(["local-tool-1", "github-tool-shared"]);
    expect(result[0]).toMatchObject({
      id: "local-tool-1",
      registered: true,
      installedPath: "C:\\Tools\\local-cad-tool.md"
    });
  });

  it("keeps the existing GitHub tool id and registration state for refreshed versions", () => {
    const existingTool = {
      id: "open-detail-tool-id",
      sectionId: "servers",
      name: "CAD Drawing Number",
      description: "Old description",
      version: "1.0.6",
      author: "User",
      usageCount: 3,
      pinned: true,
      registered: true,
      approvalStatus: "approved" as const,
      isToolLike: true,
      riskWarnings: [],
      sourcePath: `${githubPrefix}cad-drawing-number-1.0.6.md`,
      installedPath: `${githubPrefix}cad-drawing-number-1.0.6.md`
    };

    const result = mergeGithubCustomTools({
      items: [existingTool],
      groups: [
        {
          sectionId: "servers",
          name: "CAD Drawing Number",
          versions: [
            {
              id: "github-version-2",
              version: "1.0.7",
              author: "User",
              description: "New description",
              sourcePath: `${githubPrefix}cad-drawing-number-1.0.7.md`,
              installedPath: `${githubPrefix}cad-drawing-number-1.0.7.md`,
              isToolLike: true,
              riskWarnings: []
            }
          ]
        }
      ],
      githubToolPathPrefix: githubPrefix,
      nowIso: "2026-07-08T10:00:00.000Z",
      makeId: () => "new-id-should-not-be-used"
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "open-detail-tool-id",
      version: "1.0.7",
      registered: true,
      pinned: true,
      usageCount: 3
    });
  });
});
