import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const bridgeScriptPath = join(
  process.cwd(),
  "tools",
  "mcp-bridges",
  "program-bridge",
  "program-mcp-bridge.ps1"
);

describe("program MCP bridge scaffold", () => {
  const script = () => readFileSync(bridgeScriptPath, "utf8");

  it("exposes safe AutoCAD read commands through the MCP command list", () => {
    const content = script();

    expect(content).toContain("cad.get_active_document");
    expect(content).toContain("cad.list_layers");
    expect(content).toContain("cad.read_objects");
    expect(content).toContain("cad.detect_title_block_candidates");
  });

  it("tries the real AutoCAD COM bridge and returns failure when AutoCAD is not attached", () => {
    const content = script();

    expect(content).toContain("GetActiveObject(\"AutoCAD.Application\")");
    expect(content).toContain("AutoCAD is not running or the COM bridge is not available.");
    expect(content).toContain("ok = $false");
    expect(content).not.toContain("Mock");
    expect(content).not.toContain("fake");
  });

  it("handles JSON-RPC tool calls and direct /tools command posts", () => {
    const content = script();

    expect(content).toContain("Read-HttpRequest");
    expect(content).toContain("tools/call");
    expect(content).toContain("/tools/");
    expect(content).toContain("Invoke-BridgeCommand");
    expect(content).toContain("Content-Length");
    expect(content).toContain("100 Continue");
  });

  it("keeps CAD object reads bounded to the current AutoCAD selection", () => {
    const content = script();

    expect(content).toContain("Get-CurrentSelectionRecords");
    expect(content).toContain("PickfirstSelectionSet");
    expect(content).toContain("ActiveSelectionSet");
    expect(content).toContain("selectionRequired");
    expect(content).not.toContain("foreach ($entity in $doc.ModelSpace)");
    expect(content).not.toContain("$selection.Select(5");
  });

  it("lets title-block detection use explicit block names or the current selection", () => {
    const content = script();

    expect(content).toContain("Get-PayloadParam");
    expect(content).toContain("titleBlockName");
    expect(content).toContain("blockName");
    expect(content).toContain("scope");
    expect(content).toContain("Get-TitleBlockCandidatesFromSelection");
    expect(content).toContain("Selection based title block detection requires a selected block reference in AutoCAD.");
  });
});
