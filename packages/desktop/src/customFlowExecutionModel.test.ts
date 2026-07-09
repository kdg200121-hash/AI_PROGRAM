import { describe, expect, it } from "vitest";
import { defaultFlowConnections, defaultFlowNodes, flowToolPalette } from "./customFlowModel";
import {
  buildFlowNodeExecutionRequest,
  flowInputResultsForNode,
  flowResultPayload,
  syntheticFlowNodeResult,
  shouldContinueAfterFlowNodeFailure
} from "./customFlowExecutionModel";

describe("customFlowExecutionModel", () => {
  it("builds executable MCP requests for a flow node and injects previous node results", () => {
    const nodes = defaultFlowNodes();
    const inputResults = {
      objects: {
        rows: [{ handle: "A1", layer: "A-WALL" }]
      }
    };

    const request = buildFlowNodeExecutionRequest({
      node: nodes[1],
      menuName: "Custom Flow",
      runtimeAction: "apply",
      inputResults
    });

    expect(request).toMatchObject({
      kind: "ai-mcp-tool-execution",
      toolName: "Excel 내보내기",
      menuName: "Custom Flow",
      runtimeAction: "apply",
      requiredServers: ["excel"]
    });
    expect(request?.commands[0].params.source).toEqual(inputResults.objects);
    expect(request?.aiInstruction).toContain("Custom Flow");
  });

  it("collects input results from incoming connections by target port id", () => {
    const nodes = defaultFlowNodes();
    const resultsByNodeId = new Map<string, unknown>([
      [nodes[0].nodeId, { rows: [{ handle: "A1" }] }]
    ]);

    expect(flowInputResultsForNode(nodes[1], defaultFlowConnections(), resultsByNodeId)).toEqual({
      objects: { rows: [{ handle: "A1" }] }
    });
  });

  it("builds an executable MCP request for reading Revit levels", () => {
    const tool = flowToolPalette.find((item) => item.id === "revit-list-levels");
    expect(tool).toBeDefined();

    const request = buildFlowNodeExecutionRequest({
      node: {
        ...tool!,
        nodeId: "node-revit-list-levels",
        x: 0,
        y: 0
      },
      menuName: "Custom Flow",
      runtimeAction: "apply"
    });

    expect(request).toMatchObject({
      requiredServers: ["revit"],
      commands: [
        {
          server: "revit",
          command: "revit.list_levels",
          status: "available",
          params: {}
        }
      ]
    });
  });

  it("builds an executable MCP request for selected AutoCAD text renumbering", () => {
    const tool = flowToolPalette.find((item) => item.id === "cad-renumber-selected-text");
    expect(tool).toBeDefined();

    const previewRequest = buildFlowNodeExecutionRequest({
      node: {
        ...tool!,
        nodeId: "node-cad-renumber",
        x: 0,
        y: 0,
        settingsValues: {
          prefix: "A-",
          suffix: "",
          start_number: 1,
          padding: 3,
          apply_changes: false,
          confirm_apply: false
        }
      },
      menuName: "Custom Flow",
      runtimeAction: "preview"
    });

    expect(previewRequest?.commands[0]).toMatchObject({
      server: "cad",
      command: "cad.renumber_selected_text",
      status: "available",
      runtimeAction: "preview",
      params: {
        handles: "",
        prefix: "A-",
        suffix: "",
        startNumber: 1,
        padding: 3,
        apply: false,
        confirmApply: false
      }
    });

    const request = buildFlowNodeExecutionRequest({
      node: {
        ...tool!,
        nodeId: "node-cad-renumber",
        x: 0,
        y: 0,
        settingsValues: {
          prefix: "A-",
          suffix: "",
          start_number: 1,
          padding: 3,
          apply_changes: false,
          confirm_apply: false
        }
      },
      menuName: "Custom Flow",
      runtimeAction: "apply"
    });

    expect(request).toMatchObject({
      requiredServers: ["cad"],
      commands: [
        {
          server: "cad",
          command: "cad.renumber_selected_text",
          status: "available",
          params: {
            handles: "",
            prefix: "A-",
            suffix: "",
            startNumber: 1,
            padding: 3,
            apply: true,
            confirmApply: true
          }
        }
      ]
    });
  });

  it("passes CAD object handles from the previous node into renumber commands", () => {
    const tool = flowToolPalette.find((item) => item.id === "cad-renumber-selected-text");
    expect(tool).toBeDefined();

    const request = buildFlowNodeExecutionRequest({
      node: {
        ...tool!,
        nodeId: "node-cad-renumber",
        x: 0,
        y: 0,
        settingsValues: {
          prefix: "A-",
          suffix: "",
          start_number: 1,
          padding: 3
        }
      },
      menuName: "Custom Flow",
      runtimeAction: "preview",
      inputResults: {
        "cad-source": {
          rows: [
            { handle: "7F", layer: "0" },
            { handle: "80", layer: "0" }
          ]
        }
      }
    });

    expect(request?.commands[0].params.handles).toEqual(["7F", "80"]);
  });

  it("normalizes MCP results so downstream nodes receive the real payload", () => {
    expect(flowResultPayload({ status: "completed", message: "", raw: { mcp: { ok: true, data: [1] } } })).toEqual({
      ok: true,
      data: [1]
    });
    expect(flowResultPayload({ status: "completed", message: "", raw: { result: { rows: [] } } })).toEqual({
      rows: []
    });
    expect(flowResultPayload({ status: "completed", message: "완료" })).toEqual({ message: "완료" });
  });

  it("continues after a node failure only when the node failure policy allows keeping successes", () => {
    const [cadNode] = defaultFlowNodes();

    expect(shouldContinueAfterFlowNodeFailure(cadNode)).toBe(false);
    expect(
      shouldContinueAfterFlowNodeFailure({
        ...cadNode,
        settingsSchema: {
          ...cadNode.settingsSchema!,
          failurePolicy: { partialSuccess: "keep-success", rollback: "none", log: true }
        }
      })
    ).toBe(true);
  });

  it("creates pass-through payloads for non-MCP helper nodes", () => {
    expect(
      syntheticFlowNodeResult(
        {
          nodeId: "preview-1",
          id: "basic-result-preview",
          programIcon: "preview",
          name: "결과 미리보기",
          description: "",
          inputs: [],
          outputs: [],
          x: 0,
          y: 0
        },
        { result: { rows: [1] } }
      )
    ).toEqual({ rows: [1] });

    expect(
      syntheticFlowNodeResult(
        {
          nodeId: "prompt-1",
          id: "basic-custom-prompt",
          programIcon: "promptDetached",
          name: "프롬프트",
          description: "",
          inputs: [],
          outputs: [],
          promptText: "레이어별로 요약",
          x: 0,
          y: 0
        },
        {}
      )
    ).toEqual({ prompt: "레이어별로 요약" });
  });
});
