import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const bridgeRoot = join(process.cwd(), "tools", "mcp-bridges", "revit-addin-bridge");
const appSourcePath = join(bridgeRoot, "src", "RevitMcpBridgeApp.cs");
const projectPath = join(bridgeRoot, "RevitMcpBridge.csproj");
const addinTemplatePath = join(bridgeRoot, "RevitMcpBridge.addin.template");
const installScriptPath = join(bridgeRoot, "scripts", "install-addin.ps1");

describe("Revit add-in MCP bridge template", () => {
  it("contains a Revit ExternalEvent based active-file bridge", () => {
    expect(existsSync(appSourcePath)).toBe(true);
    const source = readFileSync(appSourcePath, "utf8");

    expect(source).toContain("IExternalApplication");
    expect(source).toContain("IExternalEventHandler");
    expect(source).toContain("ExternalEvent.Create");
    expect(source).toContain("ActiveUIDocument");
    expect(source).toContain("PathName");
    expect(source).toContain("HttpListener");
    expect(source).toContain("/active-file");
    expect(source).toContain("/status");
    expect(source).toContain("127.0.0.1:5101");
    expect(source).toContain("CreateRibbonPanel(\"AI Program\")");
    expect(source).toContain("PushButtonData");
    expect(source).toContain("ShowBridgeStatusCommand");
    expect(source).toContain("Autodesk.Revit.Attributes");
    expect(source).toContain("[Transaction(TransactionMode.Manual)]");
    expect(source).toContain("TaskDialog.Show");
    expect(source).toContain("RevitRequestTimeoutSeconds = 12");
    expect(source).toContain("TimeSpan.FromSeconds(RevitRequestTimeoutSeconds)");
    expect(source).toContain("_startupStatus");
    expect(source).toContain("could not open port 5101");
    expect(source).toContain("revitBusyOrBlocked");
    expect(source).toContain("Press ESC in Revit");
    expect(source).toContain("catch (Exception ex)");
    expect(source).toContain("return Result.Succeeded");
    expect(source).toContain("revit.list_levels");
    expect(source).toContain("FilteredElementCollector");
    expect(source).toContain("typeof(Level)");
    expect(source).toContain("tools/call");
    expect(source).toContain("/tools/");
  });

  it("ships project, addin manifest, and install script templates", () => {
    expect(existsSync(projectPath)).toBe(true);
    expect(existsSync(addinTemplatePath)).toBe(true);
    expect(existsSync(installScriptPath)).toBe(true);

    const project = readFileSync(projectPath, "utf8");
    const addin = readFileSync(addinTemplatePath, "utf8");
    const install = readFileSync(installScriptPath, "utf8");

    expect(project).toContain("RevitAPI.dll");
    expect(project).toContain("RevitAPIUI.dll");
    expect(addin).toContain("RevitMcpBridge.RevitMcpBridgeApp");
    expect(addin).toContain("{{ASSEMBLY_PATH}}");
    expect(install).toContain("AIProgramRevitMcpBridge.addin");
    expect(install).toContain("[string]$AssemblyPath");
    expect(install).toContain("AssemblyPath");
  });
});
