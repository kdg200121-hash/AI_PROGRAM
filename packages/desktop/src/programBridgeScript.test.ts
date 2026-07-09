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

  it("allows CAD object reads from an explicit bounded window without scanning model space", () => {
    const content = script();

    expect(content).toContain("Get-WindowSelectionRecords");
    expect(content).toContain("Parse-CadWindowPointText");
    expect(content).toContain("windowRequired");
    expect(content).toContain('$scope -eq "window"');
    expect(content).toContain('$scope -eq "range"');
    expect(content).toContain("$selection.Select(0");
    expect(content).toContain("point1");
    expect(content).toContain("point2");
    expect(content).not.toContain("foreach ($entity in $doc.ModelSpace)");
    expect(content).not.toContain("$selection.Select(5");
  });

  it("routes active-file and status checks through the requested program target", () => {
    const content = script();

    expect(content).toContain("Get-ProgramActiveFileResponse");
    expect(content).toContain("Get-ExcelWorkbook");
    expect(content).toContain("Excel.Application");
    expect(content).toContain("Get-RevitActiveDocument");
    expect(content).toContain("AutodeskRevit");
    expect(content).toContain("Get-ProgramConnectionState");
    expect(content).toContain("(Safe-String $Target).ToLowerInvariant()");
    expect(content).toContain("revit.get_active_document");
    expect(content).toContain("excel.get_active_workbook");
    expect(content).toContain("excel.write_table");
  });


  it("exposes Excel table writing as an available MCP command", () => {
    const content = script();

    expect(content).toContain("excel.write_table");
    expect(content).toContain("Invoke-ExcelWriteTable");
    expect(content).toContain("Resolve-ExcelOutputPath");
    expect(content).toContain("Excel export requires an explicit output folder");
    expect(content).toContain("Workbooks.Add()");
    expect(content).toContain("SaveAs($pathResult.path, 51)");
  });
  it("lets title-block detection use explicit block names or the current selection", () => {
    const content = script();

    expect(content).toContain("Get-PayloadParam");
    expect(content).toContain('$Name.Contains("도곽")');
    expect(content).toContain('$Name.Contains("표제")');
    expect(content).toContain("titleBlockName");
    expect(content).toContain("blockName");
    expect(content).toContain("scope");
    expect(content).toContain("Get-TitleBlockCandidatesFromSelection");
    expect(content).toContain("Selection based title block detection requires a selected block reference in AutoCAD.");
    expect(content).not.toContain("?꾧낸");
    expect(content).not.toContain("?쒖젣");
    expect(content).not.toContain("쨌");
  });

  it("adds a bounded AutoCAD selected text renumber command with explicit apply confirmation", () => {
    const content = script();

    expect(content).toContain("cad.renumber_selected_text");
    expect(content).toContain("Invoke-CadRenumberSelectedText");
    expect(content).toContain("Get-CurrentSelectionEntities");
    expect(content).toContain("confirmApply");
    expect(content).toContain("previewOnly");
    expect(content).toContain("TextString");
    expect(content).toContain("Contents");
    expect(content).toContain("renumber_selected_text");
    expect(content).not.toContain("foreach ($entity in $doc.ModelSpace)");
    expect(content).not.toContain("$doc.Save()");
  });
});
