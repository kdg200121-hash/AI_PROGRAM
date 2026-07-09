import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("renderer build config", () => {
  it("uses relative asset paths for file:// Electron loading", () => {
    const config = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");

    expect(config).toContain('base: "./"');
  });

  it("initializes shared flow catalog before resolving the active submenu item", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    expect(appSource.indexOf("const sharedFlowCatalog = useMemo")).toBeLessThan(
      appSource.indexOf("const activeSubmenuItem =")
    );
  });

  it("opens workflow menu flows as pages instead of inserting them into the current canvas", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const openRequestBlock = appSource.slice(
      appSource.indexOf("if (!openRequest)"),
      appSource.indexOf("}, [openRequest?.requestId]")
    );

    expect(openRequestBlock).toContain("applyWorkflowOpenRequest(openRequest)");
    expect(openRequestBlock).not.toContain("insertStoredFlowGraphAsGroup");
  });

  it("uses a save-and-leave handler for the unsaved workflow confirmation dialog", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    expect(appSource).toContain("const saveAndLeaveWorkflowEditor = () =>");
    expect(appSource).toContain("onClick={saveAndLeaveWorkflowEditor}");
  });

  it("checks workflow unsaved changes only while the canvas editor is open", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const unsavedBlock = appSource.slice(
      appSource.indexOf("const hasUnsavedFlowChanges = () =>"),
      appSource.indexOf("const saveEditingSavedFlow = () =>")
    );

    expect(unsavedBlock).toContain('workflowMode === "editor"');
  });

  it("guards opening another workflow when the current canvas has unsaved changes", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const openRequestBlock = appSource.slice(
      appSource.indexOf("if (!openRequest)"),
      appSource.indexOf("}, [openRequest?.requestId]")
    );

    expect(openRequestBlock).toContain('setPendingWorkflowExit({ type: "open", request: openRequest })');
    expect(openRequestBlock).toContain("setIsLeaveFlowConfirmOpen(true)");
    expect(openRequestBlock).toContain("applyWorkflowOpenRequest(openRequest)");
  });

  it("asks before saving a canvas group as a MY Flow", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    expect(appSource).toContain("requestSaveFlowGroupToMyFlow(group.id)");
    expect(appSource).toContain("confirmSaveFlowGroupToMyFlow");
    expect(appSource).toContain("MY Flow에 저장할까요?");
  });

  it("saves unsaved workflow changes from the leave dialog without opening a prompt", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const saveAndLeaveBlock = appSource.slice(
      appSource.indexOf("const saveAndLeaveWorkflowEditor = () =>"),
      appSource.indexOf("const openSharedFlow =")
    );

    expect(saveAndLeaveBlock).toContain("saveNewFlowBeforeLeaving()");
    expect(saveAndLeaveBlock).not.toContain("window.prompt");
    expect(saveAndLeaveBlock).toContain("applyPendingWorkflowExit()");
  });

  it("keeps market flow success sync messages hidden and allows owned flow unregister", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    expect(appSource).not.toContain("개의 공유 Flow를 가져왔습니다.");
    expect(appSource).toContain("onUnregisterSharedFlow");
    expect(appSource).toContain("canUnregisterSharedFlow");
    expect(appSource).toContain("removeSharedFlowByIdentity");
  });

  it("keeps Market shared flow unregister limited to the current author", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const unregisterPermissionBlock = appSource.slice(
      appSource.indexOf("function canUnregisterSharedFlow"),
      appSource.indexOf("function canManageSharedFlow")
    );

    expect(unregisterPermissionBlock).toContain("isSharedFlowOwnedByCurrentUser(flow)");
    expect(unregisterPermissionBlock).not.toContain("isCurrentAdmin");
    expect(appSource).toContain("function canManageSharedFlow");
  });

  it("auto-starts launchable MCP servers before marking HTTP health checks as failed", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const checkBlock = appSource.slice(
      appSource.indexOf("const checkRegisteredMcpServers = async () =>"),
      appSource.indexOf("const showSidebarContextMenu =")
    );

    expect(checkBlock).toContain("api.startServer(server.id)");
    expect(checkBlock).toContain("waitForMcpBridgeStartup");
    expect(checkBlock).toContain("server.launchCommand.trim()");
    expect(checkBlock).toContain("!isRegistryLoaded");
  });

  it("keeps execution preset controls pinned to the right edge of step headers", () => {
    const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const presetHeaderBlock = styles.slice(
      styles.indexOf(".submenuConfigPanel > .panelHeader .schemaPresetControls"),
      styles.indexOf(".schemaSectionToggle")
    );

    expect(presetHeaderBlock).toContain("margin-left: auto");
    expect(presetHeaderBlock).toContain("justify-content: flex-end");
    expect(presetHeaderBlock).toContain("flex: 0 0 auto");
  });

  it("keeps dialog window actions fixed at the upper-right of modal windows", () => {
    const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const dialogHeaderBlock = styles.slice(
      styles.indexOf(".dialogHeader {"),
      styles.indexOf(".dialogHeader h2")
    );
    const dialogActionsBlock = styles.slice(
      styles.indexOf(".dialogHeaderActions"),
      styles.indexOf(".dialogWindowButton")
    );

    expect(dialogHeaderBlock).toContain("justify-content: space-between");
    expect(dialogActionsBlock).toContain("position: sticky");
    expect(dialogActionsBlock).toContain("top:");
    expect(dialogActionsBlock).toContain("margin-left: auto");
    expect(dialogActionsBlock).not.toContain("order: -1");
  });

  it("wraps long dialog errors instead of clipping custom tool registration dialogs", () => {
    const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const formErrorBlock = styles.slice(styles.indexOf(".formError"), styles.indexOf(".formWarning"));
    const customToolDialogBlock = styles.slice(
      styles.indexOf(".customToolFormDialog"),
      styles.indexOf(".authDialog", styles.indexOf(".customToolFormDialog"))
    );

    expect(formErrorBlock).toContain("overflow-wrap: anywhere");
    expect(customToolDialogBlock).toContain("calc(100vw");
  });

  it("hides unregistered GitHub shared flows on later refreshes", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    expect(appSource).toContain("deletedGithubFlowPathsStorageKey");
    expect(appSource).toContain("loadDeletedGithubFlowPaths");
    expect(appSource).toContain("setDeletedGithubFlowPaths");
    expect(appSource).toContain("!deletedGithubFlowPaths.includes(flow.sourcePath ?? \"\")");
  });

  it("shows compact tool risk metadata inside the execution step row", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

    expect(appSource).toContain("executionStepHeader");
    expect(appSource).toContain("executionStepMetaBadges");
    expect(styles).toContain(".executionStepMetaBadges");
    expect(styles).toContain("width: fit-content");
  });

  it("retries GitHub content deletion with a fresh SHA when GitHub reports a conflict", () => {
    const mainSource = readFileSync(new URL("../electron/main.ts", import.meta.url), "utf8");

    expect(mainSource).toContain("deleteGitHubContentFile");
    expect(mainSource).toContain("status === 409");
    expect(mainSource).toContain("retry");
  });

  it("renders the My Flow market header description under the title", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const titleIndex = appSource.indexOf("<strong>My Flow</strong>");
    const myFlowHeaderBlock = appSource.slice(
      appSource.lastIndexOf("<header>", titleIndex),
      appSource.indexOf("<table className=\"customToolTable marketFlowTable\">", titleIndex)
    );

    expect(myFlowHeaderBlock).toContain("<div>");
    expect(myFlowHeaderBlock).toContain("</div>");
  });

  it("splits settings tool management into all and pending tabs with sorting", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    expect(appSource).toContain('type AdminToolManagementTab = "all" | "pending"');
    expect(appSource).toContain("adminToolManagementTab");
    expect(appSource).toContain("visibleManagementTools");
    expect(appSource).toContain("renderAdminToolSortHeader");
  });

  it("allows settings flow management rows to be sorted and deleted from the context menu", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    expect(appSource).toContain("type AdminFlowSortField");
    expect(appSource).toContain("renderAdminFlowSortHeader");
    expect(appSource).toContain('type: "sharedFlow"');
    expect(appSource).toContain("requestDeleteSharedFlow");
  });

  it("keeps market flow sections stacked vertically", () => {
    const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const marketFlowPanelBlock = styles.slice(
      styles.indexOf(".marketFlowPanel"),
      styles.indexOf(".marketFlowToolbar")
    );

    expect(marketFlowPanelBlock).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(marketFlowPanelBlock).toContain("grid-template-rows: auto minmax(240px, 1fr) minmax(240px, 1fr)");
  });

  it("renders tool and flow-node details as execution steps instead of principle/settings tabs", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    expect(appSource).toContain("<h2>실행 단계</h2>");
    expect(appSource).toContain("ExecutionStepSelector");
    expect(appSource).toContain('"실행 흐름"');
    expect(appSource).not.toContain("<h2>작동 원리</h2>");
    expect(appSource).not.toContain(">작동 원리<");
  });
  it("keeps selected execution step styling separate from current-stage styling", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

    expect(appSource).toContain('step.state === "active" ? "currentStep"');
    expect(styles).toContain(".executionStepButton.currentStep");
    expect(styles).not.toContain(".executionStepButton.activeCurrent");
  });

  it("does not complete title-block previews until candidates are returned", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    expect(appSource).toContain("const hasRequiredPreviewResult =");
    expect(appSource).toContain(
      "isPreviewReady && (!usesTitleBlockCandidates || nextTitleBlockCandidates.length > 0)"
    );
    expect(appSource).toContain("setPreviewGenerated(hasRequiredPreviewResult)");
  });

  it("runs Custom Flow nodes through the tool execution bridge instead of fake timers", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const runFlowBlock = appSource.slice(
      appSource.indexOf("const runFlow = async () =>"),
      appSource.indexOf("const focusFlowIssue =")
    );

    expect(runFlowBlock).toContain("buildFlowNodeExecutionRequest");
    expect(appSource).toContain("window.toolExecution!.run(request)");
    expect(runFlowBlock).toContain("runToolExecutionWithReliabilityNotices(request");
    expect(appSource).toContain("revitBusyRecoveryMessage");
    expect(appSource).toContain("flowSlowExecutionMessage");
    expect(appSource).toContain("toolExecutionRecoveryMessage");
    expect(runFlowBlock).toContain("revitBusyRecoveryMessage");
    expect(runFlowBlock).toContain("flowResultPayload(result)");
    expect(runFlowBlock).not.toContain("setTimeout");
  });
});
