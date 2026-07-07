import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, MouseEvent, PointerEvent, WheelEvent } from "react";
import { useLayoutEffect } from "react";
import * as React from "react";
import type { McpServerRecord, McpTarget, RegistryFile } from "@mcp-registry/shared";
import { getConnectionSummary } from "./connectionSummary";
import { getToolsForWorkspace } from "./mcpToolCatalog";
import {
  colorModeOptions,
  settingsSections,
  type ColorMode,
  type SettingsSectionId
} from "./settingsDialog";
import {
  getDefaultSubmenuItemsForSection,
  overviewCards,
  shouldShowSubmenuAddButton,
  sidebarSections,
  type SidebarSectionId
} from "./navigationModel";
import {
  closeTab,
  createBlankTab,
  createSectionTab,
  duplicateTab,
  getPinnedTabs,
  moveTab,
  moveTabToEnd,
  togglePinnedTab,
  type TabSidebarSource,
  type TabDropPosition,
  type AppTab
} from "./tabModel";
import { getHiddenTabIds } from "./tabOverflow";
import {
  filterServersByWorkspace,
  registryWorkspaceTab,
  workspaceTabs,
  type WorkspaceTabId
} from "./workspaceTabs";
import { PanelHeader } from "./panelHeader";
import { MonitorView } from "./MonitorView";
import {
  createServerDraft,
  getSelectedServerId,
  serverDraftFromRecord,
  type ServerDraft
} from "./registryEditor";
import { AppIcon, type AppIconName } from "./uiIcons";
import {
  createAppNotification,
  type AppNotificationInput,
  type AppNotificationItem
} from "./appNotificationModel";
import { isNewerVersion, shouldRequireSharedToolReview } from "./toolSharingPolicy";
import { canEditSubmenuHeader } from "./submenuEditPolicy";
import {
  cloneStoredFlowGraph,
  createSavedFlow,
  duplicateSavedFlow,
  isStoredFlowGraphDirty,
  listWorkflowMenuFlowItems,
  listSavedFlows,
  loadSharedFlows,
  loadSavedFlows,
  parseDraggedSavedFlow,
  parseWorkflowMenuFlowId,
  removeSavedFlow,
  sampleSharedFlows,
  saveSharedFlows,
  saveSavedFlows,
  serializeSavedFlowForDrag,
  upsertSharedFlow,
  updateSavedFlowDetails,
  updateSavedFlowGraph,
  workflowMenuFlowId,
  type SavedCustomFlow
} from "./customFlowLibrary";
import {
  cloneSettingValues,
  createSettingPreset,
  listSettingPresetsForTool,
  loadSettingPresets,
  removeSettingPreset,
  renameSettingPreset,
  saveSettingPresets,
  upsertSettingPreset,
  type SettingPreset
} from "./settingPresetModel";
import {
  canAutoPersistCustomFlowGraph,
  canSaveCustomFlowFromShortcut
} from "./customFlowShortcut";
import {
  cloneFlowTool,
  applyFlowNodeDrag,
  customFlowGraphStorageKey,
  defaultFlowConnections,
  defaultFlowNodePosition,
  defaultFlowNodes,
  flowConnectionEndpoint,
  flowNodeDisplayIconName,
  flowNodeWidth,
  flowPortIconName,
  flowToolIdFromMenuItem,
  flowToolPalette,
  insertStoredFlowGraphAsGroup,
  isFlowTypeCompatible,
  loadStoredFlowGraph,
  normalizeStoredBasicFlowNode,
  parseDraggedFlowTool,
  removeNodeIdsFromFlowGroups,
  serializeFlowToolForDrag,
  withActiveFileOutputPort,
  type FlowConnection,
  type FlowActiveFileSelection,
  type FlowGroup,
  type FlowNote,
  type FlowNode,
  type FlowPort,
  type FlowPortType,
  type FlowSnapshot,
  type FlowTool,
  type StoredFlowGraph
} from "./customFlowModel";
import {
  calculateSmartGuideSnap,
  type SmartGuideLine,
  type SmartGuideRect
} from "./customFlowSmartGuides";
import {
  buildFlowGroupToolSchema,
  buildFlowRunRecords,
  resolveFlowRunNodeIds,
  type FlowRunRecord,
  type FlowRunScope
} from "./customFlowRunModel";
import { validateFlowGraph, type FlowValidationIssue } from "./customFlowValidation";
import {
  defaultToolRuntimeSchema,
  defaultSettingOptions,
  isSelectLikeSetting,
  settingDefaultValue,
  type ToolRuntimeSchema,
  type ToolSettingField,
  type ToolSettingValue
} from "./toolSettingsSchema";
import { buildToolPreviewSummary } from "./toolActionPreview";
import {
  buildToolExecutionRequest,
  type TitleBlockCandidate
} from "./toolExecutionModel";
import { openAiToolRunnerDefaultModel } from "./openAiToolRunner";
import type { OpenAiSettingsStatus } from "./openAiSettings";
import {
  buildToolExecutionPlan,
  validateToolRuntimeSchema,
  validateToolSettingsValues,
  type ToolRuntimeIssue
} from "./toolRuntimeValidation";
import {
  emptyProcessSnapshot,
  type ProcessSnapshot,
  type ServerProcessResult
} from "./processMonitor";

function normalizeToolRuntimeSchemaForRender(schema: ToolRuntimeSchema): ToolRuntimeSchema {
  return {
    ...defaultToolRuntimeSchema,
    ...schema,
    requiredServers: schema.requiredServers ?? [],
    mcpCommands: schema.mcpCommands ?? [],
    preflightChecks: schema.preflightChecks ?? [],
    resultSchema: {
      ...defaultToolRuntimeSchema.resultSchema,
      ...(schema.resultSchema ?? {}),
      fields: schema.resultSchema?.fields ?? []
    },
    failurePolicy: {
      ...defaultToolRuntimeSchema.failurePolicy,
      ...(schema.failurePolicy ?? {})
    },
    settingsLayout: {
      ...defaultToolRuntimeSchema.settingsLayout,
      ...(schema.settingsLayout ?? {}),
      sections: schema.settingsLayout?.sections ?? []
    },
    settings: schema.settings ?? [],
    actions: schema.actions ?? [],
    inputs: schema.inputs ?? [],
    outputs: schema.outputs ?? [],
    testCases: schema.testCases ?? []
  };
}

const flowGroupColorOptions = [
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#fb7185",
  "#22d3ee",
  "#94a3b8",
  "#f97316",
  "#84cc16"
];
const flowNoteColorOptions = [
  "#fff7c7",
  "#dff7ff",
  "#e8f8e8",
  "#f3e8ff",
  "#ffe4e6",
  "#f1f5f9",
  "#ffedd5",
  "#dcfce7",
  "#e0e7ff",
  "#fef3c7"
];
const flowBasicTools: FlowTool[] = [
  {
    id: "basic-excel-export",
    programIcon: "excel",
    name: "Excel 내보내기",
    description: "앞 노드의 결과값을 Excel 표 형식으로 정리합니다.",
    inputs: [{ id: "objects", label: "객체", type: "object", iconName: "objectData" }],
    outputs: [{ id: "excel-file", label: "Excel", type: "excel", iconName: "excel" }]
  },
  {
    id: "basic-result-preview",
    programIcon: "preview",
    name: "결과 미리보기",
    description: "앞 노드의 결과를 이 노드 안에서 바로 확인합니다.",
    inputs: [{ id: "result", label: "결과", type: "any", iconName: "customTools" }],
    outputs: []
  },
  {
    id: "basic-path-select",
    programIcon: "folder",
    name: "경로 지정",
    description: "파일이나 폴더 경로를 다음 노드 입력값으로 전달합니다.",
    inputs: [],
    outputs: [{ id: "path", label: "경로", type: "text", iconName: "textData" }]
  },
  {
    id: "basic-active-file",
    programIcon: "activeFileUnknown",
    name: "활성 파일",
    description: "CAD, Excel, Revit처럼 현재 열려 있는 파일을 입력값으로 사용합니다.",
    inputs: [],
    outputs: [{ id: "active-file", label: "활성 파일", type: "file", iconName: "activeFileUnknown" }]
  },
  {
    id: "basic-custom-prompt",
    programIcon: "promptDetached",
    name: "프롬프트",
    description: "노드 아래에 붙여 실행 프롬프트에 문장을 추가합니다.",
    inputs: [],
    outputs: []
  }
];

const detectedActiveFileOptions: Array<{
  id: string;
  label: string;
  program: "cad" | "revit" | "excel" | "tekla";
  path: string;
}> = [
  { id: "active-cad", label: "CAD", program: "cad", path: "새로고침하면 현재 CAD 도면명을 확인합니다." },
  { id: "active-revit", label: "Revit", program: "revit", path: "새로고침하면 현재 Revit 모델명을 확인합니다." },
  { id: "active-excel", label: "Excel", program: "excel", path: "현재 열려 있는 Excel 파일을 입력값으로 사용합니다." },
  { id: "active-tekla", label: "Tekla", program: "tekla", path: "현재 열려 있는 Tekla 모델을 입력값으로 사용합니다." }
];

function mergeActiveFileOptions(
  baseOptions: FlowActiveFileSelection[],
  detectedFiles: FlowActiveFileSelection[]
) {
  const merged = new Map(baseOptions.map((option) => [option.id, option]));
  detectedFiles.forEach((file) => {
    merged.set(file.id, file);
  });
  return [...merged.values()];
}

function syncActiveFileSelections(
  selections: FlowActiveFileSelection[] | undefined,
  options: FlowActiveFileSelection[]
) {
  if (!selections?.length) {
    return selections;
  }

  return selections.map((selection) =>
    options.find((option) => option.id === selection.id) ?? selection
  );
}

type FlowBasicPortDirection = "input" | "output" | "both";
type FlowBasicPortFilter = "all" | "common" | "cad" | "revit" | "excel" | "tekla";
type FlowNodeDetailTab = "content" | "settings" | "result";

const flowBasicPortTools: Array<{
  id: string;
  direction: FlowBasicPortDirection;
  label: string;
  type: FlowPortType;
  description: string;
  programScope: string;
}> = [
  { id: "text", direction: "both", label: "텍스트", type: "text", programScope: "모든 프로그램", description: "텍스트 값을 입력 또는 출력 포트로 추가합니다." },
  { id: "number", direction: "both", label: "숫자", type: "number", programScope: "모든 프로그램", description: "길이, 개수, 높이 같은 숫자 값을 주고받습니다." },
  { id: "coordinate", direction: "both", label: "좌표", type: "coordinate", programScope: "CAD/Revit/Tekla", description: "X/Y/Z 위치값이나 기준점을 주고받습니다." },
  { id: "object", direction: "both", label: "객체", type: "object", programScope: "CAD/Revit/Tekla", description: "CAD 객체, Revit 요소, Tekla 부재 같은 대상을 주고받습니다." },
  { id: "table", direction: "both", label: "테이블", type: "table", programScope: "Excel", description: "Excel 표나 행/열 데이터 묶음을 주고받습니다." },
  { id: "file", direction: "both", label: "파일", type: "file", programScope: "모든 프로그램", description: "파일 경로나 파일 결과물을 주고받습니다." },
  { id: "folder", direction: "both", label: "폴더", type: "file", programScope: "모든 프로그램", description: "폴더 경로나 저장 위치를 주고받습니다." },
  { id: "boolean", direction: "both", label: "참/거짓", type: "boolean", programScope: "모든 프로그램", description: "실행 옵션, 필터 조건 같은 선택값을 주고받습니다." },
  { id: "active-file", direction: "input", label: "활성파일", type: "file", programScope: "CAD/Revit/Excel/Tekla", description: "현재 열린 파일을 받을 입력 포트를 추가합니다." },
  { id: "selected-element", direction: "input", label: "선택 요소", type: "object", programScope: "CAD/Revit/Tekla", description: "현재 프로그램에서 선택한 객체나 요소를 입력으로 받습니다." },
  { id: "result", direction: "output", label: "결과", type: "any", programScope: "모든 프로그램", description: "다음 노드로 보낼 범용 결과 출력 포트를 추가합니다." },
  { id: "log", direction: "output", label: "로그", type: "text", programScope: "모든 프로그램", description: "실행 로그나 처리 메시지를 출력합니다." },
  { id: "error", direction: "output", label: "오류", type: "text", programScope: "모든 프로그램", description: "오류 메시지나 실패 사유를 출력합니다." },
  { id: "report", direction: "output", label: "리포트", type: "file", programScope: "모든 프로그램", description: "검토서, 엑셀, PDF 같은 결과 파일을 출력합니다." }
];

type FlowBasicPortTool = (typeof flowBasicPortTools)[number];

const flowBasicPortFilters: Array<{ id: FlowBasicPortFilter; label: string }> = [
  { id: "all", label: "전체" },
  { id: "common", label: "공용" },
  { id: "cad", label: "CAD" },
  { id: "revit", label: "Revit" },
  { id: "excel", label: "Excel" },
  { id: "tekla", label: "Tekla" }
];

function flowBasicPortToolMatchesFilter(tool: FlowBasicPortTool, filter: FlowBasicPortFilter) {
  const scope = tool.programScope.toLowerCase();
  if (filter === "all") {
    return true;
  }
  if (filter === "common") {
    return scope.includes("모든") || scope.includes("all");
  }
  return scope.includes("모든") || scope.includes(filter);
}

const flowRunScopeLabels: Record<FlowRunScope, string> = {
  all: "전체 흐름",
  selected: "선택 노드만",
  "to-selected": "선택 노드까지",
  "from-selected": "선택 노드부터"
};

const flowRunStatusLabels: Record<FlowRunRecord["status"], string> = {
  queued: "대기",
  running: "실행 중",
  success: "완료",
  warning: "경고",
  error: "오류"
};

const pinnedTabsStorageKey = "mcp-registry:pinned-tabs";
const favoriteSectionsStorageKey = "mcp-registry:favorite-sections";
const favoriteSubmenusStorageKey = "mcp-registry:favorite-submenus";
const recentSubmenusStorageKey = "mcp-registry:recent-submenus";
const sidebarOrderStorageKey = "mcp-registry:sidebar-order";
const submenuOrderStorageKey = "mcp-registry:submenu-order";
const customSubmenusStorageKey = "mcp-registry:custom-submenus";
const submenuMetaStorageKey = "mcp-registry:submenu-meta";
const customToolsStorageKey = "mcp-registry:custom-tools";
const deletedGithubToolPathsStorageKey = "mcp-registry:deleted-github-tool-paths";
const accountUsersStorageKey = "mcp-registry:account-users";
const accountPolicyStorageKey = "mcp-registry:account-policy";

const flowTypePalette: Record<
  FlowPortType | "tekla",
  { accent: string; border: string; surface: string; group: string }
> = {
  cad: { accent: "#dc2626", border: "#f3b4b4", surface: "#fff1f2", group: "#fecdd3" },
  revit: { accent: "#2563eb", border: "#b6ccf6", surface: "#eff6ff", group: "#bfdbfe" },
  excel: { accent: "#16803c", border: "#acd8bd", surface: "#eefbf3", group: "#bbf7d0" },
  tekla: { accent: "#7c3aed", border: "#cfbdfd", surface: "#f5f3ff", group: "#ddd6fe" },
  object: { accent: "#d97706", border: "#f1cf9a", surface: "#fff7ed", group: "#fed7aa" },
  number: { accent: "#0891b2", border: "#a5ddea", surface: "#ecfeff", group: "#a5f3fc" },
  text: { accent: "#475569", border: "#cbd5e1", surface: "#f8fafc", group: "#e2e8f0" },
  coordinate: { accent: "#0d9488", border: "#99f6e4", surface: "#f0fdfa", group: "#99f6e4" },
  table: { accent: "#15803d", border: "#bbf7d0", surface: "#f0fdf4", group: "#bbf7d0" },
  file: { accent: "#7c2d12", border: "#fed7aa", surface: "#fff7ed", group: "#fed7aa" },
  boolean: { accent: "#9333ea", border: "#d8b4fe", surface: "#faf5ff", group: "#e9d5ff" },
  any: { accent: "#4f7fbd", border: "#bfd4ed", surface: "#f6faff", group: "#bfdbfe" }
};

const flowPaletteForType = (type?: FlowPortType | "tekla") =>
  flowTypePalette[type ?? "any"] ?? flowTypePalette.any;

const flowBasicNodePalette = {
  accent: "#64748b",
  border: "#d5dde8",
  surface: "#f8fafc",
  group: "#e2e8f0"
};

const flowTypeForNode = (node: FlowNode): FlowPortType | "tekla" => {
  if (node.programIcon === "tekla") {
    return "tekla";
  }

  const iconType = node.programIcon as FlowPortType;
  if (iconType in flowTypePalette) {
    return iconType;
  }

  return node.outputs[0]?.type ?? node.inputs[0]?.type ?? "any";
};

const isBasicFlowNode = (node: FlowNode) => node.id.startsWith("basic-");

const flowConnectionColor = (
  fromNode: FlowNode,
  outputPort?: FlowPort
) => flowPaletteForType(outputPort?.type ?? flowTypeForNode(fromNode)).accent;
const licenseNoticeStorageKey = "mcp-registry:license-notices";
const sidebarWidthStorageKey = "mcp-registry:sidebar-width";
const browserRegistryStorageKey = "mcp-registry:browser-registry";
const minSidebarWidth = 212;
const maxSidebarWidth = 360;
const appVersion = "v0.1.0";
const githubToolSource = {
  owner: "kdg200121-hash",
  repo: "AI_PROGRAM",
  path: "tools"
};
const githubToolPathPrefix = `github:${githubToolSource.owner}/${githubToolSource.repo}/${githubToolSource.path}/`;
let tabCounter = 0;

type SubmenuId = string;
type SubmenuKey = `${SidebarSectionId}:${SubmenuId}`;

interface SubmenuItem {
  id: SubmenuId;
  label: string;
  description: string;
  settingsSchema?: ToolRuntimeSchema;
}

interface CustomToolItem {
  id: string;
  sectionId: SidebarSectionId;
  name: string;
  description: string;
  version: string;
  author: string;
  createdAt?: string;
  usageCount: number;
  pinned: boolean;
  registered: boolean;
  approvalStatus: "approved" | "pending" | "rejected";
  isToolLike: boolean;
  riskWarnings: string[];
  toolSchema?: ToolRuntimeSchema;
  sourcePath?: string;
  installedPath?: string;
  reviewUrl?: string;
  reviewNumber?: number;
  reviewState?: "open" | "closed" | "merged";
  versions?: CustomToolVersion[];
}

interface CustomToolVersion {
  id: string;
  version: string;
  author: string;
  description: string;
  sourcePath: string;
  installedPath: string;
  reviewUrl?: string;
  reviewNumber?: number;
  reviewState?: "open" | "closed" | "merged";
  isToolLike: boolean;
  riskWarnings: string[];
  toolSchema?: ToolRuntimeSchema;
}

type CustomToolSortField = "section" | "name" | "version" | "author" | "usageCount";
type CustomToolFilter = "all" | "risk" | "pending";
const customToolFilterOptions: Array<{ filter: CustomToolFilter; label: string; icon: string }> = [
  { filter: "all", label: "전체", icon: "A" },
  { filter: "risk", label: "주의", icon: "!" },
  { filter: "pending", label: "대기", icon: "P" }
];
type SortDirection = "desc" | "asc";
type CustomToolFormMode = "new" | "update";
type MarketDialogTab = "tools" | "flows";
type AccountUserSortField = "githubId" | "nickname" | "status" | "license" | "joinedAt";

interface CustomToolDraft {
  mode: CustomToolFormMode;
  toolId: string;
  name: string;
  description: string;
  version: string;
  author: string;
  filePath: string;
  fileName: string;
  preview: string;
  isToolLike: boolean;
  riskWarnings: string[];
  toolSchema?: ToolRuntimeSchema;
  toolWarning: string;
  error: string;
}

interface GitHubUserProfile {
  githubId: string;
  nickname: string;
  avatarUrl?: string;
}

type AuthDialogMode = "login" | "signup" | "profile";

interface GitHubAuthDevice {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

interface AccountUser {
  githubId: string;
  nickname: string;
  role: "admin" | "user";
  license: boolean;
  licenseExpiresAt?: string;
  status: "active" | "pending";
  joinedAt: string;
}

interface AccountPolicy {
  signupMode: "open" | "approval";
  licenseMode: "all" | "licensed";
  toolRegistrationMode: "open" | "approval";
}

type SubmenuMetaMap = Partial<Record<SubmenuKey, Pick<SubmenuItem, "label" | "description">>>;

const staticSubmenuIds = ["tools", "settings", "shared-flows", "saved-flows", "add"];

function createCustomToolDraft(): CustomToolDraft {
  return {
    mode: "new",
    toolId: "",
    name: "",
    description: "",
    version: "1.0.0",
    author: githubToolSource.owner,
    filePath: "",
    fileName: "",
    preview: "",
    isToolLike: true,
    riskWarnings: [],
    toolSchema: undefined,
    toolWarning: "",
    error: ""
  };
}

function normalizeFilePath(path: string) {
  return path.replace(/\\/g, "/").toLowerCase();
}

function isFileInDirectory(filePath: string, directoryPath: string) {
  if (!filePath || !directoryPath) {
    return false;
  }

  const file = normalizeFilePath(filePath);
  const directory = normalizeFilePath(directoryPath).replace(/\/+$/, "");
  return file === directory || file.startsWith(`${directory}/`);
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}

function compareToolVersionDesc(left: string, right: string) {
  return right.localeCompare(left, "ko", { numeric: true, sensitivity: "base" });
}

type ContextMenuState =
  | { type: "section"; sectionId: SidebarSectionId; x: number; y: number }
  | {
      type: "submenu";
      sectionId: SidebarSectionId;
      submenuId: SubmenuId;
      source?: "recent";
      x: number;
      y: number;
    }
  | { type: "customTool"; toolId: string; x: number; y: number }
  | { type: "tab"; tabId: string; x: number; y: number };

type SidebarSource = TabSidebarSource;

interface NavigationState {
  sectionId: SidebarSectionId;
  title: string;
  source: SidebarSource;
  submenuKey: SubmenuKey | null;
}

interface WorkflowOpenRequest {
  requestId: number;
  graph: StoredFlowGraph;
  flowId?: string;
  source?: "shared" | "saved";
}

interface WorkflowCreateRequest {
  requestId: number;
  submenuSource: "menu" | "favorite" | "recent";
}

interface WorkflowDetailsUpdateRequest {
  requestId: number;
  flowId: string;
  patch: { name?: string; description?: string };
}

function nextTabId() {
  tabCounter += 1;
  return `tab-${Date.now()}-${tabCounter}`;
}

function loadPinnedTabs(): AppTab[] {
  try {
    const raw = window.localStorage.getItem(pinnedTabsStorageKey);
    const pinnedTabs = raw ? (JSON.parse(raw) as AppTab[]) : [];
    return pinnedTabs.length > 0 ? pinnedTabs : [createBlankTab("tab-initial")];
  } catch {
    return [createBlankTab("tab-initial")];
  }
}

function loadFavoriteSections(): SidebarSectionId[] {
  try {
    const raw = window.localStorage.getItem(favoriteSectionsStorageKey);
    return raw ? (JSON.parse(raw) as SidebarSectionId[]) : [];
  } catch {
    return [];
  }
}

function isSubmenuId(value: string): value is SubmenuId {
  return (
    staticSubmenuIds.includes(value) ||
    value.startsWith("custom-") ||
    value.startsWith("github-tool-") ||
    value.startsWith("share-") ||
    Boolean(parseWorkflowMenuFlowId(value))
  );
}

function parseSubmenuKey(key: SubmenuKey) {
  const separatorIndex = key.indexOf(":");
  const sectionId = key.slice(0, separatorIndex) as SidebarSectionId;
  const submenuId = key.slice(separatorIndex + 1) as SubmenuId;
  return { sectionId, submenuId };
}

function isSidebarSectionId(value: string): value is SidebarSectionId {
  return sidebarSections.some((section) => section.id === value);
}

function makeSubmenuKey(sectionId: SidebarSectionId, submenuId: SubmenuId): SubmenuKey {
  return `${sectionId}:${submenuId}`;
}

function isValidSubmenuKey(value: string): value is SubmenuKey {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex <= 0) {
    return false;
  }
  const sectionId = value.slice(0, separatorIndex);
  const submenuId = value.slice(separatorIndex + 1);
  return sidebarSections.some((section) => section.id === sectionId) && isSubmenuId(submenuId);
}

function loadFavoriteSubmenus(): SubmenuKey[] {
  try {
    const raw = window.localStorage.getItem(favoriteSubmenusStorageKey);
    const keys = raw ? (JSON.parse(raw) as string[]) : [];
    return keys.filter(isValidSubmenuKey);
  } catch {
    return [];
  }
}

function loadRecentSubmenus(): SubmenuKey[] {
  try {
    const raw = window.localStorage.getItem(recentSubmenusStorageKey);
    const keys = raw ? (JSON.parse(raw) as string[]) : [];
    return keys.filter(isValidSubmenuKey).slice(0, 3);
  } catch {
    return [];
  }
}

function normalizeSubmenuItem(item: Partial<SubmenuItem>): SubmenuItem | null {
  if (!item.id || item.id === "add" || !item.label) {
    return null;
  }

  return {
    id: item.id,
    label: item.label,
    description: item.description ?? ""
  };
}

function loadCustomSubmenus(): Partial<Record<SidebarSectionId, SubmenuItem[]>> {
  try {
    const raw = window.localStorage.getItem(customSubmenusStorageKey);
    const saved = raw ? (JSON.parse(raw) as Partial<Record<SidebarSectionId, SubmenuItem[]>>) : {};
    return Object.fromEntries(
      sidebarSections.map((section) => [
        section.id,
        (saved[section.id] ?? [])
          .map((item) => normalizeSubmenuItem(item))
          .filter((item): item is SubmenuItem => Boolean(item))
      ])
    ) as Partial<Record<SidebarSectionId, SubmenuItem[]>>;
  } catch {
    return {};
  }
}

function loadSubmenuMeta(): SubmenuMetaMap {
  try {
    const raw = window.localStorage.getItem(submenuMetaStorageKey);
    const saved = raw ? (JSON.parse(raw) as SubmenuMetaMap) : {};
    return Object.fromEntries(
      Object.entries(saved).filter(([key, value]) => {
        if (!isValidSubmenuKey(key) || !value) {
          return false;
        }

        return typeof value.label === "string" && typeof value.description === "string";
      })
    ) as SubmenuMetaMap;
  } catch {
    return {};
  }
}

function loadCustomTools(): CustomToolItem[] {
  try {
    const raw = window.localStorage.getItem(customToolsStorageKey);
    const saved = raw ? (JSON.parse(raw) as Partial<CustomToolItem>[]) : [];
    return saved
      .filter((tool) => tool.id && tool.name)
      .filter(
        (tool) =>
          String(tool.installedPath ?? "").startsWith(githubToolPathPrefix) ||
          String(tool.sourcePath ?? "").startsWith(githubToolPathPrefix)
      )
      .map((tool) => ({
        id: String(tool.id),
        sectionId: isSidebarSectionId(String(tool.sectionId ?? "servers"))
          ? (tool.sectionId as SidebarSectionId)
          : "servers",
        name: String(tool.name),
        description: String(tool.description ?? ""),
        version: String(tool.version ?? "1.0.0"),
        author: String(tool.author ?? "Unknown"),
        createdAt: tool.createdAt ? String(tool.createdAt) : undefined,
        usageCount: 0,
        pinned: Boolean(tool.pinned ?? (tool as { favorite?: unknown }).favorite),
        registered: Boolean(tool.registered ?? true),
        approvalStatus:
          tool.approvalStatus === "pending" || tool.approvalStatus === "rejected"
            ? tool.approvalStatus
            : "approved",
        isToolLike: Boolean(tool.isToolLike ?? true),
        riskWarnings: Array.isArray(tool.riskWarnings)
          ? tool.riskWarnings.map(String)
          : [],
        toolSchema:
          tool.toolSchema && typeof tool.toolSchema === "object"
            ? (tool.toolSchema as ToolRuntimeSchema)
            : undefined,
        sourcePath: tool.sourcePath ? String(tool.sourcePath) : undefined,
        installedPath: tool.installedPath ? String(tool.installedPath) : undefined,
        reviewUrl: tool.reviewUrl ? String(tool.reviewUrl) : undefined,
        reviewNumber: Number(tool.reviewNumber ?? 0),
        reviewState:
          tool.reviewState === "closed" || tool.reviewState === "merged" ? tool.reviewState : "open",
        versions: Array.isArray(tool.versions)
          ? tool.versions
              .filter((version) => version && version.version)
              .map((version) => ({
                id: String(version.id ?? `${tool.name}-${version.version}`),
                version: String(version.version),
                author: String(version.author ?? tool.author ?? "Unknown"),
                description: String(version.description ?? tool.description ?? ""),
                sourcePath: String(version.sourcePath ?? tool.sourcePath ?? ""),
                installedPath: String(version.installedPath ?? tool.installedPath ?? ""),
                reviewUrl: version.reviewUrl ? String(version.reviewUrl) : undefined,
                reviewNumber: Number(version.reviewNumber ?? tool.reviewNumber ?? 0),
                reviewState:
                  version.reviewState === "closed" || version.reviewState === "merged"
                    ? version.reviewState
                    : "open",
                isToolLike: Boolean(version.isToolLike ?? tool.isToolLike ?? true),
                riskWarnings: Array.isArray(version.riskWarnings)
                  ? version.riskWarnings.map(String)
                  : [],
                toolSchema:
                  version.toolSchema && typeof version.toolSchema === "object"
                    ? (version.toolSchema as ToolRuntimeSchema)
                    : tool.toolSchema && typeof tool.toolSchema === "object"
                      ? (tool.toolSchema as ToolRuntimeSchema)
                      : undefined
              }))
          : undefined
      }));
  } catch {
    return [];
  }
}

function loadDeletedGithubToolPaths() {
  try {
    const raw = window.localStorage.getItem(deletedGithubToolPathsStorageKey);
    const paths = raw ? (JSON.parse(raw) as string[]) : [];
    return paths.filter((path): path is string => typeof path === "string" && path.startsWith("github:"));
  } catch {
    return [];
  }
}

function loadAccountPolicy(): AccountPolicy {
  try {
    const raw = window.localStorage.getItem(accountPolicyStorageKey);
    const saved = raw ? (JSON.parse(raw) as Partial<AccountPolicy>) : {};
    return {
      signupMode: saved.signupMode === "approval" ? "approval" : "open",
      licenseMode: saved.licenseMode === "licensed" ? "licensed" : "all",
      toolRegistrationMode: saved.toolRegistrationMode === "approval" ? "approval" : "open"
    };
  } catch {
    return { signupMode: "open", licenseMode: "all", toolRegistrationMode: "open" };
  }
}

function loadAccountUsers(): AccountUser[] {
  try {
    const raw = window.localStorage.getItem(accountUsersStorageKey);
    const saved = raw ? (JSON.parse(raw) as Partial<AccountUser>[]) : [];
    const normalized = saved
      .filter((user) => user.githubId && user.nickname)
      .map((user) => ({
        githubId: String(user.githubId),
        nickname: String(user.nickname),
        role: user.githubId === githubToolSource.owner || user.role === "admin" ? "admin" : "user",
        license: Boolean(user.license),
        licenseExpiresAt: user.licenseExpiresAt ? String(user.licenseExpiresAt) : undefined,
        status: user.status === "pending" ? "pending" : "active",
        joinedAt: String(user.joinedAt ?? new Date().toISOString())
      })) as AccountUser[];

    return normalized.some((user) => user.githubId === githubToolSource.owner)
      ? normalized
      : [
          {
            githubId: githubToolSource.owner,
            nickname: githubToolSource.owner,
            role: "admin",
            license: true,
            licenseExpiresAt: undefined,
            status: "active",
            joinedAt: new Date().toISOString()
          },
          ...normalized
        ];
  } catch {
    return [
      {
        githubId: githubToolSource.owner,
        nickname: githubToolSource.owner,
        role: "admin",
        license: true,
        licenseExpiresAt: undefined,
        status: "active",
        joinedAt: new Date().toISOString()
      }
    ];
  }
}

function loadSidebarOrder(): SidebarSectionId[] {
  try {
    const raw = window.localStorage.getItem(sidebarOrderStorageKey);
    const savedOrder = raw ? (JSON.parse(raw) as SidebarSectionId[]) : [];
    const validIds = sidebarSections.map((section) => section.id);
    return [
      ...savedOrder.filter((id) => validIds.includes(id)),
      ...validIds.filter((id) => !savedOrder.includes(id))
    ];
  } catch {
    return sidebarSections.map((section) => section.id);
  }
}

function loadSubmenuOrder(): Partial<Record<SidebarSectionId, SubmenuId[]>> {
  try {
    const raw = window.localStorage.getItem(submenuOrderStorageKey);
    const savedOrder = raw ? (JSON.parse(raw) as Partial<Record<SidebarSectionId, SubmenuId[]>>) : {};
    return Object.fromEntries(
      sidebarSections.map((section) => [
        section.id,
        (savedOrder[section.id] ?? []).filter((id) => isSubmenuId(id) && id !== "add")
      ])
    ) as Partial<Record<SidebarSectionId, SubmenuId[]>>;
  } catch {
    return {};
  }
}

function loadSidebarWidth() {
  try {
    const raw = window.localStorage.getItem(sidebarWidthStorageKey);
    const width = raw ? Number(raw) : 248;
    return Math.min(maxSidebarWidth, Math.max(minSidebarWidth, width));
  } catch {
    return 248;
  }
}

function sidebarLabel(sectionId: SidebarSectionId) {
  if (sectionId === "home") {
    return "Home";
  }

  if (sectionId === "monitor") {
    return "Monitor";
  }

  return sidebarSections.find((section) => section.id === sectionId)?.label ?? "Unknown";
}

function workspaceForSection(sectionId: SidebarSectionId): WorkspaceTabId {
  if (sectionId === "revit") {
    return "revit";
  }

  if (sectionId === "excel") {
    return "excel";
  }

  if (sectionId === "tekla") {
    return "tekla";
  }

  if (sectionId === "workflow") {
    return "workflow";
  }

  return "cad";
}

function connectionScopeForPage(sectionId: SidebarSectionId, tabId: WorkspaceTabId) {
  if (tabId === "registry" || sectionId === "monitor" || sectionId === "home") {
    return { label: "MCP", targets: null };
  }

  if (sectionId === "workflow") {
    return { label: "MCP", targets: ["cad", "revit", "excel"] as McpTarget[] };
  }

  if (sectionId === "revit") {
    return { label: "Revit MCP", targets: ["revit"] as McpTarget[] };
  }

  if (sectionId === "servers") {
    return { label: "CAD MCP", targets: ["cad"] as McpTarget[] };
  }

  if (sectionId === "excel") {
    return { label: "Excel MCP", targets: ["excel"] as McpTarget[] };
  }

  if (sectionId === "tekla") {
    return { label: "Tekla MCP", targets: ["tekla"] as McpTarget[] };
  }

  return { label: `${sidebarLabel(sectionId)} MCP`, targets: ["other"] as McpTarget[] };
}

function requiredMcpTargetsForSection(sectionId: SidebarSectionId): McpTarget[] | null {
  if (sectionId === "workflow") {
    return ["cad", "revit", "excel"];
  }

  if (sectionId === "revit") {
    return ["revit"];
  }

  if (sectionId === "servers") {
    return ["cad"];
  }

  if (sectionId === "excel") {
    return ["excel"];
  }

  if (sectionId === "tekla") {
    return ["tekla"];
  }

  return null;
}

function isMcpReadyForSection(sectionId: SidebarSectionId, servers: McpServerRecord[]) {
  const targets = requiredMcpTargetsForSection(sectionId);
  if (!targets) {
    return true;
  }

  return targets.every((target) =>
    servers.some((server) => server.target === target && server.status === "running")
  );
}

function mcpHealthCheckUrls(server: McpServerRecord) {
  const urls: string[] = [];
  try {
    const baseUrl = new URL(server.url);
    urls.push(baseUrl.toString());
    const statusUrl = new URL(baseUrl.toString());
    statusUrl.pathname = "/status";
    statusUrl.search = "";
    urls.push(statusUrl.toString());
    const activeFileUrl = new URL(baseUrl.toString());
    activeFileUrl.pathname = "/active-file";
    activeFileUrl.search = "";
    urls.push(activeFileUrl.toString());
  } catch {
    if (server.port) {
      urls.push(`http://localhost:${server.port}/status`);
      urls.push(`http://localhost:${server.port}/mcp`);
    }
  }

  return Array.from(new Set(urls));
}

function disabledToolReason(sectionId: SidebarSectionId) {
  const targets = requiredMcpTargetsForSection(sectionId);
  if (!targets) {
    return "";
  }

  const label = targets.map((target) => targetLabel(target)).join(", ");
  return `${label} MCP 서버가 연결되어 있지 않아 실행할 수 없습니다.`;
}

function defaultSubmenuLabel(_sectionId: SidebarSectionId) {
    return "메인페이지";
}

function tabMenuLabel(tab: AppTab) {
  if (tab.workspaceTabId === "registry") {
    return registryWorkspaceTab.label;
  }

  return sidebarLabel(tab.sectionId);
}

function tabSubmenuLabel(tab: AppTab) {
  if (tab.title === "새 탭") {
    return "새 탭";
  }

  if (tab.workspaceTabId === "registry" && tab.sectionId === "servers") {
    return "MCP 서버";
  }

  if (tab.title !== sidebarLabel(tab.sectionId)) {
    return tab.title;
  }

  return defaultSubmenuLabel(tab.sectionId);
}

function PopoutIcon() {
  return (
    <svg
      className="dialogWindowIcon"
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path d="M6 4H12V10" />
      <path d="M12 4L5 11" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className="dialogWindowIcon"
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path d="M4.5 4.5L11.5 11.5" />
      <path d="M11.5 4.5L4.5 11.5" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      className="dialogWindowIcon"
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path d="M12.5 6.2A4.6 4.6 0 0 0 4.2 4.1L3 5.4" />
      <path d="M3 2.2V5.4H6.2" />
      <path d="M3.5 9.8A4.6 4.6 0 0 0 11.8 11.9L13 10.6" />
      <path d="M13 13.8V10.6H9.8" />
    </svg>
  );
}

function SidebarIcon({ sectionId }: { sectionId: SidebarSectionId }) {
  const iconNames: Record<SidebarSectionId, AppIconName> = {
    home: "home",
    servers: "cad",
    revit: "revit",
    workflow: "workflow",
    monitor: "monitor",
    excel: "excel",
    tekla: "tekla"
  };
  return <AppIcon name={iconNames[sectionId]} className={`navIcon navIcon-${sectionId}`} />;
}

function submenuIconName(submenuId: SubmenuId): AppIconName {
  const workflowFlow = parseWorkflowMenuFlowId(submenuId);
  if (workflowFlow?.source === "saved") {
    return "customTools";
  }
  if (workflowFlow) {
    return "workflow";
  }
  return submenuId.startsWith("custom-tool-") || submenuId.startsWith("github-tool-")
    ? "customTools"
    : "shareTools";
}

const fallbackRegistry: RegistryFile = {
  version: 1,
  servers: [
    {
      id: "revit-default",
      name: "Revit MCP 브리지",
      target: "revit",
      connectionType: "http",
      url: "http://localhost:5001/mcp",
      port: 5001,
      launchCommand: "revit-mcp-bridge.exe",
      workingDirectory: "C:\\Tools\\RevitMcpBridge",
      environment: {},
      status: "unknown",
      notes: "Revit 연결 자리입니다. 이후 CAD 정보로 Revit 작업을 실행할 때 사용합니다.",
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z"
    },
    {
      id: "cad-default",
      name: "AutoCAD MCP 브리지",
      target: "cad",
      connectionType: "http",
      url: "http://localhost:5100/mcp",
      port: 5100,
      launchCommand: "acad-mcp-server.exe",
      workingDirectory: "C:\\Tools\\AutoCadMcpBridge",
      environment: {},
      status: "unknown",
      notes: "CAD 연결 자리입니다. 화면 정보를 읽는 기능은 이후 단계에서 연결합니다.",
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z"
    }
  ]
};

function loadInitialRegistry(): RegistryFile {
  try {
    const raw = window.localStorage.getItem(browserRegistryStorageKey);
    return raw ? (JSON.parse(raw) as RegistryFile) : fallbackRegistry;
  } catch {
    return fallbackRegistry;
  }
}

class WorkflowErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error) {
    const message = error.message || "알 수 없는 화면 오류가 발생했습니다.";
    if (message.includes("invariant=185") || message.includes("#185")) {
      return {
        errorMessage:
          "화면 상태가 반복해서 갱신되는 오류가 발생했습니다. 화면 새로고침 후에도 반복되면 마지막으로 이동한 노드나 연결 상태를 알려주세요."
      };
    }

    return { errorMessage: message };
  }

  componentDidCatch(error: Error) {
    console.error("Custom Flow render error", error);
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <section className="workflowErrorPanel">
          <strong>Custom Flow 화면 오류</strong>
          <span>{this.state.errorMessage}</span>
          <button type="button" onClick={() => window.location.reload()}>
            화면 새로고침
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}

function areFlowValidationIssuesEqual(
  first: FlowValidationIssue[],
  second: FlowValidationIssue[]
) {
  return (
    first.length === second.length &&
    first.every((issue, index) => {
      const other = second[index];
      return (
        other &&
        issue.id === other.id &&
        issue.severity === other.severity &&
        issue.title === other.title &&
        issue.message === other.message &&
        issue.nodeId === other.nodeId &&
        issue.connectionId === other.connectionId
      );
    })
  );
}

export function App() {
  const [registry, setRegistry] = useState<RegistryFile>(() => loadInitialRegistry());
  const [openTabs, setOpenTabs] = useState<AppTab[]>(() => loadPinnedTabs());
  const [activeOpenTabId, setActiveOpenTabId] = useState(() => openTabs[0]?.id ?? "tab-initial");
  const tabStripRef = useRef<HTMLDivElement>(null);
  const openTabsRef = useRef<HTMLDivElement>(null);
  const storageWritesReadyRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [serverDraft, setServerDraft] = useState<ServerDraft>(() => createServerDraft("cad"));
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const [registryError, setRegistryError] = useState("");
  const [autoAddMessage, setAutoAddMessage] = useState("");
  const [isCheckingMcpStatus, setIsCheckingMcpStatus] = useState(false);
  const [workflowCreateRequest, setWorkflowCreateRequest] =
    useState<WorkflowCreateRequest | null>(null);
  const [workflowDetailsUpdateRequest, setWorkflowDetailsUpdateRequest] =
    useState<WorkflowDetailsUpdateRequest | null>(null);
  const [workflowHomeRequestId, setWorkflowHomeRequestId] = useState(0);
  const [workflowOpenRequest, setWorkflowOpenRequest] = useState<WorkflowOpenRequest | null>(null);
  const [workflowSavedFlowsForMenu, setWorkflowSavedFlowsForMenu] = useState<SavedCustomFlow[]>(
    () => loadSavedFlows()
  );
  const [processSnapshot, setProcessSnapshot] = useState<ProcessSnapshot>(() =>
    emptyProcessSnapshot()
  );
  const [processActionMessage, setProcessActionMessage] = useState("");
  const [isCompact, setIsCompact] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeCompactSection, setActiveCompactSection] = useState<SidebarSectionId>("servers");
  const [isRegistryDialogOpen, setIsRegistryDialogOpen] = useState(false);
  const [isMonitorDialogOpen, setIsMonitorDialogOpen] = useState(false);
  const [isCustomToolDialogOpen, setIsCustomToolDialogOpen] = useState(false);
  const [isMyToolManagerDialogOpen, setIsMyToolManagerDialogOpen] = useState(false);
  const [isCustomToolFormOpen, setIsCustomToolFormOpen] = useState(false);
  const [marketDialogTab, setMarketDialogTab] = useState<MarketDialogTab>("tools");
  const [customToolDialogScope, setCustomToolDialogScope] = useState<SidebarSectionId | "all">(
    "servers"
  );
  const [customToolDraft, setCustomToolDraft] = useState<CustomToolDraft>(() =>
    createCustomToolDraft()
  );
  const [isSavingCustomTool, setIsSavingCustomTool] = useState(false);
  const [customToolSort, setCustomToolSort] = useState<{
    field: CustomToolSortField;
    direction: SortDirection;
  } | null>(null);
  const [activeSettingsSection, setActiveSettingsSection] =
    useState<SettingsSectionId>("servers");
  const [colorMode, setColorMode] = useState<ColorMode>("light");
  const [openAiSettingsStatus, setOpenAiSettingsStatus] =
    useState<OpenAiSettingsStatus | null>(null);
  const [openAiApiKeyDraft, setOpenAiApiKeyDraft] = useState("");
  const [openAiModelDraft, setOpenAiModelDraft] = useState(openAiToolRunnerDefaultModel);
  const [openAiSettingsMessage, setOpenAiSettingsMessage] = useState("");
  const [isOpenAiSettingsBusy, setIsOpenAiSettingsBusy] = useState(false);
  const [favoriteSectionIds, setFavoriteSectionIds] = useState<SidebarSectionId[]>(() =>
    loadFavoriteSections()
  );
  const [favoriteSubmenuKeys, setFavoriteSubmenuKeys] = useState<SubmenuKey[]>(() =>
    loadFavoriteSubmenus()
  );
  const [recentSubmenuKeys, setRecentSubmenuKeys] = useState<SubmenuKey[]>(() =>
    loadRecentSubmenus()
  );
  const [isRecentSubmenuVisible, setIsRecentSubmenuVisible] = useState(true);
  const [sidebarOrder, setSidebarOrder] = useState<SidebarSectionId[]>(() => loadSidebarOrder());
  const [submenuOrder, setSubmenuOrder] = useState<Partial<Record<SidebarSectionId, SubmenuId[]>>>(
    () => loadSubmenuOrder()
  );
  const [customSubmenus, setCustomSubmenus] = useState<
    Partial<Record<SidebarSectionId, SubmenuItem[]>>
  >(() => loadCustomSubmenus());
  const [submenuMeta, setSubmenuMeta] = useState<SubmenuMetaMap>(() => loadSubmenuMeta());
  const [customTools, setCustomTools] = useState<CustomToolItem[]>(() => loadCustomTools());
  const [sharedFlows, setSharedFlows] = useState<SavedCustomFlow[]>(() => loadSharedFlows());
  const [githubUser, setGithubUser] = useState<GitHubUserProfile | null>(null);
  const [accountUsers, setAccountUsers] = useState<AccountUser[]>(() => loadAccountUsers());
  const [accountPolicy, setAccountPolicy] = useState<AccountPolicy>(() => loadAccountPolicy());
  const [accountUserSort, setAccountUserSort] = useState<{
    field: AccountUserSortField;
    direction: SortDirection;
  } | null>(null);
  const [authDialogMode, setAuthDialogMode] = useState<AuthDialogMode>("login");
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authDraft, setAuthDraft] = useState({ githubId: githubToolSource.owner, nickname: "" });
  const [authDevice, setAuthDevice] = useState<GitHubAuthDevice | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [customToolPath, setCustomToolPath] = useState("");
  const [customToolPathError, setCustomToolPathError] = useState("");
  const [githubToolStatus, setGithubToolStatus] = useState("");
  const [isGithubToolSyncing, setIsGithubToolSyncing] = useState(false);
  const [customToolSearch, setCustomToolSearch] = useState("");
  const [customToolFilter, setCustomToolFilter] = useState<CustomToolFilter>("all");
  const [deletedGithubToolPaths, setDeletedGithubToolPaths] = useState<string[]>(() =>
    loadDeletedGithubToolPaths()
  );
  const [expandedCustomToolIds, setExpandedCustomToolIds] = useState<string[]>([]);
  const [pendingDeleteCustomToolId, setPendingDeleteCustomToolId] = useState<string | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<SidebarSectionId | null>(null);
  const [expandedSectionIds, setExpandedSectionIds] = useState<SidebarSectionId[]>([]);
  const [expandedFavoriteSectionIds, setExpandedFavoriteSectionIds] = useState<SidebarSectionId[]>(
    []
  );
  const [activeSidebarSource, setActiveSidebarSource] = useState<SidebarSource>("menu");
  const [activeSubmenuKey, setActiveSubmenuKey] = useState<SubmenuKey | null>(null);
  const [backHistory, setBackHistory] = useState<NavigationState[]>([]);
  const [forwardHistory, setForwardHistory] = useState<NavigationState[]>([]);
  const [draggedSubmenu, setDraggedSubmenu] = useState<{
    sectionId: SidebarSectionId;
    submenuId: SubmenuId;
  } | null>(null);
  const [dragOverSubmenu, setDragOverSubmenu] = useState<{
    sectionId: SidebarSectionId;
    submenuId: SubmenuId;
    position: TabDropPosition;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => loadSidebarWidth());
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState<{
    id: string;
    position: TabDropPosition;
  } | null>(null);
  const [isTabEndDragOver, setIsTabEndDragOver] = useState(false);
  const [isTabOverflowOpen, setIsTabOverflowOpen] = useState(false);
  const [hiddenTabIds, setHiddenTabIds] = useState<string[]>([]);
  const [dragOverSection, setDragOverSection] = useState<{
    id: SidebarSectionId;
    position: TabDropPosition;
  } | null>(null);
  const [appNotifications, setAppNotifications] = useState<AppNotificationItem[]>([]);
  const notifiedPendingToolIdsRef = useRef<Set<string>>(new Set());

  const activeOpenTab = openTabs.find((tab) => tab.id === activeOpenTabId) ?? openTabs[0];
  const activeTab = activeOpenTab.workspaceTabId;
  const activeSidebarSection = activeOpenTab.sectionId;

  const pushAppNotification = (notification: AppNotificationInput) => {
    const created = createAppNotification(notification, appNotifications.length);
    setAppNotifications((items) => [...items, created]);
    if (created.autoDismissMs) {
      window.setTimeout(() => dismissAppNotification(created.id), created.autoDismissMs);
    }
  };

  const dismissAppNotification = (id: string) => {
    setAppNotifications((items) => items.filter((item) => item.id !== id));
  };

  const installSaveToolSkill = async () => {
    try {
      const result = await window.skillInstaller?.installSaveTool();
      pushAppNotification({
        title: "/save 스킬 설치 완료",
        message: result?.installedPath
          ? `이 컴퓨터에서 /save 명령으로 현재 대화를 TOOL 초안으로 저장할 수 있습니다. 설치 위치: ${result.installedPath}`
          : "이 컴퓨터에서 /save 명령으로 현재 대화를 TOOL 초안으로 저장할 수 있습니다."
      });
    } catch {
      pushAppNotification({
        title: "/save 스킬 설치 실패",
        message: "앱에 포함된 save-tool 스킬을 찾거나 설치하지 못했습니다. 프로그램 폴더 구성을 다시 확인해주세요."
      });
    }
  };

  const installMcpToolBuilderSkill = async () => {
    try {
      const result = await window.skillInstaller?.installMcpToolBuilder();
      pushAppNotification({
        title: "/make 스킬 설치 완료",
        message: result?.installedPath
          ? `이 컴퓨터에서 /make 툴이름 명령으로 MCP TOOL md 파일 제작 가이드 스킬을 사용할 수 있습니다. 설치 위치: ${result.installedPath}`
          : "이 컴퓨터에서 /make 툴이름 명령으로 MCP TOOL md 파일 제작 가이드 스킬을 사용할 수 있습니다."
      });
    } catch {
      pushAppNotification({
        title: "MCP Tool Builder 설치 실패",
        message:
          "앱에 포함된 mcp-tool-builder 스킬을 찾거나 설치하지 못했습니다. 프로그램 폴더 구성을 다시 확인해주세요."
      });
    }
  };

  const checkForAppUpdates = async () => {
    try {
      const release = await window.appUpdates?.getLatestRelease(githubToolSource);
      if (release && isNewerVersion(release.tagName, appVersion)) {
        pushAppNotification({
          title: `새 버전 ${release.tagName} 사용 가능`,
          message: "GitHub Release에서 최신 설치 파일을 확인할 수 있습니다."
        });
      }
    } catch {
      // Update checks should never block startup.
    }
  };

  const notifyLicenseExpiry = (user: AccountUser | undefined) => {
    if (!user?.licenseExpiresAt || !user.license) {
      return;
    }

    const expiresAt = new Date(user.licenseExpiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return;
    }

    const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);
    if (daysLeft < 0 || daysLeft > 7) {
      return;
    }

    const noticeKey = daysLeft <= 3 ? "critical" : "week";
    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `${user.githubId}:${noticeKey}`;
    const saved = JSON.parse(
      window.localStorage.getItem(licenseNoticeStorageKey) ?? "{}"
    ) as Record<string, string>;

    if (noticeKey === "week" && saved[storageKey]) {
      return;
    }

    if (noticeKey === "critical" && saved[storageKey] === todayKey) {
      return;
    }

    pushAppNotification({
      title: "라이선스 만료 예정",
      message:
        daysLeft <= 0
          ? "라이선스가 오늘 만료됩니다."
          : `라이선스가 ${daysLeft}일 뒤 만료됩니다.`
    });

    window.localStorage.setItem(
      licenseNoticeStorageKey,
      JSON.stringify({ ...saved, [storageKey]: noticeKey === "critical" ? todayKey : user.licenseExpiresAt })
    );
  };

  useEffect(() => {
    const source = activeOpenTab.sidebarSource ?? "menu";
    const submenuKey =
      activeOpenTab.submenuKey && isValidSubmenuKey(activeOpenTab.submenuKey)
        ? activeOpenTab.submenuKey
        : null;
    setActiveSidebarSource(source);
    setActiveSubmenuKey(submenuKey);
  }, [activeOpenTab.id, activeOpenTab.sidebarSource, activeOpenTab.submenuKey]);

  useEffect(() => {
    if (!storageWritesReadyRef.current) {
      return;
    }
    window.localStorage.setItem(pinnedTabsStorageKey, JSON.stringify(getPinnedTabs(openTabs)));
  }, [openTabs]);

  useEffect(() => {
    if (!storageWritesReadyRef.current) {
      return;
    }
    window.localStorage.setItem(favoriteSectionsStorageKey, JSON.stringify(favoriteSectionIds));
  }, [favoriteSectionIds]);

  useEffect(() => {
    if (!storageWritesReadyRef.current) {
      return;
    }
    window.localStorage.setItem(favoriteSubmenusStorageKey, JSON.stringify(favoriteSubmenuKeys));
  }, [favoriteSubmenuKeys]);

  useEffect(() => {
    if (!storageWritesReadyRef.current) {
      return;
    }
    window.localStorage.setItem(recentSubmenusStorageKey, JSON.stringify(recentSubmenuKeys));
  }, [recentSubmenuKeys]);

  useEffect(() => {
    if (!storageWritesReadyRef.current) {
      return;
    }
    window.localStorage.setItem(sidebarOrderStorageKey, JSON.stringify(sidebarOrder));
  }, [sidebarOrder]);

  useEffect(() => {
    if (!storageWritesReadyRef.current) {
      return;
    }
    window.localStorage.setItem(submenuOrderStorageKey, JSON.stringify(submenuOrder));
  }, [submenuOrder]);

  useEffect(() => {
    if (!storageWritesReadyRef.current) {
      return;
    }
    window.localStorage.setItem(customSubmenusStorageKey, JSON.stringify(customSubmenus));
  }, [customSubmenus]);

  useEffect(() => {
    if (!storageWritesReadyRef.current) {
      return;
    }
    window.localStorage.setItem(submenuMetaStorageKey, JSON.stringify(submenuMeta));
  }, [submenuMeta]);

  useEffect(() => {
    if (!storageWritesReadyRef.current) {
      return;
    }
    window.localStorage.setItem(customToolsStorageKey, JSON.stringify(customTools));
  }, [customTools]);

  useEffect(() => {
    if (!storageWritesReadyRef.current) {
      return;
    }
    saveSharedFlows(sharedFlows);
  }, [sharedFlows]);

  useEffect(() => {
    if (!storageWritesReadyRef.current) {
      return;
    }
    window.localStorage.setItem(
      deletedGithubToolPathsStorageKey,
      JSON.stringify(deletedGithubToolPaths)
    );
  }, [deletedGithubToolPaths]);

  useEffect(() => {
    if (!storageWritesReadyRef.current) {
      return;
    }
    window.localStorage.setItem(accountUsersStorageKey, JSON.stringify(accountUsers));
  }, [accountUsers]);

  useEffect(() => {
    if (!storageWritesReadyRef.current) {
      return;
    }
    window.localStorage.setItem(accountPolicyStorageKey, JSON.stringify(accountPolicy));
  }, [accountPolicy]);

  const isCurrentAdmin = githubUser?.githubId === githubToolSource.owner;
  const currentAccountUser = accountUsers.find((user) => user.githubId === githubUser?.githubId);
  const currentUserNickname = currentAccountUser?.nickname || githubUser?.nickname || "";

  useEffect(() => {
    if (!githubUser || !isCustomToolFormOpen) {
      return;
    }
    setCustomToolDraft((draft) =>
      draft.author === currentUserNickname ? draft : { ...draft, author: currentUserNickname }
    );
  }, [currentUserNickname, githubUser, isCustomToolFormOpen]);

  useEffect(() => {
    storageWritesReadyRef.current = true;
  }, []);

  useEffect(() => {
    void checkForAppUpdates();
  }, []);

  useEffect(() => {
    void refreshToolReviewStates();
    const timer = window.setInterval(() => {
      void refreshToolReviewStates();
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [customTools.length]);

  useEffect(() => {
    let isMounted = true;
    void window.githubAuth?.getProfile().then((profile) => {
      if (isMounted) {
        setGithubUser(profile);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!githubUser) {
      return;
    }

    setAccountUsers((users) => {
      const isAdmin = githubUser.githubId === githubToolSource.owner;
      const existing = users.find((user) => user.githubId === githubUser.githubId);
      if (existing) {
        return users.map((user) =>
          user.githubId === githubUser.githubId
            ? {
                ...user,
                nickname: user.nickname || githubUser.nickname,
                role: isAdmin ? "admin" : user.role,
                license: isAdmin ? true : user.license,
                status: isAdmin ? "active" : user.status
              }
            : user
        );
      }

      return [
        ...users,
        {
          githubId: githubUser.githubId,
          nickname: githubUser.nickname,
          role: isAdmin ? "admin" : "user",
          license: isAdmin,
          status: isAdmin || accountPolicy.signupMode === "open" ? "active" : "pending",
          joinedAt: new Date().toISOString()
        }
      ];
    });
  }, [accountPolicy.signupMode, githubUser]);

  const isLoggedIn = Boolean(githubUser);
  const isLicenseAllowed =
    isLoggedIn &&
    (accountPolicy.licenseMode === "all" ||
      Boolean(currentAccountUser?.license) ||
      Boolean(isCurrentAdmin));
  const isSignupApproved =
    isLoggedIn && (!currentAccountUser || currentAccountUser.status === "active");
  const isAccountAccessAllowed = isLicenseAllowed && isSignupApproved;

  useEffect(() => {
    notifyLicenseExpiry(currentAccountUser);
  }, [currentAccountUser?.githubId, currentAccountUser?.licenseExpiresAt, currentAccountUser?.license]);

  useEffect(() => {
    if (!isCurrentAdmin) {
      return;
    }

    const newReviewTools = customTools.filter((tool) => {
      const needsReview = tool.approvalStatus === "pending" || tool.reviewState === "open";
      const isOwnTool = Boolean(currentUserNickname && tool.author === currentUserNickname);
      return needsReview && !isOwnTool && !notifiedPendingToolIdsRef.current.has(tool.id);
    });

    if (newReviewTools.length === 0) {
      return;
    }

    newReviewTools.forEach((tool) => notifiedPendingToolIdsRef.current.add(tool.id));
    newReviewTools.forEach((tool) => {
      pushAppNotification({
        title: "새 툴 승인 요청",
        message: `${tool.author}님이 ${tool.name} ${tool.version} 툴을 등록했습니다.`
      });
    });
  }, [customTools, currentUserNickname, isCurrentAdmin]);

  useEffect(() => {
    if (!storageWritesReadyRef.current) {
      return;
    }
    window.localStorage.setItem(sidebarWidthStorageKey, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    if (!autoAddMessage) {
      return;
    }

    const timer = window.setTimeout(() => setAutoAddMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [autoAddMessage]);

  useEffect(() => {
    if (!processActionMessage) {
      return;
    }

    const timer = window.setTimeout(() => setProcessActionMessage(""), 4200);
    return () => window.clearTimeout(timer);
  }, [processActionMessage]);

  useEffect(() => {
    const element = openTabsRef.current;
    const stripElement = tabStripRef.current;
    if (!element || !stripElement) {
      return;
    }

    const updateHiddenTabs = () => {
      const tabElements = Array.from(element.querySelectorAll<HTMLElement>(".openTab[data-tab-id]"));
      const controlElement = stripElement.querySelector<HTMLElement>(".tabControlSlot");
      const controlStyle = controlElement ? window.getComputedStyle(controlElement) : null;
      const controlOuterWidth =
        (controlElement?.offsetWidth ?? 0) +
        Number.parseFloat(controlStyle?.marginLeft ?? "0") +
        Number.parseFloat(controlStyle?.marginRight ?? "0");
      const availableWidth = Math.max(0, Math.floor(stripElement.clientWidth - controlOuterWidth - 2));
      const hiddenIds = getHiddenTabIds(
        tabElements
          .map((tabElement) =>
            tabElement.dataset.tabId
              ? { id: tabElement.dataset.tabId, width: tabElement.offsetWidth }
              : null
          )
          .filter((tab): tab is { id: string; width: number } => Boolean(tab)),
        availableWidth
      );

      setHiddenTabIds((current) =>
        current.length === hiddenIds.length && current.every((id, index) => id === hiddenIds[index])
          ? current
          : hiddenIds
      );
      if (hiddenIds.length === 0) {
        setIsTabOverflowOpen(false);
      }
    };

    updateHiddenTabs();
    const frame = window.requestAnimationFrame(updateHiddenTabs);
    const observer = new ResizeObserver(updateHiddenTabs);
    observer.observe(element);
    observer.observe(stripElement);
    window.addEventListener("resize", updateHiddenTabs);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", updateHiddenTabs);
    };
  }, [openTabs, isCompact]);

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (
          contextMenu ||
          isRegistryDialogOpen ||
          isMonitorDialogOpen ||
          isCustomToolDialogOpen ||
          isMyToolManagerDialogOpen ||
          isCustomToolFormOpen ||
          isAuthDialogOpen ||
          isTabOverflowOpen
        ) {
          event.preventDefault();
          setContextMenu(null);
          setIsRegistryDialogOpen(false);
          setIsMonitorDialogOpen(false);
          setIsCustomToolDialogOpen(false);
          setIsMyToolManagerDialogOpen(false);
          setIsCustomToolFormOpen(false);
          setIsAuthDialogOpen(false);
          setIsTabOverflowOpen(false);
        }
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        window.localStorage.setItem(sidebarOrderStorageKey, JSON.stringify(sidebarOrder));
        window.localStorage.setItem(submenuOrderStorageKey, JSON.stringify(submenuOrder));
        window.localStorage.setItem(customSubmenusStorageKey, JSON.stringify(customSubmenus));
        window.localStorage.setItem(submenuMetaStorageKey, JSON.stringify(submenuMeta));
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [
    contextMenu,
    customSubmenus,
    isAuthDialogOpen,
    isCustomToolDialogOpen,
    isCustomToolFormOpen,
    isMyToolManagerDialogOpen,
    isTabOverflowOpen,
    isMonitorDialogOpen,
    isRegistryDialogOpen,
    sidebarOrder,
    submenuMeta,
    submenuOrder
  ]);

  useEffect(() => {
    const closeContextMenu = () => {
      setContextMenu(null);
      setIsTabOverflowOpen(false);
    };
    window.addEventListener("click", closeContextMenu);
    return () => window.removeEventListener("click", closeContextMenu);
  }, []);

  useEffect(() => {
    const api = window.mcpRegistry;
    if (!api) {
      return;
    }

    void api.loadRegistry().then((next) => {
      setRegistry(next);
      setSelectedId(next.servers[0]?.id ?? "");
    });
  }, []);

  const applyProcessResult = (result: ServerProcessResult) => {
    setRegistry(result.registry);
    setProcessSnapshot({
      processes: result.processes,
      logs: result.logs
    });
  };

  const refreshProcessSnapshot = async () => {
    const api = window.mcpProcesses;
    if (!api) {
      return;
    }

    try {
      applyProcessResult(await api.getSnapshot());
    } catch (error) {
      setProcessActionMessage((error as Error).message);
    }
  };

  const refreshOpenAiSettings = async () => {
    const api = window.openAiSettings;
    if (!api) {
      setOpenAiSettingsMessage("데스크톱 앱에서만 AI 연결 설정을 저장할 수 있습니다.");
      return;
    }

    try {
      const status = await api.get();
      setOpenAiSettingsStatus(status);
      setOpenAiModelDraft(status.model || openAiToolRunnerDefaultModel);
    } catch (error) {
      setOpenAiSettingsMessage(
        error instanceof Error ? error.message : "AI 연결 설정을 불러오지 못했습니다."
      );
    }
  };

  const saveOpenAiSettings = async () => {
    const api = window.openAiSettings;
    if (!api) {
      setOpenAiSettingsMessage("데스크톱 앱에서만 AI 연결 설정을 저장할 수 있습니다.");
      return;
    }

    if (!openAiApiKeyDraft.trim() && !openAiSettingsStatus?.configured) {
      setOpenAiSettingsMessage("OpenAI API 키를 입력해주세요.");
      return;
    }

    setIsOpenAiSettingsBusy(true);
    setOpenAiSettingsMessage("");
    try {
      const status = await api.save({
        apiKey: openAiApiKeyDraft.trim() || undefined,
        model: openAiModelDraft.trim() || openAiToolRunnerDefaultModel
      });
      setOpenAiSettingsStatus(status);
      setOpenAiModelDraft(status.model || openAiToolRunnerDefaultModel);
      setOpenAiApiKeyDraft("");
      setOpenAiSettingsMessage("AI 연결 설정을 저장했습니다.");
    } catch (error) {
      setOpenAiSettingsMessage(
        error instanceof Error ? error.message : "AI 연결 설정을 저장하지 못했습니다."
      );
    } finally {
      setIsOpenAiSettingsBusy(false);
    }
  };

  const clearOpenAiSettings = async () => {
    const api = window.openAiSettings;
    if (!api) {
      setOpenAiSettingsMessage("데스크톱 앱에서만 AI 연결 설정을 삭제할 수 있습니다.");
      return;
    }

    setIsOpenAiSettingsBusy(true);
    setOpenAiSettingsMessage("");
    try {
      const status = await api.clear();
      setOpenAiSettingsStatus(status);
      setOpenAiModelDraft(status.model || openAiToolRunnerDefaultModel);
      setOpenAiApiKeyDraft("");
      setOpenAiSettingsMessage("저장된 API 키를 삭제했습니다.");
    } catch (error) {
      setOpenAiSettingsMessage(
        error instanceof Error ? error.message : "저장된 API 키를 삭제하지 못했습니다."
      );
    } finally {
      setIsOpenAiSettingsBusy(false);
    }
  };

  const installProgramMcpRegistrarSkill = async () => {
    try {
      const result = await window.skillInstaller?.installProgramMcpRegistrar();
      pushAppNotification({
        title: "/등록 스킬 설치 완료",
        message: result?.installedPath
          ? `이 컴퓨터에서 /등록 명령으로 프로그램 MCP 브리지를 생성, 등록, 연결, 검증할 수 있습니다. 설치 위치: ${result.installedPath}`
          : "이 컴퓨터에서 /등록 명령으로 프로그램 MCP 브리지를 생성, 등록, 연결, 검증할 수 있습니다."
      });
    } catch {
      pushAppNotification({
        title: "/등록 스킬 설치 실패",
        message:
          "앱에 포함된 program-mcp-registrar 스킬을 찾거나 설치하지 못했습니다. 프로그램 폴더 구성을 다시 확인해주세요."
      });
    }
  };

  useEffect(() => {
    void refreshProcessSnapshot();
    const timer = window.setInterval(() => {
      void refreshProcessSnapshot();
    }, 2500);

    return () => window.clearInterval(timer);
  }, []);

  const activeServerWorkspace: WorkspaceTabId =
    activeSidebarSection === "revit"
      ? "revit"
      : activeSidebarSection === "servers"
        ? activeTab === "registry"
          ? "registry"
          : "cad"
        : activeTab;
  const visibleServers = useMemo(
    () => filterServersByWorkspace(registry.servers, activeServerWorkspace),
    [activeServerWorkspace, registry.servers]
  );

  useEffect(() => {
    if (isRegistryDialogOpen && activeSettingsSection === "servers") {
      if (registry.servers.length === 0) {
        setSelectedId("");
        return;
      }

      if (selectedId && !registry.servers.some((server) => server.id === selectedId)) {
        setSelectedId(registry.servers[0].id);
      }
      return;
    }

    if (visibleServers.length === 0) {
      setSelectedId("");
      return;
    }

    if (selectedId && !visibleServers.some((server) => server.id === selectedId)) {
      setSelectedId(visibleServers[0].id);
    }
  }, [activeSettingsSection, isRegistryDialogOpen, registry.servers, selectedId, visibleServers]);

  useEffect(() => {
    if (isRegistryDialogOpen && activeSettingsSection === "ai") {
      void refreshOpenAiSettings();
    }
  }, [activeSettingsSection, isRegistryDialogOpen]);

  const selected = useMemo<McpServerRecord | undefined>(
    () => visibleServers.find((server) => server.id === selectedId),
    [selectedId, visibleServers]
  );
  const selectedRegistryServer = useMemo<McpServerRecord | undefined>(
    () => registry.servers.find((server) => server.id === selectedId),
    [registry.servers, selectedId]
  );

  useEffect(() => {
    if (isCreatingServer || !selectedRegistryServer) {
      return;
    }

    setServerDraft(serverDraftFromRecord(selectedRegistryServer));
    setRegistryError("");
  }, [isCreatingServer, selectedRegistryServer]);

  const cadCount = registry.servers.filter((server) => server.target === "cad").length;
  const revitCount = registry.servers.filter((server) => server.target === "revit").length;
  const runningCount = registry.servers.filter((server) => server.status === "running").length;
  const disconnectedCount = registry.servers.length - runningCount;
  const selectedProcessState = selectedRegistryServer
    ? processSnapshot.processes.find((process) => process.serverId === selectedRegistryServer.id)
    : undefined;
  const isSelectedServerRunning =
    selectedProcessState?.status === "running" || selectedRegistryServer?.status === "running";
  const connectionScope = connectionScopeForPage(
    isCompact ? activeCompactSection : activeSidebarSection,
    activeTab
  );
  const scopedConnectionServers = connectionScope.targets
    ? registry.servers.filter((server) => connectionScope.targets?.includes(server.target))
    : registry.servers;
  const connectionSummary = getConnectionSummary(scopedConnectionServers);
  const connectionTooltip =
    registry.servers.filter((server) => server.status === "running").length > 0
      ? registry.servers
          .filter((server) => server.status === "running")
          .map((server) => `${targetLabel(server.target)} 연결 중 ${server.name}`)
          .join("\n")
      : "연결된 MCP 서버가 없습니다.";
  const currentConnectionTooltip =
    scopedConnectionServers.filter((server) => server.status === "running").length > 0
      ? scopedConnectionServers
          .filter((server) => server.status === "running")
          .map((server) => `${targetLabel(server.target)} 연결 중 ${server.name}`)
          .join("\n")
      : `${connectionScope.label} 연결 서버가 없습니다.`;
  const orderedSidebarSections = useMemo(
    () =>
      sidebarOrder
        .map((id) => sidebarSections.find((section) => section.id === id))
        .filter((section): section is (typeof sidebarSections)[number] => Boolean(section)),
    [sidebarOrder]
  );
  const menuSidebarSections = useMemo(
    () => orderedSidebarSections.filter((section) => !favoriteSectionIds.includes(section.id)),
    [favoriteSectionIds, orderedSidebarSections]
  );

  const toggleCompactMode = () => {
    const nextValue = !isCompact;
    setIsCompact(nextValue);
    if (nextValue) {
      setIsSidebarCollapsed(true);
    }
    void window.mcpWindow?.setCompactMode(nextValue);
  };

  const openWebView = () => {
    void window.mcpWindow?.openWebView();
  };

  useEffect(() => {
    if (isCompact && !isSidebarCollapsed) {
      setIsSidebarCollapsed(true);
    }
  }, [isCompact, isSidebarCollapsed]);

  const updateActiveOpenTab = (patch: Partial<AppTab>) => {
    setOpenTabs((tabs) =>
      tabs.map((tab) => (tab.id === activeOpenTabId ? { ...tab, ...patch } : tab))
    );
  };

  const getCurrentNavigationState = (): NavigationState => ({
    sectionId: activeSidebarSection,
    title: activeOpenTab.title,
    source: activeOpenTab.sidebarSource ?? activeSidebarSource,
    submenuKey:
      activeOpenTab.submenuKey && isValidSubmenuKey(activeOpenTab.submenuKey)
        ? activeOpenTab.submenuKey
        : activeSubmenuKey
  });

  const applyNavigationState = (state: NavigationState) => {
    setActiveSidebarSource(state.source);
    setActiveSubmenuKey(state.submenuKey);
    updateActiveOpenTab({
      sectionId: state.sectionId,
      title: state.title,
      sidebarSource: state.source,
      submenuKey: state.submenuKey
    });
  };

  const isSameNavigationState = (left: NavigationState, right: NavigationState) =>
    left.sectionId === right.sectionId &&
    left.title === right.title &&
    left.source === right.source &&
    left.submenuKey === right.submenuKey;

  const navigateInCurrentTab = (nextState: NavigationState) => {
    const currentState = getCurrentNavigationState();
    if (isSameNavigationState(currentState, nextState)) {
      return;
    }

    setBackHistory((history) => [...history, currentState]);
    setForwardHistory([]);
    applyNavigationState(nextState);
  };

  const goBack = () => {
    setBackHistory((history) => {
      const previous = history.at(-1);
      if (!previous) {
        return history;
      }

      setForwardHistory((items) => [getCurrentNavigationState(), ...items]);
      applyNavigationState(previous);
      return history.slice(0, -1);
    });
  };

  const goForward = () => {
    setForwardHistory((history) => {
      const next = history[0];
      if (!next) {
        return history;
      }

      setBackHistory((items) => [...items, getCurrentNavigationState()]);
      applyNavigationState(next);
      return history.slice(1);
    });
  };

  const openBlankTab = () => {
    const tab = createBlankTab(nextTabId());
    setOpenTabs((tabs) => [...tabs, tab]);
    setActiveOpenTabId(tab.id);
  };

  const openSectionInCurrentTab = (
    sectionId: SidebarSectionId,
    source: "menu" | "favorite" = "menu"
  ) => {
    navigateInCurrentTab({
      sectionId,
      title: sidebarLabel(sectionId),
      source,
      submenuKey: null
    });
  };

  const getSubmenuItem = (sectionId: SidebarSectionId, submenuId: SubmenuId): SubmenuItem => {
    const key = makeSubmenuKey(sectionId, submenuId);
    const workflowFlowMenu = parseWorkflowMenuFlowId(submenuId);
    if (sectionId === "workflow" && workflowFlowMenu) {
      const flow =
        workflowFlowMenu.source === "shared"
          ? sharedFlowCatalog.find((item) => item.id === workflowFlowMenu.flowId)
          : workflowSavedFlowsForMenu.find((item) => item.id === workflowFlowMenu.flowId);
      if (flow) {
        return {
          id: submenuId,
          label: flow.name,
          description: flow.description,
          ...submenuMeta[key]
        };
      }
    }

    if (submenuId.startsWith("share-")) {
      const shareTool = getToolsForWorkspace(workspaceForSection(sectionId)).find(
        (tool) => `share-${tool.name}` === submenuId
      );
      if (shareTool) {
        return {
          id: submenuId,
          label: shareTool.name,
          description: shareTool.description,
          ...submenuMeta[key]
        };
      }
    }

    const customTool = customTools.find((tool) => tool.id === submenuId);
    if (customTool) {
      return {
        id: submenuId,
        label: customTool.name,
        description: customTool.description || `${customTool.author} · v${customTool.version}`,
        settingsSchema: customTool.toolSchema,
        ...submenuMeta[key]
      };
    }

    const base =
      [
        ...getDefaultSubmenuItemsForSection(sectionId),
        ...(customSubmenus[sectionId] ?? [])
      ].find(
        (item) => item.id === submenuId
      ) ?? {
        id: submenuId,
        label: "새 페이지",
        description: "이 소메뉴에서 사용할 MCP 툴을 정리합니다."
      };
    const override = submenuMeta[key];

    return {
      ...base,
      ...override
    };
  };

  const getSubmenuLabel = (sectionId: SidebarSectionId, submenuId: SubmenuId) =>
    getSubmenuItem(sectionId, submenuId).label;

  const getOrderedSubmenuItems = (sectionId: SidebarSectionId) => {
    const savedOrder = submenuOrder[sectionId] ?? [];
    if (sectionId === "workflow") {
      const workflowItems = [
        ...listWorkflowMenuFlowItems(sharedFlowCatalog, workflowSavedFlowsForMenu),
        ...getDefaultSubmenuItemsForSection(sectionId)
      ];
      const workflowIds = workflowItems.map((item) => item.id);
      return [
        ...savedOrder
          .filter((id) => workflowIds.includes(id))
          .map((id) => getSubmenuItem(sectionId, id)),
        ...workflowItems
          .filter((item) => !savedOrder.includes(item.id))
          .map((item) => getSubmenuItem(sectionId, item.id))
      ];
    }

    const availableItems = [
      ...getDefaultSubmenuItemsForSection(sectionId),
      ...getToolsForWorkspace(workspaceForSection(sectionId)).map((tool) => ({
        id: `share-${tool.name}`,
        label: tool.name,
        description: tool.description
      })),
      ...customTools
        .filter((tool) => tool.sectionId === sectionId && tool.registered)
        .map((tool) => ({
          id: tool.id,
          label: tool.name,
          description: tool.description || `${tool.author} · v${tool.version}`,
          settingsSchema: tool.toolSchema
        }))
    ];
    const availableIds = availableItems.map((item) => item.id);
    const orderedIds = [
      ...savedOrder.filter((id) => id !== "add" && availableIds.includes(id)),
      ...availableItems
        .map((item) => item.id)
        .filter((id) => id !== "add" && !savedOrder.includes(id)),
      ...(shouldShowSubmenuAddButton(sectionId) ? (["add"] as SubmenuId[]) : [])
    ];

    return orderedIds.map((id) => getSubmenuItem(sectionId, id));
  };

  const rememberRecentSubmenu = (sectionId: SidebarSectionId, submenuId: SubmenuId) => {
    if (submenuId === "add") {
      return;
    }

    const key = makeSubmenuKey(sectionId, submenuId);
    setRecentSubmenuKeys((keys) => [key, ...keys.filter((item) => item !== key)].slice(0, 3));
  };

  const openSubmenu = (
    sectionId: SidebarSectionId,
    submenuId: SubmenuId,
    source: "submenu" | "favoriteSubmenu" | "recent" = "submenu"
  ) => {
    const workflowFlowMenu = parseWorkflowMenuFlowId(submenuId);
    if (sectionId === "workflow" && workflowFlowMenu) {
      const flow =
        workflowFlowMenu.source === "shared"
          ? sharedFlowCatalog.find((item) => item.id === workflowFlowMenu.flowId)
          : workflowSavedFlowsForMenu.find((item) => item.id === workflowFlowMenu.flowId);
      if (!flow) {
        return;
      }

      navigateInCurrentTab({
        sectionId,
        title: flow.name,
        source,
        submenuKey: makeSubmenuKey(sectionId, submenuId)
      });
      rememberRecentSubmenu(sectionId, submenuId);
      setWorkflowOpenRequest({
        requestId: Date.now(),
        graph: cloneStoredFlowGraph(flow.graph),
        flowId: flow.id,
        source: workflowFlowMenu.source
      });
      return;
    }

    if (submenuId === "add") {
      if (sectionId === "workflow") {
        navigateInCurrentTab({
          sectionId,
          title: sidebarLabel(sectionId),
          source: source === "favoriteSubmenu" ? "favorite" : source === "recent" ? "recent" : "menu",
          submenuKey: null
        });
        setWorkflowCreateRequest({
          requestId: Date.now(),
          submenuSource:
            source === "favoriteSubmenu" ? "favorite" : source === "recent" ? "recent" : "menu"
        });
        return;
      }
      openCustomToolDialog(sectionId);
      return;
    }

    const key = makeSubmenuKey(sectionId, submenuId);
    rememberRecentSubmenu(sectionId, submenuId);
    navigateInCurrentTab({
      sectionId,
      title: getSubmenuLabel(sectionId, submenuId),
      source,
      submenuKey: key
    });
  };

  const selectSidebarSection = (sectionId: SidebarSectionId, source: "menu" | "favorite") => {
    if (isCompact) {
      setActiveCompactSection(sectionId);
      return;
    }

    openSectionInCurrentTab(sectionId, source);
    if (sectionId === "workflow") {
      setWorkflowHomeRequestId((id) => id + 1);
    }
  };

  const selectHomePage = () => {
    if (isCompact) {
      setActiveCompactSection("home");
      return;
    }

    openSectionInCurrentTab("home", "menu");
  };

  const selectSidebarSubmenu = (
    sectionId: SidebarSectionId,
    submenuId: SubmenuId,
    source: "submenu" | "favoriteSubmenu" | "recent" = "submenu"
  ) => {
    if (isCompact) {
      setActiveCompactSection(sectionId);
      return;
    }

    openSubmenu(sectionId, submenuId, source);
  };

  const openAuthDialog = (mode: AuthDialogMode) => {
    setAuthDialogMode(mode);
    setAuthDraft({
      githubId: githubUser?.githubId ?? githubToolSource.owner,
      nickname: currentUserNickname
    });
    setAuthDevice(null);
    setAuthMessage("");
    setIsAuthDialogOpen(true);
  };

  const startGitHubLogin = async () => {
    if (githubUser) {
      openAuthDialog("profile");
      return;
    }

    if (!window.githubAuth) {
      setAuthMessage("현재 실행 환경에서는 GitHub 로그인을 사용할 수 없습니다.");
      return;
    }

    setIsAuthBusy(true);
    setAuthMessage("GitHub 로그인 페이지를 여는 중입니다.");
    try {
      const result = await window.githubAuth.beginLogin();
      if ("error" in result) {
        setAuthMessage(result.error);
        setAuthDevice(null);
        return;
      }

      setAuthDevice(result);
      setAuthMessage("브라우저에서 GitHub 인증을 완료한 뒤 아래 확인 버튼을 눌러주세요.");
    } catch {
      setAuthMessage("GitHub 로그인 시작에 실패했습니다.");
    } finally {
      setIsAuthBusy(false);
    }
  };

  const completeGitHubLogin = async () => {
    if (!authDevice || !window.githubAuth) {
      return;
    }

    const nickname = authDraft.nickname.trim();
    setIsAuthBusy(true);
    setAuthMessage("GitHub 인증 완료 여부를 확인하는 중입니다.");
    try {
      const result = await window.githubAuth.pollLogin(authDevice.deviceCode, nickname || undefined);
      if (result.status === "ok") {
        setGithubUser(result.profile);
        setAuthDraft({
          githubId: result.profile.githubId,
          nickname: result.profile.nickname
        });
        setAuthDevice(null);
        setAuthMessage("GitHub 로그인이 완료되었습니다.");
        if (authDialogMode === "login") {
          setIsAuthDialogOpen(false);
        } else {
          setAuthDialogMode("profile");
        }
        return;
      }

      setAuthMessage(result.message);
    } catch {
      setAuthMessage("GitHub 인증 확인에 실패했습니다.");
    } finally {
      setIsAuthBusy(false);
    }
  };

  const saveGitHubProfile = async () => {
    const nickname = authDraft.nickname.trim();
    if (!githubUser || !nickname) {
      return;
    }

    setIsAuthBusy(true);
    try {
      const profile = await window.githubAuth?.updateNickname(nickname);
      if (profile) {
        setGithubUser(profile);
        setAccountUsers((users) =>
          users.map((user) =>
            user.githubId === profile.githubId ? { ...user, nickname: profile.nickname } : user
          )
        );
      }
      setIsAuthDialogOpen(false);
    } finally {
      setIsAuthBusy(false);
    }
  };

  const logoutGitHubUser = async () => {
    setIsAuthBusy(true);
    try {
      await window.githubAuth?.logout();
      setGithubUser(null);
      setAuthDialogMode("login");
      setAuthDraft({ githubId: githubToolSource.owner, nickname: "" });
      setAuthDevice(null);
      setAuthMessage("");
      setIsAuthDialogOpen(false);
    } finally {
      setIsAuthBusy(false);
    }
  };

  const updateAccountPolicy = <K extends keyof AccountPolicy>(
    key: K,
    value: AccountPolicy[K]
  ) => {
    if (!isCurrentAdmin) {
      return;
    }

    setAccountPolicy((current) => ({ ...current, [key]: value }));
  };

  const toggleAccountLicense = (githubId: string) => {
    if (!isCurrentAdmin || githubId === githubToolSource.owner) {
      return;
    }

    setAccountUsers((users) =>
      users.map((user) =>
        user.githubId === githubId ? { ...user, license: !user.license } : user
      )
    );
  };

  const approveAccountUser = (githubId: string) => {
    if (!isCurrentAdmin) {
      return;
    }

    setAccountUsers((users) =>
      users.map((user) => (user.githubId === githubId ? { ...user, status: "active" } : user))
    );
  };

  const deleteAccountUser = (githubId: string) => {
    if (!isCurrentAdmin || githubId === githubToolSource.owner) {
      return;
    }

    setAccountUsers((users) => users.filter((user) => user.githubId !== githubId));
  };

  const openCustomToolDialog = (
    scope: SidebarSectionId | "all",
    tab: MarketDialogTab = "tools"
  ) => {
    setCustomToolDialogScope(scope);
    setMarketDialogTab(tab);
    setIsCustomToolDialogOpen(true);
    void syncCustomToolsFromGitHub();
    void refreshToolReviewStates();
  };

  const openCustomToolForm = () => {
    if (!githubUser) {
      openAuthDialog("login");
      return;
    }
    setCustomToolDraft({
      ...createCustomToolDraft(),
      author: currentUserNickname || githubUser.githubId
    });
    setIsCustomToolFormOpen(true);
  };

  const registerSharedFlow = (flow: SavedCustomFlow) => {
    setSharedFlows((items) => upsertSharedFlow(items, flow));
    pushAppNotification({
      title: "Share Flow 등록",
      message: `${flow.name} 플로우를 Share Flow에 추가했습니다.`
    });
  };

  const syncCustomToolsFromGitHub = async () => {
    if (!window.customTools?.listGithubTools) {
      setGithubToolStatus("현재 환경에서는 GitHub 툴 목록을 읽을 수 없습니다.");
      return;
    }

    setIsGithubToolSyncing(true);
    setGithubToolStatus("GitHub tools 폴더를 확인하는 중입니다.");

    try {
      const githubTools = await window.customTools.listGithubTools(githubToolSource);
      const visibleGithubTools = githubTools.filter(
        (tool) => !deletedGithubToolPaths.includes(tool.path)
      );
      setCustomTools((items) => {
        const existingGithubItems = items.filter((item) =>
          item.installedPath?.startsWith(githubToolPathPrefix)
        );
        const groupedTools = new Map<
          string,
          {
            sectionId: SidebarSectionId;
            name: string;
            versions: CustomToolVersion[];
          }
        >();

        visibleGithubTools.forEach((tool) => {
          const sectionId = isSidebarSectionId(tool.sectionId) ? tool.sectionId : "servers";
          const groupKey = `${sectionId}:${tool.name}`;
          const group =
            groupedTools.get(groupKey) ??
            {
              sectionId,
              name: tool.name,
              versions: []
            };

          group.versions.push({
            id: tool.id,
            version: tool.version,
            author: tool.author || githubToolSource.owner,
            description: tool.description,
            sourcePath: tool.path,
            installedPath: tool.path,
            isToolLike: tool.isToolLike,
            riskWarnings: tool.riskWarnings,
            toolSchema: tool.toolSchema
          });
          groupedTools.set(groupKey, group);
        });

        return [
          ...[...groupedTools.values()].map((tool) => {
            const versions = [...tool.versions].sort((left, right) =>
              compareToolVersionDesc(left.version, right.version)
            );
            const activeVersion = versions[0];
            const existing = existingGithubItems.find(
              (item) => item.sectionId === tool.sectionId && item.name === tool.name
            );

            return {
              id: existing?.id ?? `github-tool-${hashString(`${tool.sectionId}:${tool.name}`)}`,
              sectionId: tool.sectionId,
              name: tool.name,
              description: activeVersion.description,
              version: activeVersion.version,
              author: activeVersion.author || githubToolSource.owner,
              createdAt: existing?.createdAt ?? new Date().toISOString(),
              usageCount: existing?.usageCount ?? 0,
              pinned: existing?.pinned ?? false,
              registered: existing?.registered ?? false,
              approvalStatus: existing?.approvalStatus ?? "approved",
              isToolLike: activeVersion.isToolLike,
              riskWarnings: activeVersion.riskWarnings,
              toolSchema: activeVersion.toolSchema,
              sourcePath: activeVersion.sourcePath,
              installedPath: activeVersion.installedPath,
              reviewUrl: existing?.reviewUrl,
              versions: [activeVersion]
            };
          })
        ];
      });
      setGithubToolStatus("");
    } catch {
      setGithubToolStatus("GitHub 툴 목록을 읽지 못했습니다. 저장소 공개 여부와 tools 폴더를 확인해주세요.");
    } finally {
      setIsGithubToolSyncing(false);
    }
  };

  const refreshToolReviewStates = async () => {
    if (!window.customTools?.getPullRequestState) {
      return;
    }

    const reviewTargets = customTools.filter((tool) => tool.reviewNumber && tool.reviewNumber > 0);
    if (reviewTargets.length === 0) {
      return;
    }

    const states = await Promise.all(
      reviewTargets.map(async (tool) => {
        try {
          const state = await window.customTools!.getPullRequestState(
            githubToolSource,
            tool.reviewNumber!
          );
          return { toolId: tool.id, state };
        } catch {
          return null;
        }
      })
    );

    const stateMap = new Map(
      states
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map((item) => [item.toolId, item.state])
    );

    if (stateMap.size === 0) {
      return;
    }

    setCustomTools((items) => {
      const notifications: AppNotificationInput[] = [];
      const nextItems = items.map((item) => {
        const state = stateMap.get(item.id);
        if (!state) {
          return item;
        }

        if (item.reviewState !== state.state) {
          if (state.state === "merged") {
            notifications.push({
              title: "툴 공유가 승인되었습니다",
              message: `${item.name} ${item.version} 등록 PR이 머지되었습니다.`
            });
          } else if (state.state === "closed") {
            notifications.push({
              title: "툴 공유가 거절되었습니다",
              message: `${item.name} ${item.version} 등록 PR이 닫혔습니다.`
            });
          }
        }

        return {
          ...item,
          reviewUrl: state.url,
          reviewState: state.state
        };
      });

      if (notifications.length > 0) {
        window.queueMicrotask(() => {
          notifications.forEach(pushAppNotification);
        });
      }
      return nextItems;
    });
  };

  const syncCustomToolsFromDirectory = async (directory: string) => {
    if (!window.customTools?.listMarkdownTools) {
      setCustomToolPathError("현재 실행 환경에서는 폴더 동기화를 사용할 수 없습니다.");
      return;
    }

    let linkedTools: Awaited<ReturnType<NonNullable<typeof window.customTools>["listMarkdownTools"]>>;
    try {
      linkedTools = await window.customTools.listMarkdownTools(directory);
      setCustomToolPathError("");
    } catch {
      setCustomToolPathError(
        "경로를 읽지 못했습니다. 보안 설정 변경 후에는 툴 폴더를 다시 선택해야 할 수 있습니다."
      );
      return;
    }

    setCustomTools((items) => {
      const remainingItems = items.filter(
        (item) => !item.installedPath || !isFileInDirectory(item.installedPath, directory)
      );
      const groupedTools = new Map<
        string,
        {
          sectionId: SidebarSectionId;
          name: string;
          versions: CustomToolVersion[];
        }
      >();

      linkedTools.forEach((tool) => {
        const sectionId = isSidebarSectionId(tool.sectionId) ? tool.sectionId : "servers";
        const groupKey = `${sectionId}:${tool.name}`;
        const group =
          groupedTools.get(groupKey) ??
          {
            sectionId,
            name: tool.name,
            versions: []
          };

        group.versions.push({
          id: tool.id,
          version: tool.version,
          author: tool.author,
          description: tool.description,
          sourcePath: tool.path,
          installedPath: tool.path,
          isToolLike: tool.isToolLike,
          riskWarnings: tool.riskWarnings,
          toolSchema: tool.toolSchema
        });
        groupedTools.set(groupKey, group);
      });

      return [
        ...remainingItems,
        ...[...groupedTools.values()].map((tool) => {
          const versions = [...tool.versions].sort((left, right) =>
            compareToolVersionDesc(left.version, right.version)
          );
          const activeVersion = versions[0];
          const existing = items.find(
            (item) =>
              item.name === tool.name &&
              item.sectionId === tool.sectionId &&
              item.installedPath &&
              isFileInDirectory(item.installedPath, directory)
          );

          return {
            id: existing?.id ?? `custom-tool-file-${hashString(`${tool.sectionId}:${tool.name}`)}`,
            sectionId: tool.sectionId,
            name: tool.name,
            description: activeVersion.description,
            version: activeVersion.version,
            author: activeVersion.author,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
            isToolLike: activeVersion.isToolLike,
            riskWarnings: activeVersion.riskWarnings,
            toolSchema: activeVersion.toolSchema,
            usageCount: 0,
            pinned: existing?.pinned ?? false,
            registered: existing?.registered ?? false,
            approvalStatus: existing?.approvalStatus ?? "approved",
            sourcePath: activeVersion.sourcePath,
            installedPath: activeVersion.installedPath,
            versions: [activeVersion]
          };
        })
      ];
    });
  };

  const selectCustomToolFile = async () => {
    const selectedFile = await window.customTools?.chooseMarkdownFile();
    if (!selectedFile) {
      return;
    }

    setCustomToolDraft((draft) => ({
      ...draft,
      name: draft.name || selectedFile.name,
      description: draft.description || selectedFile.description,
      filePath: selectedFile.path,
      fileName: selectedFile.name,
      preview: selectedFile.preview,
      isToolLike: selectedFile.isToolLike,
      riskWarnings: selectedFile.riskWarnings,
      toolSchema: selectedFile.toolSchema,
      toolWarning: selectedFile.isToolLike
        ? ""
        : "이 MD 파일은 툴 문서 형태가 아닐 수 있습니다. 그래도 등록은 가능합니다.",
      error: ""
    }));
  };

  const updateCustomToolDraftFromExisting = (toolId: string) => {
    const tool = customTools.find((item) => item.id === toolId);
    setCustomToolDraft((draft) => ({
      ...draft,
      toolId,
      name: tool?.name ?? draft.name,
      description: tool?.description ?? draft.description,
      version: tool?.version ?? draft.version,
      author: currentUserNickname || draft.author,
      isToolLike: tool?.isToolLike ?? draft.isToolLike,
      riskWarnings: tool?.riskWarnings ?? draft.riskWarnings,
      toolSchema: tool?.toolSchema ?? draft.toolSchema,
      toolWarning:
        tool && !tool.isToolLike
          ? "이 MD 파일은 툴 문서 형태가 아닐 수 있습니다. 그래도 등록은 가능합니다."
          : "",
      error: ""
    }));
  };

  const saveCustomToolDraft = async () => {
    if (isSavingCustomTool) {
      return;
    }

    const name = customToolDraft.name.trim();
    const description = customToolDraft.description.trim();
    const version = customToolDraft.version.trim();
    const author = currentUserNickname.trim() || githubUser?.githubId.trim() || "";

    if (!githubUser) {
      setCustomToolDraft((draft) => ({
        ...draft,
        error: "툴을 등록하려면 먼저 로그인하세요."
      }));
      openAuthDialog("login");
      return;
    }

    if (customToolDraft.mode === "update" && !customToolDraft.toolId) {
      setCustomToolDraft((draft) => ({
        ...draft,
        error: "버전 업데이트할 기존 툴을 선택하세요."
      }));
      return;
    }

    if (!name || !version || !author || !customToolDraft.filePath) {
      setCustomToolDraft((draft) => ({
        ...draft,
        error: "툴 이름, 버전, 제작자, MD 파일을 모두 입력하세요."
      }));
      return;
    }

    if (customToolDraft.toolSchema) {
      const blockingSchemaIssues = validateToolRuntimeSchema(customToolDraft.toolSchema).filter(
        (issue) => issue.severity === "error"
      );
      if (blockingSchemaIssues.length > 0) {
        setCustomToolDraft((draft) => ({
          ...draft,
          error: `설정 schema 오류가 있습니다. ${blockingSchemaIssues[0].message}`
        }));
        return;
      }
    }

    const sectionId =
      customToolDialogScope === "all"
        ? activeSidebarSection === "monitor"
          ? "servers"
          : activeSidebarSection
        : customToolDialogScope;
    const target =
      customToolDraft.mode === "update"
        ? customTools.find((tool) => tool.id === customToolDraft.toolId)
        : undefined;

    if (customToolDraft.mode === "update" && !target) {
      setCustomToolDraft((draft) => ({
        ...draft,
        error: "업데이트할 기존 툴을 선택하세요."
      }));
      return;
    }

    if (customToolDraft.mode === "update" && target) {
      const currentAuthorNames = [currentUserNickname, githubUser?.githubId]
        .filter((item): item is string => Boolean(item?.trim()))
        .map((item) => item.trim());
      if (!currentAuthorNames.includes(target.author.trim())) {
        setCustomToolDraft((draft) => ({
          ...draft,
          error: "처음 등록한 제작자만 이 툴을 업데이트할 수 있습니다."
        }));
        return;
      }
    }

    if (
      customToolDraft.mode === "update" &&
      target?.installedPath &&
      !target.installedPath.startsWith(githubToolPathPrefix) &&
      window.customTools?.compareMarkdownFile
    ) {
      const comparison = await window.customTools.compareMarkdownFile(
        target.installedPath,
        customToolDraft.filePath
      );
      if (!comparison.similar) {
        setCustomToolDraft((draft) => ({
          ...draft,
          error: `기존 툴과 내용이 많이 다릅니다. 유사도 ${Math.round(
            comparison.similarity * 100
          )}%라서 업데이트를 중단했습니다.`
        }));
        return;
      }
    }

    const metadata = {
      name,
      description,
      version,
      author,
      sectionId: target?.sectionId ?? sectionId
    };
    let publishResult:
      | {
          kind: "direct" | "pull_request";
          path: string;
          branch: string;
          pullRequestUrl: string;
          pullRequestNumber: number;
          pullRequestState: "open" | "closed" | "merged";
        }
      | undefined;
    const requiresSharedReview = shouldRequireSharedToolReview({
      mode: accountPolicy.toolRegistrationMode,
      riskWarnings: customToolDraft.riskWarnings
    });

    setIsSavingCustomTool(true);
    try {
      if (!window.customTools?.publishGithubTool) {
        throw new Error("현재 실행 환경에서는 GitHub 툴 등록을 사용할 수 없습니다.");
      }

      publishResult = await window.customTools.publishGithubTool(
        customToolDraft.filePath,
        githubToolSource,
        metadata,
        { requireReview: requiresSharedReview }
      );
      if (publishResult.kind === "direct") {
        pushAppNotification({
          title: "툴 공유 완료",
          message: "안전한 툴이 GitHub tools 폴더에 바로 등록되었습니다."
        });
      } else {
        pushAppNotification({
          title: `툴 등록 PR #${publishResult.pullRequestNumber} 생성`,
          message: requiresSharedReview
            ? "승인이 필요한 툴입니다. GitHub PR 머지 후 다른 사용자 목록에 표시됩니다."
            : "직접 등록 권한이 없어 PR로 전환했습니다. 머지 후 다른 사용자 목록에 표시됩니다."
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.includes("403") ||
            error.message.includes("404") ||
            error.message.includes("GitHub 브랜치") ||
            error.message.includes("repo 권한")
            ? "GitHub 권한이 부족합니다. 로그아웃 후 다시 로그인해서 저장소 권한을 승인해주세요."
            : error.message
          : "GitHub 툴 등록에 실패했습니다.";
      setCustomToolDraft((draft) => ({
        ...draft,
        error: message
      }));
      return;
    } finally {
      setIsSavingCustomTool(false);
    }

    const installedPath = publishResult.path;
    const reviewUrl = publishResult.pullRequestUrl;
    const reviewNumber = publishResult.pullRequestNumber;
    const reviewState = publishResult.pullRequestState;

    if (customToolDraft.mode === "update") {
      setCustomTools((items) =>
        items.map((item) =>
          item.id === target!.id
            ? {
                ...item,
                name,
                description,
                version,
                author,
                isToolLike: customToolDraft.isToolLike,
                riskWarnings: customToolDraft.riskWarnings,
                toolSchema: customToolDraft.toolSchema,
                sourcePath: customToolDraft.filePath,
                installedPath,
                reviewUrl,
                reviewNumber,
                reviewState,
                versions: [
                  {
                    id: `${item.id}-${version}`,
                    version,
                    author,
                    description,
                    sourcePath: customToolDraft.filePath,
                    installedPath: installedPath ?? customToolDraft.filePath,
                    reviewUrl,
                    reviewNumber,
                    reviewState,
                    isToolLike: customToolDraft.isToolLike,
                    riskWarnings: customToolDraft.riskWarnings,
                    toolSchema: customToolDraft.toolSchema
                  }
                ]
              }
            : item
        )
      );
    } else {
      setCustomTools((items) => [
        ...items,
        {
          id: `custom-tool-${Date.now()}`,
          sectionId,
          name,
          description,
          version,
          author,
          createdAt: new Date().toISOString(),
          usageCount: 0,
          pinned: false,
          registered: false,
          approvalStatus:
            requiresSharedReview &&
            !isCurrentAdmin
              ? "pending"
              : "approved",
          isToolLike: customToolDraft.isToolLike,
          riskWarnings: customToolDraft.riskWarnings,
          toolSchema: customToolDraft.toolSchema,
          sourcePath: customToolDraft.filePath,
          installedPath,
          reviewUrl,
          reviewNumber,
          reviewState
        }
      ]);
    }

    setIsCustomToolFormOpen(false);
    setCustomToolDraft(createCustomToolDraft());
  };

  const updateCustomToolPath = async () => {
    const selectedDirectory = await window.customTools?.chooseDirectory();
    if (!selectedDirectory) {
      return;
    }

    setCustomToolPath(selectedDirectory);
    setCustomToolPathError("");
    await syncCustomToolsFromDirectory(selectedDirectory);
  };

  useEffect(() => {
    if (!customToolPath) {
      return;
    }

    void syncCustomToolsFromDirectory(customToolPath);
  }, [customToolPath]);

  const toggleCustomToolPinned = (toolId: string) => {
    setCustomTools((items) =>
      items.map((item) => (item.id === toolId ? { ...item, pinned: !item.pinned } : item))
    );
  };

  const toggleCustomToolRegistered = (toolId: string) => {
    setCustomTools((items) =>
      items.map((item) =>
        item.id === toolId && item.approvalStatus === "approved"
          ? { ...item, registered: !item.registered }
          : item
      )
    );
  };

  const approveCustomTool = (toolId: string) => {
    if (!isCurrentAdmin) {
      return;
    }

    setCustomTools((items) => {
      const target = items.find((item) => item.id === toolId);
      if (target?.approvalStatus === "pending") {
        window.queueMicrotask(() => {
          pushAppNotification({
            title: "툴 등록이 승인되었습니다",
            message: `${target.name} ${target.version}을 사용할 수 있습니다.`
          });
        });
      }

      return items.map((item) =>
        item.id === toolId ? { ...item, approvalStatus: "approved", registered: true } : item
      );
    });
  };

  const rejectCustomTool = async (toolId: string) => {
    if (!isCurrentAdmin) {
      return;
    }

    const target = customTools.find((item) => item.id === toolId);
    if (!target) {
      return;
    }

    let nextReviewState = target.reviewState;
    if (target.reviewNumber && target.reviewState === "open") {
      try {
        const result = await window.customTools?.rejectPullRequest(
          githubToolSource,
          target.reviewNumber
        );
        nextReviewState = result?.state ?? "closed";
      } catch (error) {
        pushAppNotification({
          title: "툴 거절 실패",
          message:
            error instanceof Error
              ? error.message
              : "GitHub PR을 닫지 못했습니다. 권한을 확인해주세요."
        });
        return;
      }
    }

    setCustomTools((items) => {
      if (target && target.approvalStatus !== "rejected") {
        window.queueMicrotask(() => {
          pushAppNotification({
            title: "툴 등록이 거절되었습니다",
            message: `${target.name} ${target.version} 등록 요청이 거절되었습니다.`
          });
        });
      }

      return items.map((item) =>
        item.id === toolId
          ? { ...item, approvalStatus: "rejected", registered: false, reviewState: nextReviewState }
          : item
      );
    });
  };

  const selectCustomToolVersion = (toolId: string, versionId: string) => {
    setCustomTools((items) =>
      items.map((item) => {
        if (item.id !== toolId) {
          return item;
        }

        const version = item.versions?.find((candidate) => candidate.id === versionId);
        if (!version) {
          return item;
        }

        return {
          ...item,
          version: version.version,
          author: version.author,
          description: version.description,
          isToolLike: version.isToolLike,
          riskWarnings: version.riskWarnings,
          toolSchema: version.toolSchema,
          sourcePath: version.sourcePath,
          installedPath: version.installedPath
        };
      })
    );
  };

  const removeCustomToolFromUi = (toolId: string) => {
    setCustomTools((items) => items.filter((item) => item.id !== toolId));
    setExpandedCustomToolIds((items) => items.filter((id) => id !== toolId));
    setOpenTabs((tabs) =>
      tabs.map((tab) => (tab.submenuKey?.endsWith(`:${toolId}`) ? { ...tab, submenuKey: null } : tab))
    );
  };

  function isCustomToolOwnedByCurrentUser(tool: CustomToolItem) {
    const author = tool.author.trim().toLowerCase();
    return [currentUserNickname, githubUser?.githubId]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.trim().toLowerCase() === author);
  }

  function canDeleteCustomTool(tool: CustomToolItem) {
    return isCurrentAdmin || isCustomToolOwnedByCurrentUser(tool);
  }

  const requestDeleteCustomTool = (toolId: string) => {
    const target = customTools.find((tool) => tool.id === toolId);
    if (!target || !canDeleteCustomTool(target)) {
      return;
    }

    setPendingDeleteCustomToolId(toolId);
  };

  const cancelDeleteCustomTool = () => {
    setPendingDeleteCustomToolId(null);
  };

  const confirmDeleteCustomTool = async () => {
    if (!pendingDeleteCustomToolId) {
      return;
    }

    const target = customTools.find((tool) => tool.id === pendingDeleteCustomToolId);
    if (!target) {
      setPendingDeleteCustomToolId(null);
      return;
    }
    if (!canDeleteCustomTool(target)) {
      setPendingDeleteCustomToolId(null);
      return;
    }

    const deletePaths = [target.installedPath, target.sourcePath].filter(
      (path): path is string => Boolean(path)
    );
    const githubDeletePaths = deletePaths.filter((path) => path.startsWith("github:"));
    if (githubDeletePaths.length > 0) {
      setDeletedGithubToolPaths((paths) => [
        ...paths,
        ...githubDeletePaths.filter((path) => !paths.includes(path))
      ]);
    }
    const deleteResults =
      deletePaths.length > 0 && window.customTools?.deleteToolFiles
        ? await window.customTools.deleteToolFiles(deletePaths)
        : [];
    const failedResults = deleteResults.filter(
      (result) => result.status === "failed" && !result.path.startsWith("github:")
    );
    const deleteRequestResults = deleteResults.filter((result) => result.status === "requested");

    removeCustomToolFromUi(target.id);
    setPendingDeleteCustomToolId(null);
    pushAppNotification({
      title:
        failedResults.length > 0
          ? "툴 삭제 일부 실패"
          : deleteRequestResults.length > 0
            ? "툴 삭제 PR 생성"
            : "툴 삭제 완료",
      message:
        failedResults.length > 0
          ? `${target.name}은 목록에서 제거됐지만 원본 파일 ${failedResults.length}개 삭제에 실패했습니다. 실패 경로: ${failedResults.map((result) => result.path).join(", ")}`
          : deleteRequestResults.length > 0
            ? `${target.name}은 내 목록에서 숨겼고, GitHub 원본 삭제는 PR 승인 후 반영됩니다.`
          : `${target.name}과 연결된 원본 파일을 삭제했습니다.`
    });
  };

  const toggleCustomToolDescription = (toolId: string) => {
    setExpandedCustomToolIds((items) =>
      items.includes(toolId) ? items.filter((id) => id !== toolId) : [...items, toolId]
    );
  };

  const revealCustomToolWarning = (toolId: string) => {
    setExpandedCustomToolIds((items) => (items.includes(toolId) ? items : [...items, toolId]));
  };

  const addSubmenu = (sectionId: SidebarSectionId) => {
    const id = `custom-${Date.now()}`;
    const item: SubmenuItem = {
      id,
      label: "새 페이지",
      description: `${sidebarLabel(sectionId)} MCP 툴을 정리하는 페이지입니다.`
    };

    setCustomSubmenus((current) => ({
      ...current,
      [sectionId]: [...(current[sectionId] ?? []), item]
    }));
    setSubmenuOrder((current) => ({
      ...current,
      [sectionId]: [
        ...getOrderedSubmenuItems(sectionId)
          .map((submenu) => submenu.id)
          .filter((submenuId) => submenuId !== "add"),
        id
      ]
    }));
    setExpandedSectionIds((ids) => (ids.includes(sectionId) ? ids : [...ids, sectionId]));
    navigateInCurrentTab({
      sectionId,
      title: item.label,
      source: "submenu",
      submenuKey: makeSubmenuKey(sectionId, id)
    });
  };

  const openSectionInNewTab = (sectionId: SidebarSectionId) => {
    const tab = createSectionTab(nextTabId(), sectionId, activeTab);
    setOpenTabs((tabs) => [...tabs, tab]);
    setActiveOpenTabId(tab.id);
  };

  const openSubmenuInNewTab = (sectionId: SidebarSectionId, submenuId: SubmenuId) => {
    const key = makeSubmenuKey(sectionId, submenuId);
    const tab = {
      ...createSectionTab(nextTabId(), sectionId, activeTab),
      title: getSubmenuLabel(sectionId, submenuId),
      sidebarSource: "submenu" as const,
      submenuKey: key
    };
    setOpenTabs((tabs) => [...tabs, tab]);
    setActiveOpenTabId(tab.id);
  };

  const openRegistryDialogAsTab = () => {
    const tab = {
      ...createSectionTab(nextTabId(), "servers", registryWorkspaceTab.id),
      title: registryWorkspaceTab.label
    };
    setOpenTabs((tabs) => [...tabs, tab]);
    setActiveOpenTabId(tab.id);
    setIsRegistryDialogOpen(false);
  };

  const openMonitorDialogAsTab = () => {
    const tab = createSectionTab(nextTabId(), "monitor", activeTab);
    setOpenTabs((tabs) => [...tabs, tab]);
    setActiveOpenTabId(tab.id);
    setIsMonitorDialogOpen(false);
  };

  const duplicateOpenTab = (tabId: string) => {
    const source = openTabs.find((tab) => tab.id === tabId);
    if (!source) {
      return;
    }

    const duplicated = duplicateTab(source, nextTabId());
    setOpenTabs((tabs) => [...tabs, duplicated]);
    setActiveOpenTabId(duplicated.id);
  };

  const togglePinnedOpenTab = (tabId: string) => {
    setOpenTabs((tabs) => tabs.map((tab) => (tab.id === tabId ? togglePinnedTab(tab) : tab)));
  };

  const closeOpenTab = (tabId: string) => {
    setOpenTabs((tabs) => {
      const nextTabs = closeTab(tabs, tabId);
      if (activeOpenTabId === tabId) {
        setActiveOpenTabId(nextTabs[Math.max(0, tabs.findIndex((tab) => tab.id === tabId) - 1)].id);
      }
      return nextTabs;
    });
  };

  const toggleFavoriteSection = (sectionId: SidebarSectionId) => {
    setFavoriteSectionIds((ids) =>
      ids.includes(sectionId) ? ids.filter((id) => id !== sectionId) : [...ids, sectionId]
    );
  };

  const toggleFavoriteSubmenu = (sectionId: SidebarSectionId, submenuId: SubmenuId) => {
    if (submenuId === "add") {
      return;
    }

    const key = makeSubmenuKey(sectionId, submenuId);
    setFavoriteSubmenuKeys((keys) =>
      keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]
    );
  };

  const toggleExpandedSection = (sectionId: SidebarSectionId) => {
    setExpandedSectionIds((ids) =>
      ids.includes(sectionId) ? ids.filter((id) => id !== sectionId) : [...ids, sectionId]
    );
  };

  const toggleExpandedFavoriteSection = (sectionId: SidebarSectionId) => {
    setExpandedFavoriteSectionIds((ids) =>
      ids.includes(sectionId) ? ids.filter((id) => id !== sectionId) : [...ids, sectionId]
    );
  };

  const moveSubmenu = (
    targetSectionId: SidebarSectionId,
    targetSubmenuId: SubmenuId,
    position: TabDropPosition
  ) => {
    if (
      !draggedSubmenu ||
      draggedSubmenu.sectionId !== targetSectionId ||
      draggedSubmenu.submenuId === targetSubmenuId ||
      targetSubmenuId === "add"
    ) {
      return;
    }

    setSubmenuOrder((current) => {
      const currentOrder = getOrderedSubmenuItems(targetSectionId)
        .map((item) => item.id)
        .filter((id) => id !== "add" && id !== draggedSubmenu.submenuId);
      const targetIndex = currentOrder.indexOf(targetSubmenuId);
      currentOrder.splice(
        position === "after" ? targetIndex + 1 : targetIndex,
        0,
        draggedSubmenu.submenuId
      );
      return { ...current, [targetSectionId]: currentOrder };
    });
    setDraggedSubmenu(null);
    setDragOverSubmenu(null);
  };

  const moveSidebarSection = (targetSectionId: SidebarSectionId, position: TabDropPosition) => {
    if (!draggedSectionId || draggedSectionId === targetSectionId) {
      return;
    }

    setSidebarOrder((order) => {
      const nextOrder = order.filter((id) => id !== draggedSectionId);
      const targetIndex = nextOrder.indexOf(targetSectionId);
      nextOrder.splice(position === "after" ? targetIndex + 1 : targetIndex, 0, draggedSectionId);
      return nextOrder;
    });
    setDragOverSection(null);
  };

  const startSidebarDrag = (
    event: DragEvent<HTMLButtonElement>,
    sectionId: SidebarSectionId
  ) => {
    const row = event.currentTarget.closest(".navRow");
    if (row instanceof HTMLElement) {
      const bounds = row.getBoundingClientRect();
      event.dataTransfer.setDragImage(row, event.clientX - bounds.left, event.clientY - bounds.top);
    }

    setDraggedSectionId(sectionId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sectionId);
  };

  const getSidebarDropPosition = (event: DragEvent<HTMLDivElement>): TabDropPosition => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY > bounds.top + bounds.height / 2 ? "after" : "before";
  };

  const openMonitorSection = () => {
    setIsMonitorDialogOpen(true);
  };

  const applyRegistryResult = (next: RegistryFile, preferredId: string) => {
    setRegistry(next);
    setSelectedId(getSelectedServerId(next, preferredId));
    if (!window.mcpRegistry) {
      window.localStorage.setItem(browserRegistryStorageKey, JSON.stringify(next));
    }
  };

  const startServerProcess = async (serverId: string) => {
    const api = window.mcpProcesses;
    if (!api) {
      setProcessActionMessage("현재 실행 환경에서는 MCP 프로세스 실행을 사용할 수 없습니다.");
      return;
    }

    try {
      const result = await api.startServer(serverId);
      applyProcessResult(result);
      setSelectedId(serverId);
      setProcessActionMessage("서버 실행 요청을 보냈습니다.");
    } catch (error) {
      setProcessActionMessage(error instanceof Error ? error.message : "서버 실행에 실패했습니다.");
    }
  };

  const stopServerProcess = async (serverId: string) => {
    const api = window.mcpProcesses;
    if (!api) {
      setProcessActionMessage("현재 실행 환경에서는 MCP 프로세스 중지를 사용할 수 없습니다.");
      return;
    }

    try {
      const result = await api.stopServer(serverId);
      applyProcessResult(result);
      setSelectedId(serverId);
      setProcessActionMessage("서버 중지 요청을 보냈습니다.");
    } catch (error) {
      setProcessActionMessage(error instanceof Error ? error.message : "서버 중지에 실패했습니다.");
    }
  };

  const checkRegisteredMcpServers = async () => {
    if (registry.servers.length === 0) {
      setAutoAddMessage("등록된 MCP 서버가 없습니다.");
      return;
    }

    setIsCheckingMcpStatus(true);
    setAutoAddMessage("MCP 서버 상태를 점검하는 중입니다.");

    const statusById = new Map<string, McpServerRecord["status"]>();
    await Promise.all(
      registry.servers.map(async (server) => {
        if (server.connectionType === "stdio") {
          const processState = processSnapshot.processes.find(
            (process) => process.serverId === server.id
          );
          statusById.set(server.id, processState?.status === "running" ? "running" : "stopped");
          return;
        }

        const urls = mcpHealthCheckUrls(server);
        for (const url of urls) {
          try {
            const controller = new AbortController();
            const timerId = window.setTimeout(() => controller.abort(), 1400);
            const response = await fetch(url, {
              method: "GET",
              signal: controller.signal,
              cache: "no-store"
            });
            window.clearTimeout(timerId);
            if (response.ok || response.status === 404 || response.status === 405) {
              statusById.set(server.id, "running");
              return;
            }
          } catch {
            // Try next known endpoint.
          }
        }
        statusById.set(server.id, "error");
      })
    );

    const nextRegistry = {
      ...registry,
      servers: registry.servers.map((server) => ({
        ...server,
        status: statusById.get(server.id) ?? server.status
      }))
    };
    applyRegistryResult(nextRegistry, selectedId);
    const running = nextRegistry.servers.filter((server) => server.status === "running").length;
    const failed = nextRegistry.servers.filter((server) => server.status === "error").length;
    setAutoAddMessage(`상태 점검 완료: 연결 ${running}개 / 오류 ${failed}개`);
    setIsCheckingMcpStatus(false);
  };

  const showSidebarContextMenu = (
    event: MouseEvent,
    sectionId: SidebarSectionId
  ) => {
    event.preventDefault();
    setContextMenu({
      type: "section",
      sectionId,
      x: event.clientX,
      y: event.clientY
    });
  };

  const showSubmenuContextMenu = (
    event: MouseEvent,
    sectionId: SidebarSectionId,
    submenuId: SubmenuId,
    source?: "recent"
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      type: "submenu",
      sectionId,
      submenuId,
      source,
      x: event.clientX,
      y: event.clientY
    });
  };

  const removeRecentSubmenu = (sectionId: SidebarSectionId, submenuId: SubmenuId) => {
    const key = makeSubmenuKey(sectionId, submenuId);
    setRecentSubmenuKeys((keys) => keys.filter((item) => item !== key));
  };

  const showTabContextMenu = (event: MouseEvent, tabId: string) => {
    event.preventDefault();
    setContextMenu({
      type: "tab",
      tabId,
      x: event.clientX,
      y: event.clientY
    });
  };

  const moveOpenTab = (targetTabId: string, position: TabDropPosition) => {
    if (!draggedTabId) {
      return;
    }

    setOpenTabs((tabs) => moveTab(tabs, draggedTabId, targetTabId, position));
    setDraggedTabId(null);
    setDragOverTab(null);
  };

  const moveOpenTabToEnd = () => {
    if (!draggedTabId) {
      return;
    }

    setOpenTabs((tabs) => moveTabToEnd(tabs, draggedTabId));
    setDraggedTabId(null);
    setDragOverTab(null);
    setIsTabEndDragOver(false);
  };

  const markTabEndDragOver = (event: DragEvent<HTMLElement>) => {
    if (!draggedTabId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverTab(null);
    setIsTabEndDragOver(true);
  };

  const getDropPosition = (event: MouseEvent<HTMLButtonElement>): TabDropPosition => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientX > bounds.left + bounds.width / 2 ? "after" : "before";
  };

  const getSubmenuDropPosition = (event: DragEvent<HTMLDivElement>): TabDropPosition => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY > bounds.top + bounds.height / 2 ? "after" : "before";
  };

  const startSidebarResize = (event: PointerEvent<HTMLDivElement>) => {
    if (isSidebarCollapsed) {
      return;
    }

    event.preventDefault();
    setIsResizingSidebar(true);
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    const resize = (pointerEvent: globalThis.PointerEvent) => {
      const nextWidth = Math.min(
        maxSidebarWidth,
        Math.max(minSidebarWidth, startWidth + pointerEvent.clientX - startX)
      );
      setSidebarWidth(nextWidth);
    };

    const stopResize = () => {
      setIsResizingSidebar(false);
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResize);
    };

    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize);
  };

  const renderSubmenuList = (
    section: (typeof sidebarSections)[number],
    source: "menu" | "favorite"
  ) => (
    <div className="submenuList">
      {getOrderedSubmenuItems(section.id).map((submenu) => {
        const key = makeSubmenuKey(section.id, submenu.id);
        const submenuSource = source === "favorite" ? "favoriteSubmenu" : "submenu";
        const isActive =
          activeSidebarSource === submenuSource &&
          activeSubmenuKey === key &&
          (source === "menu" || source === "favorite");

        return (
          <div
            key={key}
            className={[
              "submenuRow",
              submenu.id === "add" ? "addRow" : "",
              draggedSubmenu?.sectionId === section.id && draggedSubmenu.submenuId === submenu.id
                ? "dragging"
                : "",
              dragOverSubmenu?.sectionId === section.id &&
              dragOverSubmenu.submenuId === submenu.id &&
              dragOverSubmenu.position === "before"
                ? "dropBefore"
                : "",
              dragOverSubmenu?.sectionId === section.id &&
              dragOverSubmenu.submenuId === submenu.id &&
              dragOverSubmenu.position === "after"
                ? "dropAfter"
                : "",
              isActive ? "active" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            draggable={submenu.id !== "add"}
            onDragStart={(event) => {
              event.stopPropagation();
              if (submenu.id === "add") {
                return;
              }
              const row = event.currentTarget;
              const bounds = row.getBoundingClientRect();
              event.dataTransfer.setDragImage(
                row,
                event.clientX - bounds.left,
                event.clientY - bounds.top
              );
              setDragOverSection(null);
              setDraggedSectionId(null);
              setDraggedSubmenu({ sectionId: section.id, submenuId: submenu.id });
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", key);
              const workflowFlowMenu = parseWorkflowMenuFlowId(submenu.id);
              if (section.id === "workflow" && workflowFlowMenu) {
                const flow =
                  workflowFlowMenu.source === "shared"
                    ? sharedFlowCatalog.find((item) => item.id === workflowFlowMenu.flowId)
                    : workflowSavedFlowsForMenu.find((item) => item.id === workflowFlowMenu.flowId);
                if (flow) {
                  event.dataTransfer.effectAllowed = "copyMove";
                  event.dataTransfer.setData("application/x-custom-flow", serializeSavedFlowForDrag(flow));
                }
              }
              const flowToolId = flowToolIdFromMenuItem(section.id, submenu);
              if (flowToolId) {
                event.dataTransfer.effectAllowed = "copyMove";
                event.dataTransfer.setData("application/x-flow-tool", flowToolId);
              }
              event.dataTransfer.setData(
                "application/x-flow-tool-data",
                serializeFlowToolForDrag(section.id, submenu)
              );
            }}
            onDragOver={(event) => {
              event.stopPropagation();
              if (!draggedSubmenu || submenu.id === "add") {
                return;
              }
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOverSubmenu({
                sectionId: section.id,
                submenuId: submenu.id,
                position: getSubmenuDropPosition(event)
              });
            }}
            onDragLeave={(event) => {
              event.stopPropagation();
              setDragOverSubmenu((current) =>
                current?.sectionId === section.id && current.submenuId === submenu.id ? null : current
              );
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              moveSubmenu(section.id, submenu.id, getSubmenuDropPosition(event));
            }}
            onDragEnd={(event) => {
              event.stopPropagation();
              setDraggedSubmenu(null);
              setDragOverSubmenu(null);
            }}
          >
            <button
              className={[
                "submenuDragButton",
                submenu.id.startsWith("custom-tool-") ? "customToolDragButton" : "",
                submenu.id.startsWith("share-") ? "shareToolDragButton" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={`${submenu.label} 순서 변경`}
              tabIndex={-1}
              type="button"
            >
              <AppIcon name={submenuIconName(submenu.id)} className="submenuTypeIcon" />
            </button>
            <button
              className="submenuButton"
              onClick={(event) => {
                event.stopPropagation();
                openSubmenu(section.id, submenu.id, submenuSource);
              }}
              onContextMenu={(event) => showSubmenuContextMenu(event, section.id, submenu.id)}
            >
              {submenu.id === "add" ? "+" : submenu.label}
            </button>
          </div>
        );
      })}
    </div>
  );

  const activeSubmenuInfo = activeSubmenuKey ? parseSubmenuKey(activeSubmenuKey) : null;
  const activeSubmenuItem = activeSubmenuInfo
    ? getSubmenuItem(activeSubmenuInfo.sectionId, activeSubmenuInfo.submenuId)
    : null;
  const isWorkflowLibrarySubmenu =
    activeSubmenuInfo?.sectionId === "workflow" &&
    Boolean(parseWorkflowMenuFlowId(activeSubmenuInfo.submenuId));
  const activeWorkflowFlowMenu =
    activeSubmenuInfo?.sectionId === "workflow"
      ? parseWorkflowMenuFlowId(activeSubmenuInfo.submenuId)
      : null;
  const canEditActiveSavedWorkflow =
    activeWorkflowFlowMenu?.source === "saved" &&
    workflowSavedFlowsForMenu.some((flow) => flow.id === activeWorkflowFlowMenu.flowId);
  const activePageTitle = activeSubmenuItem
    ? activeSubmenuItem.label
    : activeOpenTab.workspaceTabId === registryWorkspaceTab.id
      ? registryWorkspaceTab.label
      : sidebarLabel(activeSidebarSection);
  const activePageSubtitle = activeSubmenuItem
    ? activeSubmenuItem.description
    : topbarSubtitle(activeServerWorkspace, activeSidebarSection);
  const displaySidebarSection = isCompact ? activeCompactSection : activeSidebarSection;
  const displayServerWorkspace = workspaceForSection(displaySidebarSection);
  const displayMcpReady = isMcpReadyForSection(displaySidebarSection, registry.servers);
  const displayDisabledToolReason = displayMcpReady ? "" : disabledToolReason(displaySidebarSection);
  const displaySubmenuInfo = isCompact ? null : activeSubmenuInfo;
  const displaySubmenuItem = isCompact || isWorkflowLibrarySubmenu ? null : activeSubmenuItem;
  const displayPageTitle = isCompact ? sidebarLabel(activeCompactSection) : activePageTitle;
  const displayPageSubtitle = isCompact
    ? topbarSubtitle(displayServerWorkspace, activeCompactSection)
    : activePageSubtitle;
  const displayCustomTool =
    displaySubmenuInfo
      ? customTools.find((tool) => tool.id === displaySubmenuInfo.submenuId)
      : undefined;
  const canEditDisplayHeader =
    Boolean(displaySubmenuInfo && (canEditActiveSavedWorkflow || canEditSubmenuHeader(displaySubmenuInfo)));
  const shouldShowServerMetrics =
    !isCompact &&
    (activeSidebarSection === "monitor" || activeOpenTab.workspaceTabId === registryWorkspaceTab.id);
  const customToolGroupRank = (tool: CustomToolItem) => {
    if (tool.registered) {
      return 0;
    }
    if (tool.pinned) {
      return 1;
    }
    return 2;
  };
  const compareCustomTools = (left: CustomToolItem, right: CustomToolItem) => {
    const groupDiff = customToolGroupRank(left) - customToolGroupRank(right);
    if (groupDiff !== 0) {
      return groupDiff;
    }

    if (!customToolSort) {
      return left.name.localeCompare(right.name, "ko");
    }

    const direction = customToolSort.direction === "asc" ? 1 : -1;
    if (customToolSort.field === "usageCount") {
      return (left.usageCount - right.usageCount) * direction;
    }

    const leftValue =
      customToolSort.field === "section" ? sidebarLabel(left.sectionId) : left[customToolSort.field];
    const rightValue =
      customToolSort.field === "section"
        ? sidebarLabel(right.sectionId)
        : right[customToolSort.field];

    return String(leftValue).localeCompare(String(rightValue), "ko") * direction;
  };

  const scopedCustomTools =
    customToolDialogScope === "all"
      ? [...customTools]
      : customTools.filter((tool) => tool.sectionId === customToolDialogScope);
  const customToolSearchTerm = customToolSearch.trim().toLowerCase();
  const visibleCustomTools = scopedCustomTools
    .filter((tool) => {
      if (customToolFilter === "risk") {
        return tool.riskWarnings.length > 0 || !tool.isToolLike;
      }
      if (customToolFilter === "pending") {
        return tool.approvalStatus === "pending";
      }
      return true;
    })
    .filter((tool) =>
      customToolSearchTerm
        ? [tool.name, tool.version, tool.author, sidebarLabel(tool.sectionId)]
            .concat(tool.description)
            .join(" ")
            .toLowerCase()
            .includes(customToolSearchTerm)
        : true
    )
    .sort(compareCustomTools);
  const customToolDialogTitle =
    customToolDialogScope === "all"
      ? "Market"
      : `${sidebarLabel(customToolDialogScope)} Custom Tools`;
  const isMarketDialog = customToolDialogScope === "all";
  const sharedFlowCatalog = useMemo(() => {
    const seen = new Set<string>();
    return [...sampleSharedFlows, ...listSavedFlows(sharedFlows)].filter((flow) => {
      if (seen.has(flow.id)) {
        return false;
      }
      seen.add(flow.id);
      return true;
    });
  }, [sharedFlows]);
  const myCustomTools = customTools.filter((tool) => isCustomToolOwnedByCurrentUser(tool)).sort(compareCustomTools);
  const showCompactCustomToolColumns = isCompact;

  const toggleCustomToolSort = (field: CustomToolSortField) => {
    setCustomToolSort((current) => {
      if (!current || current.field !== field) {
        return { field, direction: "desc" };
      }
      if (current.direction === "desc") {
        return { field, direction: "asc" };
      }
      return null;
    });
  };

  const renderSortHeader = (field: CustomToolSortField, label: string) => (
    <button className="sortHeaderButton" type="button" onClick={() => toggleCustomToolSort(field)}>
      <span>{label}</span>
      {customToolSort?.field === field ? (
        <span className="sortArrow">{customToolSort.direction === "desc" ? "↓" : "↑"}</span>
      ) : null}
    </button>
  );

  const renderToolNameHeader = () => (
    <div className="toolNameHeader">
      {renderSortHeader("name", "툴 이름")}
      <div className="tableFilterMenuWrap">
        <select
          className={customToolFilter === "all" ? "tableFilterSelect" : "tableFilterSelect active"}
          aria-label="툴 이름 필터"
          title="툴 이름 필터"
          value={customToolFilter}
          onChange={(event) => setCustomToolFilter(event.target.value as CustomToolFilter)}
        >
          {customToolFilterOptions.map(({ filter, label }) => (
            <option key={filter} value={filter}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const getAccountStatusLabel = (user: AccountUser) => {
    if (user.role === "admin") {
      return "관리자";
    }

    return user.status === "active" ? "활성" : "승인 대기";
  };

  const formatJoinedDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("ko-KR");
  };

  const formatToolCreatedDate = (value?: string) => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("ko-KR");
  };

  const compareAccountUsers = (left: AccountUser, right: AccountUser) => {
    if (!accountUserSort) {
      return 0;
    }

    const direction = accountUserSort.direction === "desc" ? -1 : 1;

    if (accountUserSort.field === "license") {
      return (Number(left.license) - Number(right.license)) * direction;
    }

    if (accountUserSort.field === "joinedAt") {
      return (new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime()) * direction;
    }

    const leftValue =
      accountUserSort.field === "status" ? getAccountStatusLabel(left) : left[accountUserSort.field];
    const rightValue =
      accountUserSort.field === "status"
        ? getAccountStatusLabel(right)
        : right[accountUserSort.field];

    return String(leftValue).localeCompare(String(rightValue), "ko", { numeric: true }) * direction;
  };

  const visibleAccountUsers = [...accountUsers].sort(compareAccountUsers);
  const pendingReviewTools = customTools.filter((tool) => tool.approvalStatus === "pending");

  const toggleAccountUserSort = (field: AccountUserSortField) => {
    setAccountUserSort((current) => {
      if (!current || current.field !== field) {
        return { field, direction: "desc" };
      }
      if (current.direction === "desc") {
        return { field, direction: "asc" };
      }
      return null;
    });
  };

  const renderAccountSortHeader = (field: AccountUserSortField, label: string) => (
    <button
      className="sortHeaderButton accountSortHeaderButton"
      type="button"
      onClick={() => toggleAccountUserSort(field)}
    >
      <span>{label}</span>
      {accountUserSort?.field === field ? (
        <span className="sortArrow">{accountUserSort.direction === "desc" ? "↓" : "↑"}</span>
      ) : null}
    </button>
  );

  const toolReviewLabel = (tool: CustomToolItem) => {
    if (!tool.reviewUrl && tool.reviewState === "merged") {
      return "공유 완료";
    }
    if (tool.reviewState === "merged") {
      return "머지됨";
    }
    if (tool.reviewState === "closed") {
      return "닫힘";
    }
    return "PR 대기";
  };

  const getMyToolStatusClass = (tool: CustomToolItem) => {
    if (tool.approvalStatus === "pending") {
      return "pending";
    }
    if (tool.approvalStatus === "rejected" || tool.reviewState === "closed") {
      return "rejected";
    }
    if (tool.reviewState === "open") {
      return "githubPending";
    }
    return "approved";
  };

  const getMyToolStatusLabel = (tool: CustomToolItem) => {
    if (tool.approvalStatus === "pending") {
      return "승인 대기";
    }
    if (tool.approvalStatus === "rejected") {
      return "관리자 거절";
    }
    if (tool.reviewState === "closed") {
      return "GitHub 닫힘";
    }
    if (tool.reviewState === "open") {
      return "GitHub 승인 대기";
    }
    return "승인";
  };

  const getTabWorkStatus = (_tab: AppTab): "running" | "done" | "error" | null => null;

  const updateSubmenuMeta = (
    sectionId: SidebarSectionId,
    submenuId: SubmenuId,
    patch: Partial<Pick<SubmenuItem, "label" | "description">>
  ) => {
    const key = makeSubmenuKey(sectionId, submenuId);
    const current = getSubmenuItem(sectionId, submenuId);
    const next = {
      label: patch.label ?? current.label,
      description: patch.description ?? current.description
    };

    setSubmenuMeta((items) => ({ ...items, [key]: next }));
    if (patch.label !== undefined) {
      setOpenTabs((tabs) =>
        tabs.map((tab) => (tab.submenuKey === key ? { ...tab, title: next.label } : tab))
      );
    }
  };

  const updateWorkflowSavedFlowDetails = (
    flowId: string,
    patch: { name?: string; description?: string }
  ) => {
    const request = {
      requestId: Date.now() + Math.random(),
      flowId,
      patch
    };
    setWorkflowDetailsUpdateRequest(request);
    setWorkflowSavedFlowsForMenu((flows) => updateSavedFlowDetails(flows, flowId, patch));
    if (patch.name !== undefined) {
      const nextTitle = patch.name.trim() || "새 페이지";
      const key = makeSubmenuKey("workflow", workflowMenuFlowId("saved", flowId));
      setOpenTabs((tabs) =>
        tabs.map((tab) => (tab.submenuKey === key ? { ...tab, title: nextTitle } : tab))
      );
    }
  };

  const shellClassName = [
    "appShell",
    isCompact ? "compactMode" : "",
    isSidebarCollapsed ? "sidebarCollapsed" : "",
    isResizingSidebar ? "resizingSidebar" : "",
    colorMode === "dark" ? "darkMode" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={shellClassName}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <nav className="appTabs" aria-label="열린 탭">
        <div className="tabStrip" ref={tabStripRef}>
          <div className="openTabs" ref={openTabsRef}>
            {openTabs.map((tab, index) => (
              <button
                key={tab.id}
                data-tab-id={tab.id}
                className={[
                  "openTab",
                  tab.id === activeOpenTabId ? "active" : "",
                  tab.isPinned ? "pinned" : "",
                  openTabs[index + 1]?.id === activeOpenTabId ? "beforeActive" : "",
                  tab.id === dragOverTab?.id && dragOverTab.position === "before"
                    ? "dragOverBefore"
                    : "",
                  (tab.id === dragOverTab?.id && dragOverTab.position === "after") ||
                  (isTabEndDragOver && tab.id === openTabs[openTabs.length - 1]?.id)
                    ? "dragOverAfter"
                    : "",
                  isTabEndDragOver && tab.id === openTabs[openTabs.length - 1]?.id
                    ? "dragOverEnd"
                    : "",
                  tab.id === draggedTabId ? "dragging" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                draggable
                onClick={() => setActiveOpenTabId(tab.id)}
                onContextMenu={(event) => showTabContextMenu(event, tab.id)}
                onDragStart={(event) => {
                  setDraggedTabId(tab.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", tab.id);
                }}
                onDragEnter={(event) =>
                  setDragOverTab({ id: tab.id, position: getDropPosition(event) })
                }
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverTab({ id: tab.id, position: getDropPosition(event) });
                }}
                onDragLeave={() =>
                  setDragOverTab((current) => (current?.id === tab.id ? null : current))
                }
                onDrop={(event) => {
                  event.preventDefault();
                  moveOpenTab(tab.id, getDropPosition(event));
                }}
                onDragEnd={() => {
                  setDraggedTabId(null);
                  setDragOverTab(null);
                  setIsTabEndDragOver(false);
                }}
              >
                {getTabWorkStatus(tab) ? (
                  <span
                    className={`tabWorkStatus ${getTabWorkStatus(tab)}`}
                    aria-label="작업 중"
                  />
                ) : null}
                <span className="openTabMeta">
                  <span className="tabLabelIcon">
                    <SidebarIcon sectionId={tab.sectionId} />
                  </span>
                  {tabMenuLabel(tab)}
                </span>
                <span className="openTabTitle">{tabSubmenuLabel(tab)}</span>
                <span
                  className="tabCloseButton"
                  role="button"
                  aria-label={`${tab.title} 닫기`}
                  onClick={(event) => {
                    event.stopPropagation();
                    closeOpenTab(tab.id);
                  }}
                >
                  ×
                </span>
              </button>
            ))}
          </div>
          <div className="tabControlSlot">
            {hiddenTabIds.length === 0 ? (
              <button
                className={
                  openTabs[openTabs.length - 1]?.id === activeOpenTabId
                    ? "newTabButton afterActive"
                    : "newTabButton"
                }
                aria-label="새 탭"
                onClick={openBlankTab}
                onDragEnter={markTabEndDragOver}
                onDragOver={markTabEndDragOver}
                onDrop={(event) => {
                  event.preventDefault();
                  moveOpenTabToEnd();
                }}
              >
                +
              </button>
            ) : (
              <button
                className={isTabOverflowOpen ? "tabOverflowButton active" : "tabOverflowButton"}
                type="button"
                aria-label="숨겨진 탭"
                aria-expanded={isTabOverflowOpen}
                onClick={(event) => {
                  event.stopPropagation();
                  setIsTabOverflowOpen((value) => !value);
                }}
              >
                ...
              </button>
            )}
          </div>
          {isTabOverflowOpen ? (
            <div
              className="tabOverflowMenu"
              role="menu"
              onClick={(event) => event.stopPropagation()}
            >
              {openTabs
                .filter((tab) => hiddenTabIds.includes(tab.id))
                .map((tab) => (
                  <button
                    key={tab.id}
                    className={[
                      "tabOverflowItem",
                      tab.id === activeOpenTabId ? "active" : "",
                      tab.id === dragOverTab?.id ? `dragOver${dragOverTab.position === "before" ? "Before" : "After"}` : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    type="button"
                    role="menuitem"
                    draggable
                    onClick={() => {
                      setActiveOpenTabId(tab.id);
                      setIsTabOverflowOpen(false);
                    }}
                    onDragStart={(event) => {
                      setDraggedTabId(tab.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", tab.id);
                    }}
                    onDragEnter={(event) =>
                      setDragOverTab({ id: tab.id, position: getDropPosition(event) })
                    }
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDragOverTab({ id: tab.id, position: getDropPosition(event) });
                    }}
                    onDragLeave={() =>
                      setDragOverTab((current) => (current?.id === tab.id ? null : current))
                    }
                    onDrop={(event) => {
                      event.preventDefault();
                      moveOpenTab(tab.id, getDropPosition(event));
                    }}
                    onDragEnd={() => {
                      setDraggedTabId(null);
                      setDragOverTab(null);
                      setIsTabEndDragOver(false);
                    }}
                  >
                    <span className="tabOverflowItemMain">
                      <span className="tabOverflowItemLabel">
                        <SidebarIcon sectionId={tab.sectionId} />
                        {tabMenuLabel(tab)}
                      </span>
                      <span
                        className="tabOverflowCloseButton"
                        role="button"
                        aria-label={`${tab.title} 닫기`}
                        onClick={(event) => {
                          event.stopPropagation();
                          closeOpenTab(tab.id);
                        }}
                      >
                        ×
                      </span>
                    </span>
                    <small>{tabSubmenuLabel(tab)}</small>
                  </button>
                ))}
              <button
                className="tabOverflowAddButton"
                type="button"
                role="menuitem"
                onClick={() => {
                  openBlankTab();
                  setIsTabOverflowOpen(false);
                }}
              >
                +
              </button>
            </div>
          ) : null}
        </div>
        <div
          className={isTabEndDragOver ? "tabEndDropZone active" : "tabEndDropZone"}
          aria-hidden="true"
          onDragEnter={markTabEndDragOver}
          onDragOver={markTabEndDragOver}
          onDragLeave={() => setIsTabEndDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            moveOpenTabToEnd();
          }}
        />
        <div className="topUtility">
          <button className="compactButton" onClick={toggleCompactMode}>
            {isCompact ? "Full view" : "Player view"}
          </button>
          {!isCompact ? (
            <button className="webViewButton" type="button" onClick={openWebView}>
              웹에서 보기
            </button>
          ) : null}
          <button
            className="connectionBadge"
            type="button"
            title={currentConnectionTooltip}
            onClick={() => void checkRegisteredMcpServers()}
            disabled={isCheckingMcpStatus}
          >
            <span className={`statusDot ${connectionSummary.tone}`} />
            <span>{isCheckingMcpStatus ? "MCP 점검 중" : connectionSummary.label}</span>
          </button>
          {autoAddMessage ? <span className="connectionNotice">{autoAddMessage}</span> : null}
        </div>
      </nav>

      <aside className="sidebar">
        <div className="brand">
          <div className="brandHeader">
            <strong>MCP 연결관리자</strong>
            <button
              className="sidebarToggle sidebarToggleInline"
              aria-label={isSidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
              onClick={() => {
                if (!isCompact) {
                  setIsSidebarCollapsed((value) => !value);
                }
              }}
            >
              <span className="sidebarToggleMark" aria-hidden="true">
                {isSidebarCollapsed ? "›" : "‹"}
              </span>
            </button>
          </div>
          <div className="brandMetaRow">
            <span className="brandVersion">v0.1.0</span>
            <button
              className={githubUser ? "authSidebarButton signedIn" : "authSidebarButton"}
              type="button"
              onClick={() => openAuthDialog(githubUser ? "profile" : "login")}
              title={githubUser ? "회원 정보" : "로그인"}
            >
              {githubUser ? `${currentUserNickname || githubUser.githubId}님` : "로그인"}
            </button>
          </div>
        </div>
        <button
          className="sidebarToggle sidebarToggleCollapsed"
          aria-label="메뉴 펼치기"
          onClick={() => {
            if (!isCompact) {
              setIsSidebarCollapsed(false);
            }
          }}
        >
          <span className="sidebarToggleMark" aria-hidden="true">
            ›
          </span>
        </button>
        <div className="sidebarScrollArea">
        {favoriteSectionIds.length > 0 || favoriteSubmenuKeys.length > 0 ? (
          <div className="favoriteGroup">
            <span className="sidebarLabel">즐겨찾기</span>
            {favoriteSectionIds.map((sectionId) => {
              const section = sidebarSections.find((item) => item.id === sectionId);
              if (!section) {
                return null;
              }

              return (
                <div
                  key={section.id}
                  className={[
                    "navRow",
                    "favoriteRow",
                    section.id === displaySidebarSection &&
                    (isCompact || activeSidebarSource === "favorite")
                      ? "active"
                      : "",
                    expandedFavoriteSectionIds.includes(section.id) ? "expanded" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                    <button className="navOrderButton" aria-label={`${section.label} 즐겨찾기 순서`}>
                      =
                    </button>
                  <button
                    className={
                      section.id === displaySidebarSection &&
                      (isCompact || activeSidebarSource === "favorite")
                        ? "navItem favorite active"
                        : "navItem favorite"
                    }
                    onClick={() => selectSidebarSection(section.id, "favorite")}
                    onContextMenu={(event) => showSidebarContextMenu(event, section.id)}
                  >
                    <span className="navShort">
                      <SidebarIcon sectionId={section.id} />
                    </span>
                    <span className="navFull">{section.label}</span>
                  </button>
                  <button
                    className="navExpandButton"
                    aria-label={`${section.label} 펼치기`}
                    aria-expanded={expandedFavoriteSectionIds.includes(section.id)}
                    onClick={() => toggleExpandedFavoriteSection(section.id)}
                  >
                    {expandedFavoriteSectionIds.includes(section.id) ? "▲" : "▼"}
                  </button>
                  {expandedFavoriteSectionIds.includes(section.id)
                    ? renderSubmenuList(section, "favorite")
                    : null}
                </div>
              );
            })}
            {favoriteSubmenuKeys.map((key) => {
              const { sectionId, submenuId } = parseSubmenuKey(key);
              const section = sidebarSections.find((item) => item.id === sectionId);
              if (!section) {
                return null;
              }

              return (
                <button
                  key={key}
                  className={[
                    "favoriteSubmenuButton",
                    activeSidebarSource === "favoriteSubmenu" && activeSubmenuKey === key
                      ? "active"
                      : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => selectSidebarSubmenu(sectionId, submenuId, "favoriteSubmenu")}
                  onContextMenu={(event) => showSubmenuContextMenu(event, sectionId, submenuId)}
                >
                  <AppIcon
                    name={submenuIconName(submenuId)}
                    className="submenuTypeIcon favoriteSubmenuIcon"
                  />
                  <span className="navFull">
                    {section.label} / {getSubmenuLabel(sectionId, submenuId)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        <span className="sidebarLabel navFull">메뉴</span>
        <button
          className="sidebarCollapsedHomeButton"
          type="button"
          onClick={selectHomePage}
          title="Home"
          aria-label="Home"
        >
          <SidebarIcon sectionId="home" />
        </button>
        <div className="sidebarMenuHeader navFull">
          <span className="sidebarLabel">메뉴</span>
          <button
            className={displaySidebarSection === "home" ? "sidebarHomeButton active" : "sidebarHomeButton"}
            type="button"
            onClick={selectHomePage}
            title="Home"
            aria-label="Home"
          >
            <SidebarIcon sectionId="home" />
          </button>
        </div>
        {menuSidebarSections.map((section) => (
          <div
            className={[
              "navRow",
              section.id === displaySidebarSection && (isCompact || activeSidebarSource === "menu")
                ? "active"
                : "",
              section.id === draggedSectionId ? "dragging" : "",
              expandedSectionIds.includes(section.id) ? "expanded" : "",
              dragOverSection?.id === section.id && dragOverSection.position === "before"
                ? "dropBefore"
                : "",
              dragOverSection?.id === section.id && dragOverSection.position === "after"
                ? "dropAfter"
                : ""
            ]
              .filter(Boolean)
              .join(" ")}
            key={section.id}
            onDragOver={(event) => {
              if (draggedSubmenu) {
                return;
              }
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOverSection({ id: section.id, position: getSidebarDropPosition(event) });
            }}
            onDragLeave={() => {
              setDragOverSection((current) => (current?.id === section.id ? null : current));
            }}
            onDrop={(event) => {
              if (draggedSubmenu) {
                return;
              }
              event.preventDefault();
              moveSidebarSection(section.id, getSidebarDropPosition(event));
              setDraggedSectionId(null);
              setDragOverSection(null);
            }}
          >
            <button
              className="navOrderButton"
              aria-label={`${section.label} 순서 변경`}
              draggable
              onDragStart={(event) => startSidebarDrag(event, section.id)}
              onDragEnd={() => {
                setDraggedSectionId(null);
                setDragOverSection(null);
              }}
            >
              =
            </button>
            <button
              className={
                section.id === displaySidebarSection && (isCompact || activeSidebarSource === "menu")
                  ? "navItem active"
                  : "navItem"
              }
              draggable
              onDragStart={(event) => startSidebarDrag(event, section.id)}
              onDragEnd={() => {
                setDraggedSectionId(null);
                setDragOverSection(null);
              }}
              onClick={() => selectSidebarSection(section.id, "menu")}
              onContextMenu={(event) => showSidebarContextMenu(event, section.id)}
            >
                <span className="navShort">
                  <SidebarIcon sectionId={section.id} />
                </span>
              <span className="navFull">{section.label}</span>
            </button>
            <button
              className="navExpandButton"
              aria-label={`${section.label} 펼치기`}
              aria-expanded={expandedSectionIds.includes(section.id)}
              onClick={() => toggleExpandedSection(section.id)}
            >
              {expandedSectionIds.includes(section.id) ? "▲" : "▼"}
            </button>
            {expandedSectionIds.includes(section.id) ? renderSubmenuList(section, "menu") : null}
          </div>
        ))}
        </div>
        <div className="recentSubmenuGroup">
          <div
            className="recentSubmenuHeader navFull"
          >
            <button
              className="recentToggleButton"
              type="button"
              aria-label={"\uCD5C\uADFC \uC0AC\uC6A9"}
              aria-expanded={isRecentSubmenuVisible}
              onClick={() => setIsRecentSubmenuVisible((visible) => !visible)}
            >
              최근 사용
            </button>
            <span className="sidebarLabel">최근 사용</span>
            <button
              className="recentClearButton"
              type="button"
              aria-label="최근 사용 모두 삭제"
              title="최근 사용 모두 삭제"
              disabled={recentSubmenuKeys.length === 0}
              onClick={(event) => {
                event.stopPropagation();
                setRecentSubmenuKeys([]);
              }}
            >
              <span aria-hidden="true" />
            </button>
          </div>
          {isRecentSubmenuVisible ? recentSubmenuKeys.map((key) => {
            const { sectionId, submenuId } = parseSubmenuKey(key);
            const section = sidebarSections.find((item) => item.id === sectionId);
            if (!section) {
              return null;
            }

            return (
              <button
                key={key}
                className={[
                  "recentSubmenuButton",
                  activeSidebarSource === "recent" && activeSubmenuKey === key ? "active" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => selectSidebarSubmenu(sectionId, submenuId, "recent")}
                onContextMenu={(event) =>
                  showSubmenuContextMenu(event, sectionId, submenuId, "recent")
                }
              >
                <span className="navFull">
                  {section.label} / {getSubmenuLabel(sectionId, submenuId)}
                </span>
              </button>
            );
          }) : null}
        </div>
        <button
          className="sidebarMarketButton"
          type="button"
          onClick={() => openCustomToolDialog("all")}
        >
          <span className="navShort" aria-hidden="true">
            <AppIcon name="market" className="utilityIcon" />
          </span>
          <span className="navFull">
            <AppIcon name="market" className="utilityIcon" />
            <span>Market</span>
          </span>
        </button>
        <div className="sidebarUtilityGrid">
          <button
            className={activeSidebarSection === "monitor" ? "sidebarMonitorButton active" : "sidebarMonitorButton"}
            onClick={openMonitorSection}
          >
            <span className="navShort" aria-hidden="true">
              <AppIcon name="monitor" className="utilityIcon" />
            </span>
            <span className="navFull">
              <AppIcon name="monitor" className="utilityIcon" />
              <span>Monitor</span>
            </span>
          </button>
          <button
            className="sidebarSettingsButton"
            aria-label="Settings"
            title="Settings"
            onClick={() => setIsRegistryDialogOpen(true)}
          >
            <span className="navShort settingsGlyphSlot" aria-hidden="true">
              <AppIcon name="settings" className="utilityIcon" />
            </span>
            <span className="navFull">
              <AppIcon name="settings" className="utilityIcon" />
              <span>Settings</span>
            </span>
          </button>
        </div>
        <div
          className="sidebarResizeHandle"
          role="separator"
          aria-label="메뉴 너비 조절"
          aria-orientation="vertical"
          onPointerDown={startSidebarResize}
        />
      </aside>

      <main className={shouldShowServerMetrics ? "main" : "main noMetrics"}>
        <header className="topbar">
          <div className={canEditDisplayHeader && (displaySubmenuItem || canEditActiveSavedWorkflow) && !displayCustomTool ? "topbarTitle editable" : "topbarTitle"}>
            {displayCustomTool ? (
              <>
                <div className="topbarTitleRow">
                  <h1>{displayCustomTool.name}</h1>
                  <span className="customToolMetaBadge">
                    {displayCustomTool.author} · v{displayCustomTool.version}
                  </span>
                </div>
                <p>{displayCustomTool.description || "등록된 설명이 없습니다."}</p>
              </>
            ) : canEditActiveSavedWorkflow && activeWorkflowFlowMenu ? (
              <>
                <EditableText
                  label=""
                  value={displayPageTitle}
                  className="topbarTitleField"
                  onChange={(value) =>
                    updateWorkflowSavedFlowDetails(activeWorkflowFlowMenu.flowId, {
                      name: value
                    })
                  }
                />
                <EditableText
                  label=""
                  value={displayPageSubtitle}
                  multiline
                  className="topbarSubtitleField"
                  onChange={(value) =>
                    updateWorkflowSavedFlowDetails(activeWorkflowFlowMenu.flowId, {
                      description: value
                    })
                  }
                />
              </>
            ) : displaySubmenuInfo && displaySubmenuItem && canEditDisplayHeader ? (
              <>
                <EditableText
                  label=""
                  value={displayPageTitle}
                  className="topbarTitleField"
                  onChange={(value) =>
                    updateSubmenuMeta(displaySubmenuInfo.sectionId, displaySubmenuInfo.submenuId, {
                      label: value
                    })
                  }
                />
                <EditableText
                  label=""
                  value={displayPageSubtitle}
                  multiline
                  className="topbarSubtitleField"
                  onChange={(value) =>
                    updateSubmenuMeta(displaySubmenuInfo.sectionId, displaySubmenuInfo.submenuId, {
                      description: value
                    })
                  }
                />
              </>
            ) : displaySubmenuInfo && displaySubmenuItem ? (
              <>
                <h1>{displayPageTitle}</h1>
                <p>{displayPageSubtitle}</p>
              </>
            ) : (
              <>
                <h1>{displayPageTitle}</h1>
                <p>{displayPageSubtitle}</p>
              </>
            )}
          </div>
          <div className="historyControls" aria-label="화면 이동">
            <button type="button" aria-label="뒤로가기" disabled={backHistory.length === 0} onClick={goBack}>
              ←
            </button>
            <button
              type="button"
              aria-label="앞으로가기"
              disabled={forwardHistory.length === 0}
              onClick={goForward}
            >
              →
            </button>
          </div>
        </header>

        {shouldShowServerMetrics ? (
          <section className="metrics">
            <Metric label="등록 서버" value={registry.servers.length} />
            <Metric label="연결 서버" value={runningCount} />
            <Metric label="미연결 서버" value={disconnectedCount} />
            <Metric label="작업공간" value={workspaceTabs.length} />
          </section>
        ) : null}

        {displaySubmenuInfo && displaySubmenuItem ? (
          <SubmenuPage
            menuLabel={sidebarLabel(displaySubmenuInfo.sectionId)}
            submenu={displaySubmenuItem}
          />
        ) : null}

        {!displaySubmenuItem && displaySidebarSection === "home" ? (
          <HomeDashboard
            customTools={customTools}
            onInstallSaveTool={installSaveToolSkill}
            onInstallMcpToolBuilder={installMcpToolBuilderSkill}
            onInstallProgramMcpRegistrar={installProgramMcpRegistrarSkill}
          />
        ) : null}

        {!displaySubmenuItem && displaySidebarSection === "workflow" ? (
          <WorkflowErrorBoundary>
            <WorkflowView
              createRequest={workflowCreateRequest}
              homeRequestId={workflowHomeRequestId}
              openRequest={workflowOpenRequest}
              detailsUpdateRequest={workflowDetailsUpdateRequest}
              sharedFlows={sharedFlowCatalog}
              onCreateRequestConsumed={() => setWorkflowCreateRequest(null)}
              onOpenFlowMarket={() => openCustomToolDialog("all", "flows")}
              onNotify={pushAppNotification}
              onSavedFlowsChange={setWorkflowSavedFlowsForMenu}
              onSavedFlowOpened={(flow, source) => {
                navigateInCurrentTab({
                  sectionId: "workflow",
                  title: flow.name,
                  source,
                  submenuKey: makeSubmenuKey("workflow", workflowMenuFlowId("saved", flow.id))
                });
              }}
              onSaveSubflowTool={(tool) => {
                setCustomTools((items) => [
                  tool,
                  ...items.filter((item) => item.id !== tool.id)
                ]);
                pushAppNotification({
                  title: "Custom Flow 툴 저장",
                  message: `${tool.name} 그룹을 다시 사용할 수 있는 커스텀 툴로 저장했습니다.`
                });
              }}
            />
          </WorkflowErrorBoundary>
        ) : null}

        {!displaySubmenuItem &&
        displaySidebarSection !== "monitor" &&
        displaySidebarSection !== "home" &&
        displaySidebarSection !== "workflow" ? (
          <ToolWorkspaceView
            menuLabel={sidebarLabel(displaySidebarSection)}
            tools={getToolsForWorkspace(workspaceForSection(displaySidebarSection))}
            customTools={customTools.filter(
              (tool) => tool.sectionId === displaySidebarSection && tool.registered
            )}
            isCompact={isCompact}
            isMcpReady={displayMcpReady}
            disabledReason={displayDisabledToolReason}
            onAddCustomTool={() => openCustomToolDialog(displaySidebarSection)}
            onCustomToolContext={(event, toolId) => {
              event.preventDefault();
              setContextMenu({
                type: "customTool",
                toolId,
                x: event.clientX,
                y: event.clientY
              });
            }}
            onOpenTool={(submenuId) =>
              isCompact
                ? setActiveCompactSection(displaySidebarSection)
                : openSubmenu(displaySidebarSection, submenuId)
            }
          />
        ) : null}

        {!displaySubmenuItem && displaySidebarSection === "monitor" ? (
          <MonitorView
            runningCount={runningCount}
            totalCount={registry.servers.length}
            processes={processSnapshot.processes}
            logs={processSnapshot.logs}
          />
        ) : null}
      </main>

      {!isAccountAccessAllowed ? (
        <div className="licenseGate">
          <section className="licenseGatePanel">
            <strong>
              {!githubUser
                ? "로그인이 필요합니다."
                : isSignupApproved
                  ? "라이선스가 필요합니다."
                  : "관리자 승인이 필요합니다."}
            </strong>
            <span>
              {!githubUser
                ? "GitHub 계정으로 로그인해야 이 프로그램을 사용할 수 있습니다."
                : isSignupApproved
                  ? "관리자가 라이선스를 부여한 계정만 이 프로그램을 사용할 수 있습니다."
                  : "현재 계정은 승인 대기 상태입니다. 관리자 승인 후 사용할 수 있습니다."}
            </span>
            <button
              className="primaryAction"
              type="button"
              onClick={() => openAuthDialog(githubUser ? "profile" : "login")}
            >
              {githubUser ? "계정 정보 보기" : "로그인"}
            </button>
          </section>
        </div>
      ) : null}

      {isAuthDialogOpen ? (
        <div className="dialogBackdrop authDialogBackdrop" role="presentation">
          <section
            className="registryDialog authDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="authDialogTitle"
          >
            <div className="dialogHeader">
              <div>
                <h2 id="authDialogTitle">
                  {authDialogMode === "profile"
                    ? "회원 정보"
                    : authDialogMode === "signup"
                      ? "회원가입"
                      : "로그인"}
                </h2>
                <span>
                  {authDialogMode === "profile"
                    ? "GitHub 연결 정보와 닉네임을 관리합니다."
                    : "GitHub 계정으로 앱 시작에 필요한 정보를 연결합니다."}
                </span>
              </div>
              <div className="dialogHeaderActions">
                <button
                  className="dialogWindowButton"
                  aria-label="닫기"
                  title="닫기"
                  onClick={() => setIsAuthDialogOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div className="dialogContent authDialogContent">
              {authDialogMode === "login" ? (
                <div className="authStartPanel">
                  <button
                    className="githubLoginButton"
                    type="button"
                    onClick={startGitHubLogin}
                    disabled={isAuthBusy}
                  >
                    <span className="githubMark" aria-hidden="true">
                      GH
                    </span>
                    GitHub로 로그인
                  </button>
                  {authDevice ? (
                    <div className="authDevicePanel">
                      <span>GitHub 인증 코드</span>
                      <strong>{authDevice.userCode}</strong>
                      <small>{authDevice.verificationUri}</small>
                      <button
                        className="primaryAction"
                        type="button"
                        onClick={completeGitHubLogin}
                        disabled={isAuthBusy}
                      >
                        인증 완료 확인
                      </button>
                    </div>
                  ) : null}
                  <button
                    className="secondaryAction authSignupButton"
                    type="button"
                    onClick={() => {
                      setAuthDialogMode("signup");
                      setAuthDraft({ githubId: "", nickname: "" });
                      setAuthDevice(null);
                      setAuthMessage("");
                    }}
                  >
                    회원가입
                  </button>
                  {authMessage ? <p className="authHint">{authMessage}</p> : null}
                </div>
              ) : (
                <div className="authForm">
                  <label className="field">
                    GitHub ID
                    <input
                      value={authDraft.githubId}
                      readOnly
                      placeholder="GitHub 연결 후 자동 입력"
                    />
                  </label>
                  <label className="field">
                    닉네임
                    <input
                      value={authDraft.nickname}
                      onChange={(event) =>
                        setAuthDraft((current) => ({
                          ...current,
                          nickname: event.target.value
                        }))
                      }
                      placeholder="앱에 표시할 닉네임"
                    />
                  </label>
                  <div className="authProfilePreview">
                    <strong>{authDraft.nickname.trim() || "닉네임"}님</strong>
                    <span>
                      {authDraft.githubId
                        ? `${authDraft.githubId} 계정과 연결되었습니다.`
                        : "GitHub 계정을 연결하면 제작자 이름으로 표시됩니다."}
                    </span>
                  </div>
                  {authDialogMode === "signup" ? (
                    <>
                      <button
                        className="githubLoginButton"
                        type="button"
                        onClick={startGitHubLogin}
                        disabled={isAuthBusy}
                      >
                        <span className="githubMark" aria-hidden="true">
                          GH
                        </span>
                        GitHub ID 연결
                      </button>
                      {authDevice ? (
                        <div className="authDevicePanel">
                          <span>GitHub 인증 코드</span>
                          <strong>{authDevice.userCode}</strong>
                          <small>{authDevice.verificationUri}</small>
                          <button
                            className="primaryAction"
                            type="button"
                            onClick={completeGitHubLogin}
                            disabled={isAuthBusy}
                          >
                            인증 완료 확인
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  {authMessage ? <p className="authHint">{authMessage}</p> : null}
                  <div className="dialogFooterActions">
                    {githubUser ? (
                      <button
                        className="secondaryAction dangerAction"
                        type="button"
                        onClick={logoutGitHubUser}
                        disabled={isAuthBusy}
                      >
                        로그아웃
                      </button>
                    ) : null}
                    <button
                      className="primaryAction"
                      type="button"
                      onClick={saveGitHubProfile}
                      disabled={!githubUser || !authDraft.nickname.trim() || isAuthBusy}
                    >
                      저장
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {isRegistryDialogOpen ? (
        <div className="dialogBackdrop" role="presentation">
          <section
            className="registryDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="registryDialogTitle"
          >
            <div className="dialogHeader">
              <div>
                <h2 id="registryDialogTitle">Settings</h2>
                <span>MCP 서버, 화면 모드, 계정과 권한 정책을 설정합니다.</span>
              </div>
              <div className="dialogHeaderActions">
                <button
                  className="dialogWindowButton"
                  aria-label="탭으로 열기"
                  title="탭으로 열기"
                  onClick={openRegistryDialogAsTab}
                >
                  <PopoutIcon />
                </button>
                <button
                  className="dialogWindowButton"
                  aria-label="닫기"
                  title="닫기"
                  onClick={() => setIsRegistryDialogOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div className="dialogBody">
              <nav className="dialogNav" aria-label="설정 메뉴">
                {settingsSections.map((section) => (
                  <button
                    key={section.id}
                    disabled={section.id === "management" && !isCurrentAdmin}
                    title={
                      section.id === "management" && !isCurrentAdmin
                        ? "관리자 계정에서만 사용할 수 있습니다."
                        : section.label
                    }
                    className={
                      section.id === activeSettingsSection
                        ? "dialogNavItem active"
                        : "dialogNavItem"
                    }
                    onClick={() => setActiveSettingsSection(section.id)}
                  >
                    {section.label}
                  </button>
                ))}
              </nav>

              <div className="dialogContent">
                {activeSettingsSection === "servers" ? (
                  <>
                    <section className="dialogPanel collapsibleSettingsPanel">
                      <div className="settingsCollapseHeader staticSettingsHeader">
                        <div>
                          <h2>MCP 서버</h2>
                          <span className="panelHeaderNote">
                            등록 {registry.servers.length}개 · 연결 {runningCount}개 · 미연결 {disconnectedCount}개
                          </span>
                        </div>
                      </div>
                          <div className="dialogSummary">
                            <Metric label="등록 서버" value={registry.servers.length} />
                            <Metric label="연결 서버" value={runningCount} />
                            <Metric label="미연결 서버" value={disconnectedCount} />
                          </div>
                          <div className="dialogServerGrid">
                            <section className="dialogPanel">
                              <div className="panelHeader">
                                <h2>서버 목록</h2>
                                <span className="panelHeaderNote">등록된 MCP 서버를 선택하면 상세 정보를 확인할 수 있습니다.</span>
                              </div>
                              <table>
                                <thead>
                                  <tr>
                                    <th>이름</th>
                                    <th>대상</th>
                                    <th>상태</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {registry.servers.map((server) => (
                                    <tr
                                      key={server.id}
                                      className={!isCreatingServer && server.id === selectedId ? "selectedRow" : ""}
                                      onClick={() => {
                                        setIsCreatingServer(false);
                                        setSelectedId((current) => (current === server.id ? "" : server.id));
                                        setRegistryError("");
                                      }}
                                    >
                                      <td>{server.name}</td>
                                      <td>{targetLabel(server.target)}</td>
                                      <td>{statusLabel(server.status)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {selectedRegistryServer ? (
                              <div className="inlineServerDetail">
                              <div className="panelHeader">
                                <h2>선택 서버 상세</h2>
                              </div>
                                <div className="details serverEditor">
                                  <label className="field">
                                    <span>서버 이름</span>
                                    <input
                                      value={serverDraft.name}
                                      readOnly
                                    />
                                  </label>
                                  <label className="field">
                                    <span>대상</span>
                                    <select
                                      value={serverDraft.target}
                                      disabled
                                    >
                                <option value="cad">CAD</option>
                                <option value="revit">Revit</option>
                                <option value="excel">Excel</option>
                                <option value="tekla">Tekla</option>
                                <option value="other">Other</option>
                              </select>
                                  </label>
                                  <label className="field">
                                    <span>연결 방식</span>
                                    <select
                                      value={serverDraft.connectionType}
                                      disabled
                                    >
                                      <option value="http">HTTP</option>
                                      <option value="sse">SSE</option>
                                      <option value="stdio">STDIO</option>
                                    </select>
                                  </label>
                                  <label className="field">
                                    <span>연결 URL</span>
                                    <input
                                      value={serverDraft.url}
                                      readOnly
                                    />
                                  </label>
                                  <label className="field">
                                    <span>포트</span>
                                    <input
                                      inputMode="numeric"
                                      value={serverDraft.port}
                                      readOnly
                                    />
                                  </label>
                                  <label className="field">
                                    <span>실행 명령</span>
                                    <input
                                      value={serverDraft.launchCommand}
                                      readOnly
                                    />
                                  </label>
                                  <label className="field">
                                    <span>작업 폴더</span>
                                    <input
                                      value={serverDraft.workingDirectory}
                                      readOnly
                                    />
                                  </label>
                                  <label className="field">
                                    <span>메모</span>
                                    <textarea
                                      value={serverDraft.notes}
                                      readOnly
                                    />
                                  </label>
                                  {registryError ? <p className="formError">{registryError}</p> : null}
                                  {processActionMessage ? (
                                    <p className="processActionMessage">{processActionMessage}</p>
                                  ) : null}
                                  <div className="serverEditorActions">
                                    <button
                                      className="secondaryAction"
                                      type="button"
                                      disabled={
                                        isSelectedServerRunning ||
                                        !selectedRegistryServer?.launchCommand.trim()
                                      }
                                      onClick={() =>
                                        selectedRegistryServer
                                          ? startServerProcess(selectedRegistryServer.id)
                                          : undefined
                                      }
                                    >
                                      실행
                                    </button>
                                    <button
                                      className="secondaryAction"
                                      type="button"
                                      disabled={!isSelectedServerRunning}
                                      onClick={() =>
                                        selectedRegistryServer
                                          ? stopServerProcess(selectedRegistryServer.id)
                                          : undefined
                                      }
                                    >
                                      중지
                                    </button>
                                  </div>
                                </div>
                              </div>
                              ) : null}
                            </section>
                          </div>
                    </section>
                  </>
                ) : activeSettingsSection === "ai" ? (
                  <section className="dialogPanel accountSettingsPanel aiSettingsPanel">
                    <div className="panelHeader">
                      <h2>AI 연결</h2>
                      <span className="panelHeaderNote">
                        실행 버튼에서 OpenAI API를 직접 호출할 수 있도록 이 컴퓨터의 API 키와 모델을 설정합니다.
                      </span>
                    </div>
                    <div className="accountInfoGrid aiInfoGrid">
                      <div className="accountInfoCard">
                        <strong>
                          {openAiSettingsStatus?.configured ? "연결 준비됨" : "API 키 필요"}
                        </strong>
                        <span>
                          {openAiSettingsStatus?.source === "stored"
                            ? "설정창에 저장된 API 키를 사용합니다."
                            : openAiSettingsStatus?.source === "environment"
                              ? "환경 변수 API 키를 사용합니다."
                              : "API 키를 저장하면 툴 실행 시 AI 계획을 생성합니다."}
                        </span>
                      </div>
                      <div className="accountInfoCard">
                        <strong>{openAiSettingsStatus?.model ?? openAiModelDraft}</strong>
                        <span>사용 모델</span>
                      </div>
                      <div className="accountInfoCard">
                        <strong>
                          {openAiSettingsStatus?.encryptionAvailable === false
                            ? "암호화 불가"
                            : "암호화 저장"}
                        </strong>
                        <span>
                          {openAiSettingsStatus?.updatedAt
                            ? `마지막 저장: ${new Date(openAiSettingsStatus.updatedAt).toLocaleString()}`
                            : "API 키 값은 화면에 다시 표시하지 않습니다."}
                        </span>
                      </div>
                    </div>
                    <div className="openAiSettingsForm">
                      <label className="field">
                        <span>OpenAI API 키</span>
                        <input
                          autoComplete="off"
                          placeholder={
                            openAiSettingsStatus?.configured
                              ? "새 키를 입력하면 기존 키를 교체합니다."
                              : "sk-..."
                          }
                          type="password"
                          value={openAiApiKeyDraft}
                          onChange={(event) => setOpenAiApiKeyDraft(event.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>모델</span>
                        <input
                          placeholder={openAiToolRunnerDefaultModel}
                          value={openAiModelDraft}
                          onChange={(event) => setOpenAiModelDraft(event.target.value)}
                        />
                      </label>
                      {openAiSettingsMessage ? (
                        <p className="openAiSettingsMessage">{openAiSettingsMessage}</p>
                      ) : null}
                      <div className="accountSettingsActions">
                        <button
                          className="secondaryAction"
                          disabled={isOpenAiSettingsBusy}
                          type="button"
                          onClick={() => void saveOpenAiSettings()}
                        >
                          저장
                        </button>
                        <button
                          className="secondaryAction"
                          disabled={isOpenAiSettingsBusy}
                          type="button"
                          onClick={() => void refreshOpenAiSettings()}
                        >
                          새로고침
                        </button>
                        <button
                          className="secondaryAction dangerAction"
                          disabled={isOpenAiSettingsBusy || openAiSettingsStatus?.source !== "stored"}
                          type="button"
                          onClick={() => void clearOpenAiSettings()}
                        >
                          저장된 키 삭제
                        </button>
                      </div>
                    </div>
                  </section>
                ) : activeSettingsSection === "display" ? (
                  <section className="dialogPanel displayModePanel">
                    <div className="panelHeader">
                      <h2>화면 모드</h2>
                    </div>
                    <div className="displayModeList">
                      {colorModeOptions.map((option) => (
                        <button
                          key={option.id}
                          className={
                            colorMode === option.id
                              ? "displayModeOption active"
                              : "displayModeOption"
                          }
                          onClick={() => setColorMode(option.id)}
                        >
                          <strong>{option.label}</strong>
                          <span>{option.description}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : activeSettingsSection === "account" ? (
                  <section className="dialogPanel accountSettingsPanel">
                    <div className="panelHeader">
                      <h2>계정 정보</h2>
                      <span className="panelHeaderNote">
                        GitHub 로그인 상태와 현재 계정의 프로그램 사용 권한을 확인합니다.
                      </span>
                    </div>
                    <div className="accountInfoGrid">
                      <div className="accountInfoCard">
                        <strong>{githubUser ? `${currentUserNickname || githubUser.githubId}님` : "로그인이 필요합니다."}</strong>
                        <span>{githubUser ? `GitHub: ${githubUser.githubId}` : "GitHub 계정으로 로그인하세요."}</span>
                      </div>
                      <div className="accountInfoCard">
                        <strong>{isCurrentAdmin ? "관리자" : "사용자"}</strong>
                        <span>{isCurrentAdmin ? "관리 메뉴를 사용할 수 있습니다." : "관리자 권한이 없습니다."}</span>
                      </div>
                      <div className="accountInfoCard">
                        <strong>{isLicenseAllowed ? "사용 가능" : "라이선스 필요"}</strong>
                        <span>
                          {accountPolicy.licenseMode === "all"
                            ? "현재는 모든 사용자가 프로그램을 사용할 수 있습니다."
                            : "라이선스가 있는 계정만 프로그램을 사용할 수 있습니다."}
                        </span>
                      </div>
                    </div>
                    <div className="accountSettingsActions">
                      <button
                        className="secondaryAction"
                        type="button"
                        onClick={() => openAuthDialog(githubUser ? "profile" : "login")}
                      >
                        {githubUser ? "회원 정보 수정" : "로그인"}
                      </button>
                      {githubUser ? (
                        <button className="secondaryAction dangerAction" type="button" onClick={logoutGitHubUser}>
                          로그아웃
                        </button>
                      ) : null}
                    </div>
                  </section>
                ) : (
                  <section className="dialogPanel accountSettingsPanel">
                    <div className="panelHeader">
                      <h2>관리</h2>
                      <span className="panelHeaderNote">
                        회원 승인, 라이선스 활성화, 커스텀 툴 등록 정책을 관리합니다.
                      </span>
                    </div>
                    {!isCurrentAdmin ? (
                      <div className="accountLockedPanel">
                        <strong>관리자 전용 기능입니다.</strong>
                        <span>`{githubToolSource.owner}` GitHub 계정으로 로그인하면 활성화됩니다.</span>
                      </div>
                    ) : (
                      <>
                        <div className="adminPolicyGrid">
                          <div className="adminPolicyCard">
                            <strong>회원가입 방식</strong>
                            <span>새 계정 승인 방식을 선택합니다.</span>
                            <div className="segmentedControl adminSegmentedControl">
                              <button
                                className={accountPolicy.signupMode === "open" ? "active" : ""}
                                type="button"
                                onClick={() => updateAccountPolicy("signupMode", "open")}
                              >
                                자유 가입
                              </button>
                              <button
                                className={accountPolicy.signupMode === "approval" ? "active" : ""}
                                type="button"
                                onClick={() => updateAccountPolicy("signupMode", "approval")}
                              >
                                승인제
                              </button>
                            </div>
                          </div>
                          <div className="adminPolicyCard">
                            <strong>라이선스 사용</strong>
                            <span>프로그램 사용 제한 방식을 선택합니다.</span>
                            <div className="segmentedControl adminSegmentedControl">
                              <button
                                className={accountPolicy.licenseMode === "all" ? "active" : ""}
                                type="button"
                                onClick={() => updateAccountPolicy("licenseMode", "all")}
                              >
                                모두 사용
                              </button>
                              <button
                                className={accountPolicy.licenseMode === "licensed" ? "active" : ""}
                                type="button"
                                onClick={() => updateAccountPolicy("licenseMode", "licensed")}
                              >
                                라이선스만
                              </button>
                            </div>
                          </div>
                          <div className="adminPolicyCard">
                            <strong>툴 등록 방식</strong>
                            <span>커스텀 툴 승인 방식을 선택합니다.</span>
                            <div className="segmentedControl adminSegmentedControl">
                              <button
                                className={
                                  accountPolicy.toolRegistrationMode === "open" ? "active" : ""
                                }
                                type="button"
                                onClick={() => updateAccountPolicy("toolRegistrationMode", "open")}
                              >
                                자유 등록
                              </button>
                              <button
                                className={
                                  accountPolicy.toolRegistrationMode === "approval" ? "active" : ""
                                }
                                type="button"
                                onClick={() =>
                                  updateAccountPolicy("toolRegistrationMode", "approval")
                                }
                              >
                                승인제
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="accountUserList">
                          <div className="panelHeader compactPanelHeader">
                            <h2>회원 목록</h2>
                            <span className="panelHeaderNote">
                              승인제 회원가입의 승인 대기 계정은 이 목록에 표시됩니다.
                            </span>
                          </div>
                          <table>
                            <thead>
                              <tr>
                                <th>{renderAccountSortHeader("githubId", "계정")}</th>
                                <th>{renderAccountSortHeader("nickname", "닉네임")}</th>
                                <th>{renderAccountSortHeader("status", "상태")}</th>
                                <th>{renderAccountSortHeader("license", "라이선스")}</th>
                                <th>{renderAccountSortHeader("joinedAt", "가입일")}</th>
                                <th>관리</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleAccountUsers.map((user) => (
                                <tr key={user.githubId}>
                                  <td>{user.githubId}</td>
                                  <td>{user.nickname}</td>
                                  <td>
                                    {getAccountStatusLabel(user)}
                                  </td>
                                  <td>
                                    <button
                                      className={
                                        user.license
                                          ? "licenseStatusButton active"
                                          : "licenseStatusButton inactive"
                                      }
                                      type="button"
                                      disabled={user.githubId === githubToolSource.owner}
                                      onClick={() => toggleAccountLicense(user.githubId)}
                                    >
                                      {user.license ? "활성화" : "비활성화"}
                                    </button>
                                  </td>
                                  <td>{formatJoinedDate(user.joinedAt)}</td>
                                  <td>
                                    <div className="accountTableActions">
                                      {user.status === "pending" ? (
                                        <button
                                          className="tableActionButton registerAction"
                                          type="button"
                                          onClick={() => approveAccountUser(user.githubId)}
                                        >
                                          승인
                                        </button>
                                      ) : null}
                                      <button
                                        className="tableActionButton danger"
                                        type="button"
                                        disabled={user.githubId === githubToolSource.owner}
                                        onClick={() => deleteAccountUser(user.githubId)}
                                      >
                                        삭제
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="accountUserList pendingToolList">
                          <div className="panelHeader compactPanelHeader">
                            <h2>승인 대기 툴</h2>
                            <span className="panelHeaderNote">
                              앱 승인 대기 또는 GitHub PR 대기 중인 툴입니다.
                            </span>
                            <div className="panelHeaderActions">
                              <button
                                className="secondaryAction iconOnlyAction"
                                type="button"
                                aria-label="상태 새로고침"
                                title="상태 새로고침"
                                onClick={() => void refreshToolReviewStates()}
                              >
                                <RefreshIcon />
                              </button>
                            </div>
                          </div>
                          <table>
                            <thead>
                              <tr>
                                <th>툴</th>
                                <th>버전</th>
                                <th>제작자</th>
                                <th>등록일</th>
                                <th>앱 승인</th>
                                <th>GitHub</th>
                                <th>관리</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pendingReviewTools.map((tool) => (
                                <tr
                                  key={tool.id}
                                  onContextMenu={(event) => {
                                    event.preventDefault();
                                    setContextMenu({
                                      type: "customTool",
                                      toolId: tool.id,
                                      x: event.clientX,
                                      y: event.clientY
                                    });
                                  }}
                                >
                                  <td>{tool.name}</td>
                                  <td>{tool.version}</td>
                                  <td>{tool.author}</td>
                                  <td>{formatToolCreatedDate(tool.createdAt)}</td>
                                  <td>{tool.approvalStatus === "pending" ? "승인 대기" : "승인됨"}</td>
                                  <td>{tool.reviewUrl ? toolReviewLabel(tool) : "공유 완료"}</td>
                                  <td>
                                    <div className="accountTableActions">
                                      {tool.approvalStatus === "pending" ? (
                                        <button
                                          className="tableActionButton registerAction"
                                          type="button"
                                          onClick={() => approveCustomTool(tool.id)}
                                        >
                                          앱 승인
                                        </button>
                                      ) : null}
                                      {tool.reviewUrl ? (
                                        <a
                                          className="tableActionButton"
                                          href={tool.reviewUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          PR 보기
                                        </a>
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {pendingReviewTools.length === 0 ? (
                                <tr>
                                  <td className="emptyTableCell" colSpan={7}>
                                    승인 대기 중인 툴이 없습니다.
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </section>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isMonitorDialogOpen ? (
        <div className="dialogBackdrop" role="presentation">
          <section
            className="registryDialog monitorDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="monitorDialogTitle"
          >
            <div className="dialogHeader">
              <div>
                <h2 id="monitorDialogTitle">Monitor</h2>
                <span>MCP 브리지 실행 상태와 로그를 별도 창에서 확인합니다.</span>
              </div>
              <div className="dialogHeaderActions">
                <button
                  className="dialogWindowButton"
                  aria-label="탭으로 열기"
                  title="탭으로 열기"
                  onClick={openMonitorDialogAsTab}
                >
                  <PopoutIcon />
                </button>
                <button
                  className="dialogWindowButton"
                  aria-label="닫기"
                  title="닫기"
                  onClick={() => setIsMonitorDialogOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div className="dialogContent standaloneDialogContent">
              <MonitorView
                runningCount={runningCount}
                totalCount={registry.servers.length}
                processes={processSnapshot.processes}
                logs={processSnapshot.logs}
              />
            </div>
          </section>
        </div>
      ) : null}

      {isCustomToolDialogOpen ? (
        <div className="dialogBackdrop" role="presentation">
          <section
            className="registryDialog customToolDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customToolDialogTitle"
          >
            <div className="dialogHeader">
              <div>
                <h2 id="customToolDialogTitle">{customToolDialogTitle}</h2>
                <span>
                  {isMarketDialog
                    ? "Tools와 Flows를 가져오고 공유 항목을 관리합니다."
                    : "MD 형태의 커스텀 툴을 가져오고 상단고정으로 관리합니다."}
                </span>
              </div>
              <div className="dialogHeaderActions">
                {!isMarketDialog || marketDialogTab === "tools" ? (
                  <>
                    <button
                      className="secondaryAction registerToolButton"
                      type="button"
                      aria-label="툴 등록"
                      title="툴 등록"
                      onClick={openCustomToolForm}
                    >
                      <span className="dialogHeaderButtonLabel">툴 등록</span>
                    </button>
                    <button
                      className="secondaryAction registerToolButton"
                      type="button"
                      aria-label="내 툴 관리"
                      title="내 툴 관리"
                      onClick={() => setIsMyToolManagerDialogOpen(true)}
                    >
                      <span className="dialogHeaderButtonLabel">내 툴 관리</span>
                    </button>
                  </>
                ) : null}
                <button
                  className="dialogWindowButton"
                  aria-label="닫기"
                  title="닫기"
                  onClick={() => setIsCustomToolDialogOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div
              className={
                isMarketDialog ? "dialogBody marketDialogBody" : "dialogContent standaloneDialogContent"
              }
            >
              {isMarketDialog ? (
                <nav className="dialogNav marketDialogNav" aria-label="Market 메뉴">
                  <button
                    className={marketDialogTab === "tools" ? "dialogNavItem active" : "dialogNavItem"}
                    type="button"
                    onClick={() => setMarketDialogTab("tools")}
                  >
                    Tools
                  </button>
                  <button
                    className={marketDialogTab === "flows" ? "dialogNavItem active" : "dialogNavItem"}
                    type="button"
                    onClick={() => setMarketDialogTab("flows")}
                  >
                    Flows
                  </button>
                </nav>
              ) : null}
              <div className={isMarketDialog ? "dialogContent marketDialogContent" : "customToolStandaloneContent"}>
              {!isMarketDialog || marketDialogTab === "tools" ? (
                <>
              <div className="customToolToolbar">
                <div className="customToolToolbarRow">
                  <input
                    value={customToolSearch}
                    onChange={(event) => setCustomToolSearch(event.target.value)}
                    placeholder="툴 이름, 버전, 제작자 검색"
                    aria-label="커스텀 툴 검색"
                  />
                  <button
                    className="secondaryAction githubRefreshButton"
                    type="button"
                    onClick={() => {
                      void syncCustomToolsFromGitHub();
                      void refreshToolReviewStates();
                    }}
                    disabled={isGithubToolSyncing}
                  >
                    {isGithubToolSyncing ? "확인 중" : "새로고침"}
                  </button>
                </div>
                {githubToolStatus ? (
                  <div className={isGithubToolSyncing ? "githubToolStatus syncing" : "githubToolStatus"}>
                    {githubToolStatus}
                  </div>
                ) : null}
              </div>
              <table
                className={[
                  "customToolTable",
                  showCompactCustomToolColumns ? "compactCustomToolTable" : "",
                  customToolDialogScope === "all" ? "allCustomToolTable" : "scopedCustomToolTable"
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <thead>
                  <tr>
                    {customToolDialogScope === "all" ? (
                    <th>{renderSortHeader("section", "프로그램")}</th>
                    ) : null}
                    <th>{renderToolNameHeader()}</th>
                    <th>{renderSortHeader("version", "버전")}</th>
                    <th>{renderSortHeader("author", "제작자")}</th>
                    <th>{renderSortHeader("usageCount", "사용횟수")}</th>
                    <th>등록</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCustomTools.map((tool) => (
                    <Fragment key={tool.id}>
                      <tr
                        className={[
                          tool.pinned ? "pinnedToolRow" : "",
                          tool.registered ? "registeredToolRow" : "",
                          expandedCustomToolIds.includes(tool.id) ? "expandedToolRow" : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => toggleCustomToolDescription(tool.id)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setContextMenu({
                            type: "customTool",
                            toolId: tool.id,
                            x: event.clientX,
                            y: event.clientY
                          });
                        }}
                      >
                        {customToolDialogScope === "all" ? <td>{sidebarLabel(tool.sectionId)}</td> : null}
                        <td>
                          <span className="customToolNameCell">
                            <span>{tool.name}</span>
                            {tool.approvalStatus === "pending" ? (
                              <span className="toolApprovalBadge">승인 대기</span>
                            ) : null}
                            {tool.approvalStatus === "rejected" ? (
                              <span className="toolApprovalBadge rejected">거절됨</span>
                            ) : null}
                            {tool.reviewUrl || tool.reviewState === "merged" ? (
                              <span className={`toolApprovalBadge prBadge ${tool.reviewState ?? "open"}`}>
                                {toolReviewLabel(tool)}
                              </span>
                            ) : null}
                            {tool.riskWarnings.length > 0 ? (
                              <button
                                className="toolRiskBadge"
                                type="button"
                                title={tool.riskWarnings.join("\n")}
                                aria-label={`${tool.name} 주의 필요: ${tool.riskWarnings.join(" ")}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  revealCustomToolWarning(tool.id);
                                }}
                              >
                                주의
                              </button>
                            ) : null}
                          </span>
                        </td>
                        <td>
                          {tool.versions && tool.versions.length > 1 ? (
                            <select
                              className="toolVersionSelect"
                              value={tool.versions.find((version) => version.version === tool.version)?.id ?? ""}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => {
                                event.stopPropagation();
                                selectCustomToolVersion(tool.id, event.target.value);
                              }}
                            >
                              {tool.versions.map((version) => (
                                <option key={version.id} value={version.id}>
                                  {version.version}
                                </option>
                              ))}
                            </select>
                          ) : (
                            tool.version
                          )}
                        </td>
                        <td>{tool.author}</td>
                        <td>
                          {tool.usageCount}
                        </td>
                        <td>
                          {tool.approvalStatus === "pending" ? (
                            isCurrentAdmin ? (
                              <button
                                className="tableActionButton registerAction"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  approveCustomTool(tool.id);
                                }}
                              >
                                승인
                              </button>
                            ) : (
                              <button className="tableActionButton" type="button" disabled>
                                대기
                              </button>
                            )
                          ) : (
                          <button
                            className={
                              tool.registered
                                ? "tableActionButton unregisterAction"
                                : "tableActionButton registerAction"
                            }
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleCustomToolRegistered(tool.id);
                            }}
                          >
                            {tool.registered ? "해제" : "등록"}
                          </button>
                          )}
                        </td>
                      </tr>
                      {expandedCustomToolIds.includes(tool.id) ? (
                        <tr className="customToolDescriptionRow">
                          <td colSpan={customToolDialogScope === "all" ? 6 : 5}>
                            {tool.riskWarnings.length > 0 ? (
                              <div className="toolRiskReasons">
                                <strong>주의 필요</strong>
                                {tool.riskWarnings.map((reason) => (
                                  <span key={reason}>{reason}</span>
                                ))}
                              </div>
                            ) : null}
                            {tool.description || "등록된 설명이 없습니다."}
                            {tool.reviewUrl ? (
                              <a
                                className="toolReviewLink"
                                href={tool.reviewUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                              >
                                GitHub PR 보기
                              </a>
                            ) : null}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                  {visibleCustomTools.length === 0 ? (
                    <tr>
                      <td colSpan={customToolDialogScope === "all" ? 6 : 5} className="emptyTableCell">
                        표시할 커스텀 툴이 없습니다. 오른쪽 위 툴 등록 버튼으로 MD 툴을 추가하세요.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
                </>
              ) : (
                <MarketFlowPanel
                  sharedFlows={sharedFlowCatalog}
                  savedFlows={workflowSavedFlowsForMenu}
                  onRegisterSharedFlow={registerSharedFlow}
                />
              )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isMyToolManagerDialogOpen ? (
        <div className="dialogBackdrop" role="presentation">
          <section
            className="registryDialog customToolDialog myToolManagerDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="myToolManagerDialogTitle"
          >
            <div className="dialogHeader">
              <div>
                <h2 id="myToolManagerDialogTitle">내 툴 관리</h2>
                <span>내 닉네임으로 등록한 툴의 승인 상태와 삭제 상태를 확인합니다.</span>
              </div>
              <div className="dialogHeaderActions">
                <button
                  className="dialogWindowButton"
                  aria-label="닫기"
                  title="닫기"
                  onClick={() => setIsMyToolManagerDialogOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div className="dialogContent standaloneDialogContent">
              <table className="customToolTable myToolManagerTable">
                <thead>
                  <tr>
                    <th>툴 이름</th>
                    <th>버전</th>
                    <th>프로그램</th>
                    <th>상태</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {myCustomTools.map((tool) => (
                    <tr key={tool.id}>
                      <td>{tool.name}</td>
                      <td>{tool.version}</td>
                      <td>{sidebarLabel(tool.sectionId)}</td>
                      <td>
                        <span className={`toolApprovalBadge ${getMyToolStatusClass(tool)}`}>
                          {getMyToolStatusLabel(tool)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="tableActionButton unregisterAction"
                          type="button"
                          onClick={() => requestDeleteCustomTool(tool.id)}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                  {myCustomTools.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="emptyTableCell">
                        내 닉네임으로 등록한 툴이 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {isCustomToolFormOpen ? (
        <div className="dialogBackdrop nestedDialogBackdrop" role="presentation">
          <section
            className="registryDialog customToolFormDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customToolFormTitle"
          >
            <div className="dialogHeader">
              <div>
                <h2 id="customToolFormTitle">툴 등록</h2>
                <span>신규 툴을 추가하거나 기존 툴의 MD 파일과 버전을 업데이트합니다.</span>
              </div>
              <div className="dialogHeaderActions">
                <button
                  className="dialogWindowButton"
                  aria-label="닫기"
                  title="닫기"
                  onClick={() => setIsCustomToolFormOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div className="dialogContent customToolFormContent">
              <div className="segmentedControl">
                <button
                  className={customToolDraft.mode === "new" ? "active" : ""}
                  type="button"
                  onClick={() =>
                    setCustomToolDraft((draft) => ({
                      ...draft,
                      mode: "new",
                      toolId: "",
                      error: ""
                    }))
                  }
                >
                  신규 툴
                </button>
                <button
                  className={customToolDraft.mode === "update" ? "active" : ""}
                  type="button"
                  onClick={() =>
                    setCustomToolDraft((draft) => ({
                      ...draft,
                      mode: "update",
                      error: ""
                    }))
                  }
                >
                  버전 업데이트
                </button>
              </div>

              {customToolDraft.mode === "update" ? (
                <label className="field">
                  <span>업데이트할 툴</span>
                  <select
                    value={customToolDraft.toolId}
                    onChange={(event) => updateCustomToolDraftFromExisting(event.target.value)}
                  >
                    <option value="">툴 선택</option>
                    {scopedCustomTools.map((tool) => (
                      <option key={tool.id} value={tool.id}>
                        {customToolDialogScope === "all"
                          ? `${sidebarLabel(tool.sectionId)} / ${tool.name}`
                          : tool.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="customToolFormGrid">
                {customToolDraft.mode === "new" ? (
                  <label className="field">
                    <span>툴 이름</span>
                    <input
                      value={customToolDraft.name}
                      onChange={(event) =>
                        setCustomToolDraft((draft) => ({
                          ...draft,
                          name: event.target.value,
                          error: ""
                        }))
                      }
                    />
                  </label>
                ) : null}
                <label className="field">
                  <span>설명</span>
                  <textarea
                    className="customToolDescriptionInput"
                    value={customToolDraft.description}
                    placeholder="리스트에서 툴을 펼쳤을 때 보여줄 설명"
                    onChange={(event) =>
                      setCustomToolDraft((draft) => ({
                        ...draft,
                        description: event.target.value,
                        error: ""
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>버전</span>
                  <input
                    value={customToolDraft.version}
                    onChange={(event) =>
                      setCustomToolDraft((draft) => ({
                        ...draft,
                        version: event.target.value,
                        error: ""
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>제작자</span>
                  <input
                    readOnly
                    value={currentUserNickname || customToolDraft.author}
                    title="제작자는 로그인한 계정의 닉네임으로 자동 입력됩니다."
                  />
                  <small>로그인 닉네임으로 자동 입력되며 수정할 수 없습니다.</small>
                </label>
                <label className="field">
                  <span>MD 파일</span>
                  <div className="filePickerRow">
                    <input
                      readOnly
                      value={customToolDraft.fileName || customToolDraft.filePath}
                      placeholder="등록할 MD 파일을 선택"
                    />
                    <button className="secondaryAction" type="button" onClick={selectCustomToolFile}>
                      파일 선택
                    </button>
                  </div>
                </label>
              </div>

              {customToolDraft.preview ? (
                <section className="mdPreviewPanel">
                  <div className="panelHeader compactPanelHeader">
                    <h2>MD 미리보기</h2>
                    <span className="panelHeaderNote">
                      등록 전에 문서 형태와 위험 감지 결과를 확인합니다.
                    </span>
                  </div>
                  {customToolDraft.riskWarnings.length > 0 ? (
                    <div className="toolRiskReasons previewRiskReasons">
                      <strong>주의 필요</strong>
                      {customToolDraft.riskWarnings.map((reason) => (
                        <span key={reason}>{reason}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="previewSafeNote">감지된 위험 동작이 없습니다.</p>
                  )}
                  <pre>{customToolDraft.preview}</pre>
                </section>
              ) : null}

              {customToolDraft.toolSchema ? (
                <ToolSchemaPreviewPanel schema={customToolDraft.toolSchema} />
              ) : null}

              {customToolDraft.toolWarning ? (
                <p className="formWarning">{customToolDraft.toolWarning}</p>
              ) : null}
              {customToolDraft.error ? <p className="formError">{customToolDraft.error}</p> : null}

              <div className="dialogFooterActions">
                <button
                  className="secondaryAction"
                  type="button"
                  onClick={() => setIsCustomToolFormOpen(false)}
                >
                  취소
                </button>
                <button
                  className="primaryAction"
                  type="button"
                  disabled={isSavingCustomTool}
                  onClick={saveCustomToolDraft}
                >
                  {isSavingCustomTool ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {contextMenu ? (
        <div className="contextMenu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.type === "section" ? (
            <>
              <button
                onClick={() => {
                  openSectionInNewTab(contextMenu.sectionId);
                  setContextMenu(null);
                }}
              >
                새 탭에서 열기
              </button>
              <button
                onClick={() => {
                  toggleFavoriteSection(contextMenu.sectionId);
                  setContextMenu(null);
                }}
              >
                {favoriteSectionIds.includes(contextMenu.sectionId)
                  ? "즐겨찾기 해제"
                  : "즐겨찾기 추가"}
              </button>
            </>
          ) : contextMenu.type === "submenu" ? (
            <>
              <button
                onClick={() => {
                  toggleFavoriteSubmenu(contextMenu.sectionId, contextMenu.submenuId);
                  setContextMenu(null);
                }}
              >
                {favoriteSubmenuKeys.includes(
                  makeSubmenuKey(contextMenu.sectionId, contextMenu.submenuId)
                )
                  ? "즐겨찾기 해제"
                  : "즐겨찾기 추가"}
              </button>
              <button
                onClick={() => {
                  openSubmenuInNewTab(contextMenu.sectionId, contextMenu.submenuId);
                  setContextMenu(null);
                }}
              >
                새 탭에서 열기
              </button>
              {contextMenu.source === "recent" ? (
                <button
                  onClick={() => {
                    removeRecentSubmenu(contextMenu.sectionId, contextMenu.submenuId);
                    setContextMenu(null);
                  }}
                >
                  삭제
                </button>
              ) : null}
            </>
          ) : contextMenu.type === "customTool" ? (
            <>
              {customTools.find((tool) => tool.id === contextMenu.toolId)?.approvalStatus ===
              "pending" ? (
                <button
                  onClick={() => {
                    void rejectCustomTool(contextMenu.toolId);
                    setContextMenu(null);
                  }}
                >
                  거절
                </button>
              ) : null}
              {customTools.find((tool) => tool.id === contextMenu.toolId)?.approvalStatus ===
              "approved" ? (
                <button
                  onClick={() => {
                    toggleCustomToolRegistered(contextMenu.toolId);
                    setContextMenu(null);
                  }}
                >
                  {customTools.find((tool) => tool.id === contextMenu.toolId)?.registered
                    ? "등록 해제"
                    : "등록"}
                </button>
              ) : null}
              <button
                onClick={() => {
                  toggleCustomToolPinned(contextMenu.toolId);
                  setContextMenu(null);
                }}
              >
                {customTools.find((tool) => tool.id === contextMenu.toolId)?.pinned
                  ? "상단고정 해제"
                  : "상단고정"}
              </button>
              {customTools.find((tool) => tool.id === contextMenu.toolId && canDeleteCustomTool(tool)) ? (
                <button
                  className="danger"
                  onClick={() => {
                    requestDeleteCustomTool(contextMenu.toolId);
                    setContextMenu(null);
                  }}
                >
                  삭제
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  duplicateOpenTab(contextMenu.tabId);
                  setContextMenu(null);
                }}
              >
                탭 복제
              </button>
              <button
                onClick={() => {
                  togglePinnedOpenTab(contextMenu.tabId);
                  setContextMenu(null);
                }}
              >
                {openTabs.find((tab) => tab.id === contextMenu.tabId)?.isPinned
                  ? "탭 고정 해제"
                  : "탭 고정"}
              </button>
            </>
          )}
        </div>
      ) : null}

      {pendingDeleteCustomToolId ? (
        <div className="flowConfirmBackdrop" role="presentation" onMouseDown={cancelDeleteCustomTool}>
          <div
            className="flowConfirmDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deleteCustomToolTitle"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <strong id="deleteCustomToolTitle">툴을 삭제할까요?</strong>
            <p>
              {customTools.find((tool) => tool.id === pendingDeleteCustomToolId)?.name ?? "선택한 툴"}을
              앱 목록에서 제거하고 연결된 원본 MD 파일도 삭제합니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flowConfirmActions">
              <button type="button" onClick={cancelDeleteCustomTool}>
                취소
              </button>
              <button className="danger" type="button" onClick={() => void confirmDeleteCustomTool()}>
                삭제
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {appNotifications.length > 0 ? (
        <div className="notificationStack" role="status" aria-live="polite">
          {appNotifications.map((notification) => (
            <section
              className={[
                "appNotification",
                notification.variant === "save-toast" ? "saveToastNotification" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              key={notification.id}
            >
              <div>
                <strong>{notification.title}</strong>
                {notification.message ? <span>{notification.message}</span> : null}
              </div>
              {notification.variant === "save-toast" ? null : (
                <button
                  className="notificationCloseButton"
                  type="button"
                  aria-label="알림 닫기"
                  onClick={() => dismissAppNotification(notification.id)}
                >
                  ×
                </button>
              )}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({
  label,
  value,
  multiline = false
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className={multiline ? "multilineValue" : undefined}>{value}</div>
    </label>
  );
}

function EditableText({
  label,
  value,
  multiline = false,
  className = "",
  onChange
}: {
  label: string;
  value: string;
  multiline?: boolean;
  className?: string;
  onChange: (value: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <label className={["editableText", className].filter(Boolean).join(" ")}>
      <span>{label}</span>
      {isEditing ? (
        multiline ? (
          <textarea
            autoFocus
            value={value}
            onBlur={() => setIsEditing(false)}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setIsEditing(false);
              }
            }}
          />
        ) : (
          <input
            autoFocus
            value={value}
            onBlur={() => setIsEditing(false)}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Escape") {
                setIsEditing(false);
              }
            }}
          />
        )
      ) : (
        <button type="button" className={multiline ? "editableValue multiline" : "editableValue"} onClick={() => setIsEditing(true)}>
          {value || "내용을 입력하세요"}
        </button>
      )}
    </label>
  );
}

function useStandaloneToolPresets(
  toolId: string,
  toolName: string,
  values: Record<string, ToolSettingValue>,
  setValues: React.Dispatch<React.SetStateAction<Record<string, ToolSettingValue>>>
) {
  const [presets, setPresets] = useState<SettingPreset[]>(() => loadSettingPresets());

  useEffect(() => {
    saveSettingPresets(presets);
  }, [presets]);

  const savePreset = (options?: { presetId?: string; name?: string }) => {
    setPresets((items) => {
      const existing = options?.presetId
        ? items.find((preset) => preset.id === options.presetId)
        : undefined;
      const presetName =
        options?.name ??
        existing?.name ??
        `${toolName} 설정 ${new Date().toLocaleString("ko-KR")}`;
      const preset = existing
        ? {
            ...existing,
            name: presetName,
            values: cloneSettingValues(values)
          }
        : createSettingPreset(toolId, presetName, values);

      return upsertSettingPreset(items, preset);
    });
  };

  const loadPreset = (preset: SettingPreset) => {
    setValues(cloneSettingValues(preset.values));
  };

  const deletePreset = (presetId: string) => {
    setPresets((items) => removeSettingPreset(items, presetId));
  };

  const renamePreset = (presetId: string, name: string) => {
    setPresets((items) => renameSettingPreset(items, presetId, name));
  };

  return {
    presets: listSettingPresetsForTool(presets, toolId),
    savePreset,
    loadPreset,
    deletePreset,
    renamePreset
  };
}

function ToolWorkspaceView({
  menuLabel,
  tools,
  customTools,
  isCompact,
  isMcpReady,
  disabledReason,
  onAddCustomTool,
  onCustomToolContext,
  onOpenTool
}: {
  menuLabel: string;
  tools: ReturnType<typeof getToolsForWorkspace>;
  customTools: CustomToolItem[];
  isCompact: boolean;
  isMcpReady: boolean;
  disabledReason: string;
  onAddCustomTool: () => void;
  onCustomToolContext: (event: MouseEvent<HTMLButtonElement>, toolId: string) => void;
  onOpenTool: (submenuId: SubmenuId) => void;
}) {
  const [compactToolId, setCompactToolId] = useState<SubmenuId | null>(null);
  const shareCompactTools = tools.map((tool) => ({
    id: `share-${tool.name}` as SubmenuId,
    name: tool.name,
    description: tool.description,
    version: tool.version ?? "1.0.0",
    author: tool.author ?? "MCP Registry",
    schema: undefined as ToolRuntimeSchema | undefined,
    kind: "share" as const
  }));
  const customCompactTools = customTools.map((tool) => ({
    id: tool.id as SubmenuId,
    name: tool.name,
    description: tool.description || "등록된 설명이 없습니다.",
    version: tool.version,
    author: tool.author,
    schema: tool.toolSchema,
    kind: "custom" as const
  }));
  const compactTools = [
    ...shareCompactTools,
    ...customCompactTools
  ];

  useEffect(() => {
    if (!isCompact) {
      setCompactToolId(null);
      return;
    }

    if (compactToolId && !compactTools.some((tool) => tool.id === compactToolId)) {
      setCompactToolId(null);
    }
  }, [compactToolId, compactTools, isCompact]);

  const openWorkspaceTool = (submenuId: SubmenuId) => {
    if (isCompact) {
      setCompactToolId((current) => (current === submenuId ? null : submenuId));
      return;
    }

    onOpenTool(submenuId);
  };

  return (
    <section className="sectionView toolWorkspaceView">
      <div className="toolLibraryGrid">
        <ToolLibrarySection
          title="Share Tools"
          description="모든 사용자에게 기본으로 보이는 공용 MCP 툴입니다."
          tools={tools.map((tool) => ({
            id: `share-${tool.name}`,
            name: tool.name,
            description: tool.description,
            version: tool.version ?? "1.0.0",
            author: tool.author ?? "MCP Registry"
          }))}
          isMcpReady={isMcpReady}
          disabledReason={disabledReason}
          onOpenTool={openWorkspaceTool}
          selectedCompactToolId={isCompact ? compactToolId : null}
          compactTools={shareCompactTools}
        />
        <CustomToolSection
          customTools={customTools}
          isCompact={isCompact}
          isMcpReady={isMcpReady}
          disabledReason={disabledReason}
          onAddCustomTool={onAddCustomTool}
          onCustomToolContext={onCustomToolContext}
          onOpenTool={openWorkspaceTool}
          selectedCompactToolId={isCompact ? compactToolId : null}
          compactTools={customCompactTools}
        />
      </div>
      <div className="toolWorkspaceGrid">
        <section className="panel toolCatalogPanel">
          <div className="panelHeader">
            <h2>{menuLabel} MCP 툴</h2>
          </div>
          <div className="toolList">
            {tools.map((tool) => (
              <div className="toolItem" key={tool.name}>
                <strong className="toolItemTitleLine">
                  <span>{tool.name}</span>
                  <small className="toolItemMeta">
                    v{tool.version ?? "1.0.0"} - {tool.author ?? "MCP Registry"}
                  </small>
                </strong>
                <span>{tool.description}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="panel workflowBoard">
        <div className="panelHeader">
          <h2>{menuLabel} 작업 구성</h2>
        </div>
        <div className="workflowBoardGrid">
          <div>
            <strong>툴 정리</strong>
            <span>이 메뉴에서 자주 쓰는 MCP 툴과 소메뉴를 모아둡니다.</span>
          </div>
          <div>
            <strong>입력 기준</strong>
            <span>명령 실행에 필요한 파일, 범위, 객체 기준을 정리합니다.</span>
          </div>
          <div>
            <strong>실행 준비</strong>
            <span>서버 연결 후 실제 MCP 명령과 연결할 작업 공간입니다.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

type CompactToolRunnerTool = {
  id: SubmenuId;
  name: string;
  description: string;
  version: string;
  author: string;
  schema?: ToolRuntimeSchema;
  kind: "share" | "custom";
};

function CompactToolRunner({
  tool,
  isMcpReady,
  disabledReason
}: {
  tool: CompactToolRunnerTool;
  isMcpReady: boolean;
  disabledReason: string;
}) {
  const [settingValues, setSettingValues] = useState<Record<string, ToolSettingValue>>({});
  const settingPresetControls = useStandaloneToolPresets(
    tool.id,
    tool.name,
    settingValues,
    setSettingValues
  );

  useEffect(() => {
    setSettingValues(tool.schema ? defaultSettingValuesForSchema(tool.schema) : {});
  }, [tool.id, tool.schema]);

  return (
    <section className="panel compactToolRunner">
      <div className="compactToolRunnerHeader">
        <div>
          <strong>{tool.name}</strong>
          <span>
            v{tool.version} · {tool.author}
          </span>
        </div>
        <small>{tool.description}</small>
      </div>
      <div className="compactToolRunnerActions">
        <button className="primaryAction" type="button" disabled={!isMcpReady} title={isMcpReady ? undefined : disabledReason}>
          실행
        </button>
        <button
          className="secondaryAction"
          type="button"
          onClick={() => setSettingValues(tool.schema ? defaultSettingValuesForSchema(tool.schema) : {})}
        >
          초기화
        </button>
      </div>
      <div className="compactToolRunnerSettings">
        {tool.schema ? (
          <FlowNodeSchemaSettings
            schema={tool.schema}
            values={settingValues}
            onChange={(field, value) =>
              setSettingValues((values) => ({
                ...values,
                [field.id]: value
              }))
            }
            onRuntimeValueChange={(key, value) =>
              setSettingValues((values) => ({
                ...values,
                [key]: value
              }))
            }
            presets={settingPresetControls.presets}
            onSavePreset={settingPresetControls.savePreset}
            onLoadPreset={settingPresetControls.loadPreset}
            onDeletePreset={settingPresetControls.deletePreset}
            onRenamePreset={settingPresetControls.renamePreset}
          />
        ) : (
          <div className="configForm compactToolFallbackSettings">
            <label className="field">
              <span>작업 대상</span>
              <input placeholder={`${tool.name}에서 사용할 파일 또는 선택 범위`} />
            </label>
            <label className="field">
              <span>실행 옵션</span>
              <input placeholder="필터, 레이어, 객체 조건 등을 입력" />
            </label>
            <label className="field">
              <span>메모</span>
              <textarea placeholder="실행 전 확인할 내용을 적어둡니다." />
            </label>
          </div>
        )}
      </div>
    </section>
  );
}

function SubmenuPage({
  menuLabel,
  submenu
}: {
  menuLabel: string;
  submenu: SubmenuItem;
}) {
  const [settingValues, setSettingValues] = useState<Record<string, ToolSettingValue>>({});
  const principleSteps = operationPrincipleSteps(menuLabel, submenu);
  const settingPresetControls = useStandaloneToolPresets(
    submenu.id,
    submenu.label,
    settingValues,
    setSettingValues
  );

  useEffect(() => {
    setSettingValues(
      submenu.settingsSchema ? defaultSettingValuesForSchema(submenu.settingsSchema) : {}
    );
  }, [submenu.id, submenu.settingsSchema]);

  return (
    <section className="sectionView submenuPage">
      <div className="submenuLayout">
        <section className="panel submenuWorkPanel">
          <div className="panelHeader">
            <div>
              <h2>작동 원리</h2>
              <span className="panelHeaderNote">
                {submenu.label} 툴이 {menuLabel} 작업에서 움직이는 흐름입니다.
              </span>
            </div>
          </div>
          <ToolRiskSummary schema={submenu.settingsSchema} />
          <div className="principleList">
            {principleSteps.map((step) => (
              <div key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.description}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel submenuConfigPanel">
          <div className="panelHeader">
            <div>
              <h2>설정</h2>
              <span className="panelHeaderNote">툴 실행 전에 필요한 기준값을 입력합니다.</span>
            </div>
            {submenu.settingsSchema ? (
              <SettingPresetControls
                presets={settingPresetControls.presets}
                values={settingValues}
                onSavePreset={settingPresetControls.savePreset}
                onLoadPreset={settingPresetControls.loadPreset}
                onDeletePreset={settingPresetControls.deletePreset}
                onRenamePreset={settingPresetControls.renamePreset}
                showCurrentNote={false}
                inline
              />
            ) : null}
          </div>
          {submenu.settingsSchema ? (
            <div className="toolPageSchemaSettings">
              <FlowNodeSchemaSettings
                schema={submenu.settingsSchema}
                values={settingValues}
                onChange={(field, value) =>
                  setSettingValues((values) => ({
                    ...values,
                    [field.id]: value
                  }))
                }
                onRuntimeValueChange={(key, value) =>
                  setSettingValues((values) => ({
                    ...values,
                    [key]: value
                  }))
                }
                presets={settingPresetControls.presets}
                onSavePreset={settingPresetControls.savePreset}
                onLoadPreset={settingPresetControls.loadPreset}
                onDeletePreset={settingPresetControls.deletePreset}
                onRenamePreset={settingPresetControls.renamePreset}
                showPresetControls={false}
              />
            </div>
          ) : (
            <div className="configForm">
              <label className="field">
                <span>작업 대상</span>
                <input placeholder={`${menuLabel}에서 사용할 파일 또는 선택 범위`} />
              </label>
              <label className="field">
                <span>실행 옵션</span>
                <input placeholder="필터, 레이어, 객체 조건 등을 입력" />
              </label>
              <label className="field">
                <span>메모</span>
                <textarea placeholder="툴 실행 전 확인할 내용을 적어둡니다." />
              </label>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function HomeDashboard({
  customTools,
  onInstallSaveTool,
  onInstallMcpToolBuilder,
  onInstallProgramMcpRegistrar
}: {
  customTools: CustomToolItem[];
  onInstallSaveTool: () => void;
  onInstallMcpToolBuilder: () => void;
  onInstallProgramMcpRegistrar: () => void;
}) {
  const newCustomTools = [...customTools].slice(-5).reverse();

  return (
    <section className="homeDashboard">
      <article className="panel homePanel">
        <div className="panelHeader">
          <div>
            <h2>공지사항</h2>
            <span className="panelHeaderNote">MCP 연결관리자의 주요 변경 사항을 확인합니다.</span>
          </div>
        </div>
        <div className="homeList">
          <div className="homeListItem">
            <strong>Player view 개선</strong>
            <span>좁은 창에서도 툴 리스트와 메뉴가 더 안정적으로 보이도록 정리했습니다.</span>
          </div>
          <div className="homeListItem">
            <strong>현재 페이지 기준 MCP 상태</strong>
            <span>상단 상태 버튼은 열린 페이지의 MCP 연결 상태를 기준으로 표시됩니다.</span>
          </div>
        </div>
      </article>

      <article className="panel homePanel">
        <div className="panelHeader">
          <div>
            <h2>신규 커스텀 툴</h2>
            <span className="panelHeaderNote">최근 등록된 커스텀 툴을 봅니다.</span>
          </div>
        </div>
        <div className="homeList">
          {newCustomTools.length > 0 ? (
            newCustomTools.map((tool) => (
              <div className="homeListItem" key={tool.id}>
                <strong>
                  {tool.name} v{tool.version}
                </strong>
                <span>
                  {sidebarLabel(tool.sectionId)} · {tool.author}
                </span>
              </div>
            ))
          ) : (
            <p className="emptyState compactEmptyState centeredEmptyState">
              등록된 커스텀 툴이 없습니다.
            </p>
          )}
        </div>
      </article>

      <article className="panel homePanel">
        <div className="panelHeader">
          <div>
            <h2>Other Tools</h2>
            <span className="panelHeaderNote">AI Program 작업을 돕는 보조 스킬을 내려받습니다.</span>
          </div>
        </div>
        <div className="homeList">
          <div className="homeListItem homeToolSaveItem">
            <div>
              <strong>채팅을 TOOL로 저장</strong>
              <span>/save를 입력하면 대화 내용을 보고 이름 후보와 설정값을 확인한 뒤 TOOL 초안을 만듭니다.</span>
            </div>
            <button
              className="secondaryAction homeDownloadButton"
              type="button"
              aria-label="/save 스킬 다운로드"
              title="/save 스킬 다운로드"
              onClick={onInstallSaveTool}
            >
              <AppIcon name="download" />
            </button>
          </div>
          <div className="homeListItem homeToolSaveItem">
            <div>
              <strong>MCP 툴 만들기</strong>
              <span>/make 명령하면 질문을 따라 설정, 입출력 포트가 있는 TOOL md 파일을 만듭니다.</span>
            </div>
            <button
              className="secondaryAction homeDownloadButton"
              type="button"
              aria-label="/make 스킬 다운로드"
              title="/make 스킬 다운로드"
              onClick={onInstallMcpToolBuilder}
            >
              <AppIcon name="download" />
            </button>
          </div>
          <div className="homeListItem homeToolSaveItem">
            <div>
              <strong>프로그램 MCP 등록</strong>
              <span>/등록 명령으로 MCP 브리지를 만들고 Settings &gt; AI 연결의 API 키 설정까지 확인합니다.</span>
            </div>
            <button
              className="secondaryAction homeDownloadButton"
              type="button"
              aria-label="/등록 스킬 다운로드"
              title="/등록 스킬 다운로드"
              onClick={onInstallProgramMcpRegistrar}
            >
              <AppIcon name="download" />
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}

function ToolLibrarySection({
  title,
  description,
  tools,
  isMcpReady,
  disabledReason,
  onOpenTool,
  selectedCompactToolId,
  compactTools
}: {
  title: string;
  description: string;
  tools: { id: string; name: string; description: string; version?: string; author?: string }[];
  isMcpReady: boolean;
  disabledReason: string;
  onOpenTool?: (submenuId: SubmenuId) => void;
  selectedCompactToolId?: SubmenuId | null;
  compactTools?: CompactToolRunnerTool[];
}) {
  return (
    <section className="panel toolLibrarySection">
      <PanelHeader title={title} description={description} />
      <div className="toolList">
        {tools.map((tool) => {
          const compactTool = compactTools?.find((item) => item.id === tool.id);
          return (
            <Fragment key={tool.id}>
              <button
                className={[
                  isMcpReady ? "toolItem toolItemButton" : "toolItem toolItemButton disabledToolItem",
                  selectedCompactToolId === tool.id ? "expandedToolItem" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                disabled={!isMcpReady}
                title={isMcpReady ? undefined : disabledReason}
                aria-label={isMcpReady ? tool.name : `${tool.name}: ${disabledReason}`}
                onClick={() => onOpenTool?.(tool.id)}
              >
                <strong className="toolItemTitleLine">
                  <span>{tool.name}</span>
                  {tool.version || tool.author ? (
                    <small className="toolItemMeta">
                      v{tool.version ?? "1.0.0"} - {tool.author ?? "MCP Registry"}
                    </small>
                  ) : null}
                </strong>
                <span>{tool.description}</span>
              </button>
              {compactTool && selectedCompactToolId === tool.id ? (
                <CompactToolRunner
                  tool={compactTool}
                  isMcpReady={isMcpReady}
                  disabledReason={disabledReason}
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

function CustomToolSection({
  customTools,
  isCompact,
  isMcpReady,
  disabledReason,
  onAddCustomTool,
  onCustomToolContext,
  onOpenTool,
  selectedCompactToolId,
  compactTools
}: {
  customTools: CustomToolItem[];
  isCompact: boolean;
  isMcpReady: boolean;
  disabledReason: string;
  onAddCustomTool: () => void;
  onCustomToolContext: (event: MouseEvent<HTMLButtonElement>, toolId: string) => void;
  onOpenTool: (submenuId: SubmenuId) => void;
  selectedCompactToolId?: SubmenuId | null;
  compactTools?: CompactToolRunnerTool[];
}) {
  const [pendingWarningTool, setPendingWarningTool] = useState<CustomToolItem | null>(null);
  const warningMessages = pendingWarningTool
    ? [
        ...pendingWarningTool.riskWarnings,
        ...(!pendingWarningTool.isToolLike
          ? ["이 MD 파일은 툴 문서 형태가 아닐 수 있습니다."]
          : [])
      ]
    : [];

  const openCustomTool = (tool: CustomToolItem) => {
    if (!isCompact && (tool.riskWarnings.length > 0 || !tool.isToolLike)) {
      setPendingWarningTool(tool);
      return;
    }

    onOpenTool(tool.id);
  };

  return (
    <>
      <section className="panel toolLibrarySection">
        <PanelHeader
          title="Custom Tools"
          description="MD 파일로 만든 커스텀 툴을 가져오고 관리합니다."
          action={
            <button className="secondaryAction squareAction" type="button" onClick={onAddCustomTool}>
              +
            </button>
          }
        />
        <div className="toolList customToolList">
          {[...customTools]
            .sort((left, right) => Number(right.pinned) - Number(left.pinned))
            .map((tool) => {
              const compactTool = compactTools?.find((item) => item.id === tool.id);
              return (
                <Fragment key={tool.id}>
                  <button
                    className={[
                      "toolItem",
                      "toolItemButton",
                      tool.pinned ? "pinnedToolItem" : "",
                      tool.isToolLike ? "" : "suspectToolItem",
                      isMcpReady ? "" : "disabledToolItem",
                      selectedCompactToolId === tool.id ? "expandedToolItem" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    type="button"
                    disabled={!isMcpReady}
                    title={
                      !isMcpReady
                        ? disabledReason
                        : !tool.isToolLike
                          ? "이 MD 파일은 툴 문서 형태가 아닐 수 있습니다."
                          : undefined
                    }
                    aria-label={isMcpReady ? tool.name : `${tool.name}: ${disabledReason}`}
                    onClick={() => openCustomTool(tool)}
                    onContextMenu={(event) => onCustomToolContext(event, tool.id)}
                  >
                    <span className="customToolItemTitle">
                      <span className="customToolTitleLeft">
                        {tool.riskWarnings.length > 0 ? (
                          <span className="toolRiskBadge inlineRiskBadge" title={tool.riskWarnings.join("\n")}>
                            주의
                          </span>
                        ) : null}
                        <strong>{tool.name}</strong>
                        <small className="toolItemMeta">
                          v{tool.version} · {tool.author}
                        </small>
                      </span>
                    </span>
                    <span>{tool.description || "등록된 설명이 없습니다."}</span>
                  </button>
                  {compactTool && selectedCompactToolId === tool.id ? (
                    <CompactToolRunner
                      tool={compactTool}
                      isMcpReady={isMcpReady}
                      disabledReason={disabledReason}
                    />
                  ) : null}
                </Fragment>
              );
            })}
          {customTools.length === 0 ? (
            <p className="emptyState compactEmptyState centeredEmptyState">
              등록된 커스텀 툴이 없습니다.
            </p>
          ) : null}
        </div>
      </section>

      {pendingWarningTool ? (
        <div className="flowConfirmBackdrop" role="presentation" onMouseDown={() => setPendingWarningTool(null)}>
          <div
            className="flowConfirmDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="toolRunWarningTitle"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <strong id="toolRunWarningTitle">주의가 필요한 툴입니다.</strong>
            <p>{pendingWarningTool.name} 실행 전에 아래 내용을 확인하세요.</p>
            <div className="toolRiskReasons">
              {warningMessages.map((message) => (
                <span key={message}>{message}</span>
              ))}
            </div>
            <p>그래도 열까요?</p>
            <div className="flowConfirmActions">
              <button type="button" onClick={() => setPendingWarningTool(null)}>
                취소
              </button>
              <button
                className="danger"
                type="button"
                onClick={() => {
                  const toolId = pendingWarningTool.id;
                  setPendingWarningTool(null);
                  onOpenTool(toolId);
                }}
              >
                열기
              </button>
            </div>
          </div>
        </div>
        ) : null}
    </>
  );
}

function ServersView({
  activeTab,
  processActionMessage,
  processStates,
  selected,
  selectedId,
  servers,
  tools,
  onSelectServer,
  onStartServer,
  onStopServer
}: {
  activeTab: WorkspaceTabId;
  processActionMessage: string;
  processStates: ProcessSnapshot["processes"];
  selected: McpServerRecord | undefined;
  selectedId: string;
  servers: McpServerRecord[];
  tools: ReturnType<typeof getToolsForWorkspace>;
  onSelectServer: (serverId: string) => void;
  onStartServer: (serverId: string) => void;
  onStopServer: (serverId: string) => void;
}) {
  const selectedProcessState = selected
    ? processStates.find((process) => process.serverId === selected.id)
    : undefined;
  const isSelectedRunning =
    selectedProcessState?.status === "running" || selected?.status === "running";

  return (
    <section className="contentGrid">
      <section className="panel serverPanel">
        <div className="panelHeader">
          <h2>서버 목록</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>대상</th>
              <th>포트/URL</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((server) => (
              <tr
                key={server.id}
                className={server.id === selectedId ? "selectedRow" : ""}
                onClick={() => onSelectServer(server.id)}
              >
                <td>{server.name}</td>
                <td>{targetLabel(server.target)}</td>
                <td>{server.port ?? server.url}</td>
                <td>{statusLabel(server.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="overviewGrid">
          {overviewCards.map((card) => (
            <div className="overviewCard" key={card.title}>
              <strong>{card.title}</strong>
              <span>{card.body}</span>
            </div>
          ))}
        </div>
      </section>

      <aside className="panel detailPanel">
        <div className="panelHeader">
          <h2>선택 서버 상세</h2>
        </div>
        {selected ? (
          <div className="details">
            <Field label="서버 이름" value={selected.name} />
            <Field label="연결 URL" value={selected.url} />
            <Field label="실행 명령" value={selected.launchCommand} />
            <Field label="작업 폴더" value={selected.workingDirectory} />
            <Field label="메모" value={selected.notes} multiline />
            {processActionMessage ? (
              <p className="processActionMessage">{processActionMessage}</p>
            ) : null}
            <div className="buttonStack">
              <button
                className="primary"
                type="button"
                disabled={isSelectedRunning || !selected.launchCommand.trim()}
                onClick={() => onStartServer(selected.id)}
              >
                실행
              </button>
              <button
                type="button"
                disabled={!isSelectedRunning}
                onClick={() => onStopServer(selected.id)}
              >
                중지
              </button>
            </div>
          </div>
        ) : (
          <p className="emptyState">서버를 선택하세요.</p>
        )}
      </aside>

      <section className="panel toolPanel">
        <div className="panelHeader">
          <h2>{toolPanelTitle(activeTab)}</h2>
        </div>
        <div className="toolList">
          {tools.map((tool) => (
            <div className="toolItem" key={tool.name}>
              <strong>{tool.name}</strong>
              <span>{tool.description}</span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function valueAsText(value: ToolSettingValue | undefined) {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === "string")
      ? value.join(", ")
      : JSON.stringify(value, null, 2);
  }
  return String(value);
}

function stableSettingValueKey(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSettingValueKey(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSettingValueKey(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function areSettingValuesEqual(
  left: Record<string, ToolSettingValue> | undefined,
  right: Record<string, ToolSettingValue> | undefined
) {
  return stableSettingValueKey(left ?? {}) === stableSettingValueKey(right ?? {});
}

function presetToolIdsForFlowNode(node: FlowNode) {
  const ids = [node.id];
  const menuMatch = node.id.match(/^menu-(servers|cad|revit|excel|tekla|workflow)-(.+)$/);
  if (menuMatch?.[2]) {
    ids.push(menuMatch[2]);
  }
  return Array.from(new Set(ids.filter(Boolean)));
}

function primaryPresetToolIdForFlowNode(node: FlowNode) {
  return presetToolIdsForFlowNode(node).at(-1) ?? node.id;
}

function listSettingPresetsForFlowNode(presets: SettingPreset[], node: FlowNode) {
  const ids = new Set(presetToolIdsForFlowNode(node));
  return presets
    .filter((preset) => ids.has(preset.toolId))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

function rowValueAsText(row: Record<string, string | number | boolean>, field: ToolSettingField) {
  const valueKey = field.valueKey || "value";
  return String(row[valueKey] ?? row.value ?? row.file_path ?? "");
}

function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function fileListSummaryLabels(row: Record<string, string | number | boolean>, field: ToolSettingField) {
  const countKey = field.summaryCountKey || "title_block_count";
  const rangeKey = field.summaryRangeKey || "number_range";
  const countValue = row[countKey] ?? row.file_title_block_count;
  const rangeValue = row[rangeKey] ?? row.file_number_range;

  return {
    countLabel:
      countValue === undefined || countValue === ""
        ? field.pendingSummaryLabel || "미분석"
        : `도곽 ${countValue}개`,
    rangeLabel:
      rangeValue === undefined || rangeValue === ""
        ? field.pendingRangeLabel || "미리보기 필요"
        : String(rangeValue),
    pending: countValue === undefined || countValue === "" || rangeValue === undefined || rangeValue === ""
  };
}

const toolRiskLabels: Record<ToolRuntimeSchema["risk"], string> = {
  read: "읽기 전용",
  create: "파일/객체 생성",
  modify: "원본 수정",
  "bulk-modify": "대량 수정",
  delete: "삭제/덮어쓰기",
  safe: "안전",
  caution: "주의 필요"
};

type SettingPresetSaveOptions = {
  presetId?: string;
  name?: string;
};

const titleBlockCandidateValueKey = "title_block_candidate_id";

function toolActionLabel(action: { label: string; runtimeAction: string }) {
  if (action.runtimeAction === "preview") {
    return "미리보기";
  }
  if (action.runtimeAction === "apply") {
    return "실행";
  }
  return action.label;
}

function schemaRequiredServerLabel(schema: ToolRuntimeSchema) {
  return schema.requiredServers.length > 0
    ? `필요 MCP: ${schema.requiredServers.join(", ")}`
    : "필요 MCP 서버 없음";
}

function ToolRiskSummary({ schema }: { schema?: ToolRuntimeSchema }) {
  if (!schema) {
    return null;
  }
  const safeSchema = normalizeToolRuntimeSchemaForRender(schema);

  return (
    <div className={`schemaRiskBar toolPrincipleRiskSummary risk-${safeSchema.risk}`}>
      <span>{toolRiskLabels[safeSchema.risk]}</span>
      <small>{schemaRequiredServerLabel(safeSchema)}</small>
    </div>
  );
}

function isTitleBlockCandidateSchema(schema: ToolRuntimeSchema) {
  const text = [
    ...schema.settings.flatMap((field) => [field.id, field.label, field.description]),
    ...schema.mcpCommands.flatMap((command) => [command.server, command.command]),
    schema.resultSchema.type
  ]
    .join(" ")
    .toLowerCase();

  return (
    text.includes("도곽") ||
    (text.includes("title") && text.includes("block")) ||
    text.includes("title_block")
  );
}

function operationPrincipleStepsForTool(
  menuLabel: string,
  toolLabel: string,
  schemaInput?: ToolRuntimeSchema,
  fallbackDescription?: string
) {
  const schema = schemaInput
    ? normalizeToolRuntimeSchemaForRender(schemaInput)
    : undefined;

  if (schema && isTitleBlockCandidateSchema(schema)) {
    return [
      {
        title: "도면 입력",
        description: "DWG 도면을 넣고 처리할 파일 순서를 확정합니다."
      },
      {
        title: "도곽 후보 선택",
        description: "첫 도면에서 도곽 후보를 뽑아 사용자가 기준 도곽을 선택합니다."
      },
      {
        title: "번호 규칙 적용",
        description: "도곽 순서와 번호 규칙을 기준으로 미리보기 후 실행합니다."
      }
    ];
  }

  if (schema) {
    return [
      {
        title: "입력 기준 정리",
        description: `${toolLabel} 실행에 필요한 파일, 선택 범위, 옵션을 먼저 정리합니다.`
      },
      {
        title: "MCP 연결",
        description: schema.requiredServers.length > 0
          ? `${schema.requiredServers.join(", ")} MCP에 설정값을 전달합니다.`
          : `${menuLabel} 작업에 맞는 실행 기준을 준비합니다.`
      },
      {
        title: "결과 확인",
        description: "미리보기나 실행 결과를 확인하고 필요한 후속 작업으로 이어갑니다."
      }
    ];
  }

  return [
    {
      title: "입력 수집",
      description: fallbackDescription || "파일, 객체, 선택 범위처럼 실행에 필요한 기준을 먼저 모읍니다."
    },
    {
      title: "MCP 명령 연결",
      description: "정리된 입력값을 연결된 MCP 서버의 실제 명령으로 넘깁니다."
    },
    {
      title: "결과 확인",
      description: "실행 결과와 후속 확인 항목을 기록해 다음 작업으로 이어갑니다."
    }
  ];
}

function operationPrincipleSteps(menuLabel: string, submenu: SubmenuItem) {
  return operationPrincipleStepsForTool(
    menuLabel,
    submenu.label,
    submenu.settingsSchema,
    submenu.description
  );
}

const issueToneLabels: Record<ToolRuntimeIssue["severity"], string> = {
  error: "오류",
  warning: "경고",
  info: "정보"
};

function defaultSettingValuesForSchema(schema: ToolRuntimeSchema) {
  const safeSchema = normalizeToolRuntimeSchemaForRender(schema);
  return safeSchema.settings.reduce<Record<string, ToolSettingValue>>((values, field) => {
    values[field.id] = settingDefaultValue(field);
    return values;
  }, {});
}

function settingValueForField(
  field: ToolSettingField,
  values: Record<string, ToolSettingValue> | undefined
) {
  return values?.[field.id] ?? settingDefaultValue(field);
}

function isSettingVisible(
  field: ToolSettingField,
  allFields: ToolSettingField[],
  values: Record<string, ToolSettingValue> | undefined
) {
  if (!field.visibleWhen) {
    return true;
  }
  const source = allFields.find((candidate) => candidate.id === field.visibleWhen?.field);
  const current = source ? settingValueForField(source, values) : values?.[field.visibleWhen.field];
  return String(current) === String(field.visibleWhen.equals);
}

function ToolRuntimeIssueList({ issues }: { issues: ToolRuntimeIssue[] }) {
  if (issues.length === 0) {
    return <p className="schemaReadyNote">설정 schema에서 바로 막을 문제는 없습니다.</p>;
  }

  return (
    <div className="schemaIssueList">
      {issues.map((issue) => (
        <div className={`schemaIssueItem ${issue.severity}`} key={issue.id}>
          <strong>
            {issueToneLabels[issue.severity]} · {issue.title}
          </strong>
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  );
}

function ToolExecutionPlanPanel({
  schema,
  values,
  compact = false
}: {
  schema: ToolRuntimeSchema;
  values?: Record<string, ToolSettingValue>;
  compact?: boolean;
}) {
  const safeSchema = normalizeToolRuntimeSchemaForRender(schema);
  const plan = buildToolExecutionPlan(safeSchema, values);

  return (
    <section className={["schemaExecutionPlan", compact ? "compact" : ""].filter(Boolean).join(" ")}>
      <header>
        <span>테스트 실행 요약</span>
        <small>{safeSchema.executionMode}</small>
      </header>
      <div className="schemaExecutionSummary">
        {plan.summary.length > 0 ? (
          plan.summary.slice(0, compact ? 4 : 8).map((item) => <span key={item}>{item}</span>)
        ) : (
          <span>실행 전 요약 항목이 없습니다.</span>
        )}
      </div>
      {plan.commands.length > 0 ? (
        <div className="schemaCommandList">
          {plan.commands.map((command) => (
            <div className="schemaCommandItem" key={`${command.index}-${command.server}-${command.command}`}>
              <strong>
                {command.index}. {command.server}.{command.command}
              </strong>
              <small>{command.status}</small>
              {Object.keys(command.params).length > 0 ? (
                <code>{JSON.stringify(command.params)}</code>
              ) : null}
              {command.condition ? <small>조건: {command.condition}</small> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="schemaReadyNote">아직 연결할 MCP 명령이 없습니다. 수동 실행 또는 예정 명령으로 볼 수 있습니다.</p>
      )}
      <p className="schemaSampleResult">{plan.sampleResult}</p>
    </section>
  );
}

function ToolExecutionActions({
  schema,
  values,
  onRuntimeValueChange,
  toolName = "MCP 툴",
  menuName = "MCP"
}: {
  schema: ToolRuntimeSchema;
  values?: Record<string, ToolSettingValue>;
  onRuntimeValueChange?: (key: string, value: ToolSettingValue) => void;
  toolName?: string;
  menuName?: string;
}) {
  const [previewGenerated, setPreviewGenerated] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [isRunningAction, setIsRunningAction] = useState(false);
  const [titleBlockCandidates, setTitleBlockCandidates] = useState<TitleBlockCandidate[]>([]);
  const safeSchema = normalizeToolRuntimeSchemaForRender(schema);
  const actions = safeSchema.actions;
  const previewRows = previewGenerated ? buildToolPreviewSummary(safeSchema, values) : [];
  const visibleSettingCount = safeSchema.settings.filter((field) => !field.hidden).length;
  const fileListField = safeSchema.settings.find(
    (field) => field.type === "repeatable-list" && field.itemType === "file"
  );
  const fileListValue = fileListField && values ? values[fileListField.id] : undefined;
  const fileCount = Array.isArray(fileListValue) ? fileListValue.length : 0;
  const usesTitleBlockCandidates = isTitleBlockCandidateSchema(safeSchema);
  const candidateOptions = usesTitleBlockCandidates ? titleBlockCandidates : [];
  const selectedCandidateId = valueAsText(values?.[titleBlockCandidateValueKey]);
  const runToolAction = async (action: ToolRuntimeSchema["actions"][number]) => {
    const request = buildToolExecutionRequest({
      toolName,
      menuName,
      runtimeAction: action.runtimeAction,
      schema: safeSchema,
      values
    });

    if (!window.toolExecution?.run) {
      if (action.runtimeAction === "preview") {
        setPreviewGenerated(true);
        setTitleBlockCandidates([]);
      }
      setActionMessage("AI/MCP 실행 통로가 아직 연결되지 않았습니다. 실행 요청은 만들 수 있지만 실제 프로그램 호출은 비활성 상태입니다.");
      return;
    }

    setIsRunningAction(true);
    try {
      const result = await window.toolExecution.run(request);
      if (action.runtimeAction === "preview") {
        setPreviewGenerated(result.status === "preview" || result.status === "completed");
        setTitleBlockCandidates(result.titleBlockCandidates ?? []);
      }
      setActionMessage(result.message);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "툴 실행 요청 중 오류가 발생했습니다.");
    } finally {
      setIsRunningAction(false);
    }
  };

  if (actions.length === 0) {
    return null;
  }

  return (
    <section className="schemaSettingsSection schemaActionSection">
      <header>
        <span>실행</span>
        <small>입력값을 확인하고 미리보기 후 실행합니다.</small>
      </header>
      <div className="schemaWorkflowSteps" aria-label="실행 단계">
        <div className="schemaWorkflowStep complete">
          <strong>1</strong>
          <span>입력</span>
          <small>{fileListField ? `${fileCount}개 파일` : `${visibleSettingCount}개 항목`}</small>
        </div>
        <div className={previewGenerated ? "schemaWorkflowStep complete" : "schemaWorkflowStep active"}>
          <strong>2</strong>
          <span>미리보기</span>
          <small>{previewGenerated ? "미리보기 완료" : "대기"}</small>
        </div>
        <div className={previewGenerated ? "schemaWorkflowStep active" : "schemaWorkflowStep"}>
          <strong>3</strong>
          <span>실행</span>
          <small>{previewGenerated ? "확인 가능" : "미리보기 필요"}</small>
        </div>
      </div>
      <div className="schemaActionButtons">
        {actions.map((action) => {
          const blockedByPreview = action.requiresPreview && !previewGenerated;
          const blockedByCandidate =
            action.runtimeAction === "apply" &&
            previewGenerated &&
            usesTitleBlockCandidates &&
            !selectedCandidateId;
          const isPrimary =
            action.runtimeAction === "apply" ? previewGenerated : action.primary;

          return (
            <button
              className={[
                "schemaActionButton",
                isPrimary ? "primaryAction" : "secondaryAction"
              ].join(" ")}
              disabled={isRunningAction || blockedByPreview || blockedByCandidate}
              key={action.id}
              onClick={() => {
                if (action.runtimeAction === "preview") {
                  void runToolAction(action);
                  return;
                }
                if (action.runtimeAction === "apply") {
                  void runToolAction(action);
                  return;
                }
                setActionMessage(action.description || `${action.label} 작업을 선택했습니다.`);
              }}
              title={
                blockedByCandidate
                  ? "도곽 후보를 먼저 선택하세요."
                  : action.description || action.label
              }
              type="button"
            >
              {toolActionLabel(action)}
            </button>
          );
        })}
      </div>
      <div className="schemaActionResult">
        {previewGenerated ? (
          previewRows.length > 0 ? (
            <div className="schemaPreviewResultRows">
              {previewRows.map((row) => (
                <div className="schemaPreviewResultRow" key={row.id}>
                  <span>{row.fileName}</span>
                  <small>{row.countLabel}</small>
                  <strong>{row.rangeLabel}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p>파일을 추가하면 분석 미리보기 결과가 여기에 표시됩니다.</p>
          )
        ) : (
          <p>미리보기를 누르면 파일별 도곽 수와 배정 번호 범위를 먼저 확인합니다.</p>
        )}
      </div>
      {previewGenerated && candidateOptions.length > 0 ? (
        <div className="schemaCandidatePanel">
          <header>
            <span>도곽 후보 선택</span>
            <small>첫 도면에서 감지한 후보 중 기준 도곽을 고릅니다.</small>
          </header>
          <div className="schemaCandidateList">
            {candidateOptions.map((candidate) => (
              <button
                className={selectedCandidateId === candidate.id ? "selected" : ""}
                key={candidate.id}
                onClick={() => onRuntimeValueChange?.(titleBlockCandidateValueKey, candidate.id)}
                type="button"
              >
                <strong>{candidate.label}</strong>
                <span>{candidate.detail}</span>
              </button>
            ))}
          </div>
          {!selectedCandidateId ? (
            <p className="schemaActionHint">실행 전에 기준 도곽 후보를 선택해야 합니다.</p>
          ) : null}
        </div>
      ) : null}
      {previewGenerated && usesTitleBlockCandidates && candidateOptions.length === 0 ? (
        <p className="schemaActionHint">
          CAD MCP에서 도곽 블록 후보가 아직 반환되지 않았습니다. 실제 블록명/배치명을 받으면 여기에 표시됩니다.
        </p>
      ) : null}
      {actionMessage ? <p className="schemaActionHint">{actionMessage}</p> : null}
      {actions.some((action) => action.requiresPreview) && !previewGenerated ? (
        <p className="schemaActionHint">미리보기 결과가 생성되면 실행 버튼이 활성화됩니다.</p>
      ) : null}
    </section>
  );
}

function ToolSchemaPreviewPanel({ schema }: { schema: ToolRuntimeSchema }) {
  const safeSchema = normalizeToolRuntimeSchemaForRender(schema);
  const values = defaultSettingValuesForSchema(safeSchema);
  const definitionIssues = validateToolRuntimeSchema(safeSchema);
  const valueIssues = validateToolSettingsValues(safeSchema, values);
  const sections = safeSchema.settingsLayout.sections.length
    ? safeSchema.settingsLayout.sections
    : [{ id: "basic", label: "기본 설정", defaultOpen: true }];
  const fieldsBySection = new Map<string, ToolSettingField[]>();

  safeSchema.settings.filter((field) => !field.hidden).forEach((field) => {
    const sectionId = field.section ?? (field.advanced ? "advanced" : sections[0].id);
    fieldsBySection.set(sectionId, [...(fieldsBySection.get(sectionId) ?? []), field]);
  });

  return (
    <section className="toolSchemaPreviewPanel">
      <div className="panelHeader compactPanelHeader">
        <h2>설정창 미리보기</h2>
        <span className="panelHeaderNote">MD 파일이 앱에서 어떤 설정창으로 보일지 확인합니다.</span>
      </div>
      <div className={`schemaRiskBar risk-${safeSchema.risk}`}>
        <span>{toolRiskLabels[safeSchema.risk]}</span>
        <small>
          {safeSchema.requiredServers.length > 0
            ? `필요 MCP: ${safeSchema.requiredServers.join(", ")}`
            : "필요 MCP 서버 없음"}
        </small>
      </div>
      <div className="toolSchemaPreviewGrid">
        {sections.map((section) => {
          const fields = fieldsBySection.get(section.id) ?? [];
          if (fields.length === 0) {
            return null;
          }

          return (
            <div className="toolSchemaPreviewSection" key={section.id}>
              <strong>{section.label}</strong>
              {fields.map((field) => (
                <div className="toolSchemaPreviewField" key={field.id}>
                  <span>{field.label}</span>
                  <small>
                    {field.type}
                    {field.required ? " · 필수" : ""}
                    {field.advanced ? " · 고급" : ""}
                  </small>
                  <em>{valueAsText(settingDefaultValue(field)) || "미입력"}</em>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <ToolExecutionActions schema={safeSchema} values={values} />
      <div className="toolSchemaPortPreview">
        <div>
          <strong>입력</strong>
          <span>
            {safeSchema.inputs.length > 0
              ? safeSchema.inputs.map((port) => `${port.label}(${port.type})`).join(", ")
              : "입력 포트 없음"}
          </span>
        </div>
        <div>
          <strong>출력</strong>
          <span>
            {safeSchema.outputs.length > 0
              ? safeSchema.outputs.map((port) => `${port.label}(${port.type})`).join(", ")
              : safeSchema.resultSchema.type}
          </span>
        </div>
      </div>
      <ToolRuntimeIssueList issues={[...definitionIssues, ...valueIssues]} />
      <ToolExecutionPlanPanel schema={safeSchema} values={values} />
    </section>
  );
}

function SettingPresetLoadDialog({
  presets,
  values,
  activePresetId,
  onClose,
  onLoadPreset,
  onDeletePreset,
  onRenamePreset
}: {
  presets: SettingPreset[];
  values?: Record<string, ToolSettingValue>;
  activePresetId: string;
  onClose: () => void;
  onLoadPreset?: (preset: SettingPreset) => void;
  onDeletePreset?: (presetId: string) => void;
  onRenamePreset?: (presetId: string, name: string) => void;
}) {
  const [editingPresetId, setEditingPresetId] = useState("");
  const [editingPresetName, setEditingPresetName] = useState("");
  const selectedPresetId =
    activePresetId ||
    presets.find((preset) => areSettingValuesEqual(values, preset.values))?.id ||
    "";

  return (
    <div className="dialogBackdrop nestedDialogBackdrop" role="presentation" onClick={onClose}>
      <div
        className="dialogWindow schemaPresetDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schema-preset-dialog-title"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="dialogHeader">
          <div>
            <h2 id="schema-preset-dialog-title">저장한 설정 불러오기</h2>
            <span>저장해 둔 설정을 선택하면 현재 설정창에 그대로 입력됩니다.</span>
          </div>
          <div className="dialogHeaderActions">
            <button className="dialogWindowButton" type="button" onClick={onClose} aria-label="닫기">
              ×
            </button>
          </div>
        </div>
        <div className="schemaPresetDialogBody">
          {presets.length > 0 ? (
            <div className="schemaPresetList">
              {presets.map((preset) => {
                const isSelectedPreset = selectedPresetId === preset.id;
                return (
                  <div
                    className={["schemaPresetItem", isSelectedPreset ? "selected" : ""]
                      .filter(Boolean)
                      .join(" ")}
                    key={preset.id}
                  >
                    {editingPresetId === preset.id ? (
                      <div className="schemaPresetEdit">
                        <input
                          autoFocus
                          value={editingPresetName}
                          onChange={(event) => setEditingPresetName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              onRenamePreset?.(preset.id, editingPresetName);
                              setEditingPresetId("");
                            }
                            if (event.key === "Escape") {
                              setEditingPresetId("");
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            onRenamePreset?.(preset.id, editingPresetName);
                            setEditingPresetId("");
                          }}
                        >
                          저장
                        </button>
                        <button type="button" onClick={() => setEditingPresetId("")}>
                          취소
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="schemaPresetLoad"
                          aria-pressed={isSelectedPreset}
                          onClick={() => {
                            onLoadPreset?.(preset);
                            onClose();
                          }}
                        >
                          <strong>{preset.name}</strong>
                          <small>{new Date(preset.updatedAt).toLocaleString()}</small>
                        </button>
                        <button
                          type="button"
                          className="schemaPresetRename"
                          onClick={() => {
                            setEditingPresetId(preset.id);
                            setEditingPresetName(preset.name);
                          }}
                          aria-label={`${preset.name} 설정 이름 변경`}
                          title="이름 변경"
                        >
                          <AppIcon name="edit" />
                        </button>
                        <button
                          type="button"
                          className="schemaPresetDelete"
                          onClick={() => onDeletePreset?.(preset.id)}
                          aria-label={`${preset.name} 설정 삭제`}
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="schemaPresetEmpty">저장한 설정이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingPresetControls({
  presets,
  values,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onRenamePreset,
  showCurrentNote = true,
  inline = false
}: {
  presets: SettingPreset[];
  values?: Record<string, ToolSettingValue>;
  onSavePreset?: (options?: SettingPresetSaveOptions) => void;
  onLoadPreset?: (preset: SettingPreset) => void;
  onDeletePreset?: (presetId: string) => void;
  onRenamePreset?: (presetId: string, name: string) => void;
  showCurrentNote?: boolean;
  inline?: boolean;
}) {
  const [activePresetId, setActivePresetId] = useState("");
  const [isPresetDialogOpen, setIsPresetDialogOpen] = useState(false);
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const selectedPreset =
    presets.find((preset) => preset.id === activePresetId) ??
    presets.find((preset) => areSettingValuesEqual(values, preset.values));
  const saveCurrentPreset = () => {
    onSavePreset?.(selectedPreset ? { presetId: selectedPreset.id } : undefined);
    if (selectedPreset) {
      setActivePresetId(selectedPreset.id);
    }
  };
  const saveAsPreset = () => {
    onSavePreset?.({
      name: saveAsName.trim() || `${new Date().toLocaleString("ko-KR")} 설정`
    });
    setSaveAsName("");
    setIsSaveAsOpen(false);
    setIsSaveMenuOpen(false);
  };
  const loadPreset = (preset: SettingPreset) => {
    setActivePresetId(preset.id);
    onLoadPreset?.(preset);
  };

  return (
    <div className={["schemaPresetControls", inline ? "inline" : ""].filter(Boolean).join(" ")}>
      <div className="schemaPresetToolbar">
        <div className="schemaSplitSave">
          <button
            className="primaryAction schemaPresetSaveButton"
            type="button"
            onClick={saveCurrentPreset}
            disabled={!onSavePreset}
            title={selectedPreset ? `${selectedPreset.name}에 덮어쓰기` : "현재 설정을 새 저장본으로 저장"}
          >
            저장
          </button>
          <button
            className="primaryAction schemaPresetArrowButton"
            type="button"
            onClick={() => setIsSaveMenuOpen((current) => !current)}
            disabled={!onSavePreset}
            aria-label="저장 옵션"
          >
            ▾
          </button>
          {isSaveMenuOpen ? (
            <div className="schemaPresetDropdown">
              <button
                type="button"
                onClick={() => {
                  setIsSaveAsOpen(true);
                  setSaveAsName(`${new Date().toLocaleString("ko-KR")} 설정`);
                  setIsSaveMenuOpen(false);
                }}
              >
                다른 이름으로 저장
              </button>
            </div>
          ) : null}
        </div>
        <button
          className="secondaryAction schemaPresetLoadButton"
          type="button"
          onClick={() => setIsPresetDialogOpen(true)}
          disabled={!onLoadPreset}
        >
          불러오기
        </button>
      </div>
      {showCurrentNote ? (
        selectedPreset ? (
          <p className="schemaPresetCurrent">
            선택됨: <strong>{selectedPreset.name}</strong>
          </p>
        ) : (
          <p className="schemaPresetEmpty">저장 후 불러오기에서 저장본을 관리할 수 있습니다.</p>
        )
      ) : null}
      {isSaveAsOpen ? (
        <div className="schemaPresetSaveAs">
          <input
            autoFocus
            value={saveAsName}
            onChange={(event) => setSaveAsName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                saveAsPreset();
              }
              if (event.key === "Escape") {
                setIsSaveAsOpen(false);
                setSaveAsName("");
              }
            }}
            placeholder="저장 이름"
          />
          <button className="primaryAction" type="button" onClick={saveAsPreset}>
            저장
          </button>
          <button
            className="secondaryAction"
            type="button"
            onClick={() => {
              setIsSaveAsOpen(false);
              setSaveAsName("");
            }}
          >
            취소
          </button>
        </div>
      ) : null}
      {isPresetDialogOpen ? (
        <SettingPresetLoadDialog
          presets={presets}
          values={values}
          activePresetId={activePresetId}
          onClose={() => setIsPresetDialogOpen(false)}
          onLoadPreset={loadPreset}
          onDeletePreset={onDeletePreset}
          onRenamePreset={onRenamePreset}
        />
      ) : null}
    </div>
  );
}

function FlowNodeSchemaSettings({
  schema,
  values,
  onChange,
  presets = [],
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onRenamePreset,
  onRuntimeValueChange,
  showRiskBar = false,
  showPresetControls = true
}: {
  schema: ToolRuntimeSchema;
  values?: Record<string, ToolSettingValue>;
  onChange: (field: ToolSettingField, value: ToolSettingValue) => void;
  presets?: SettingPreset[];
  onSavePreset?: (options?: SettingPresetSaveOptions) => void;
  onLoadPreset?: (preset: SettingPreset) => void;
  onDeletePreset?: (presetId: string) => void;
  onRenamePreset?: (presetId: string, name: string) => void;
  onRuntimeValueChange?: (key: string, value: ToolSettingValue) => void;
  showRiskBar?: boolean;
  showPresetControls?: boolean;
}) {
  const safeSchema = normalizeToolRuntimeSchemaForRender(schema);
  const visibleFields = safeSchema.settings.filter((field) =>
    !field.hidden && isSettingVisible(field, safeSchema.settings, values)
  );
  const sections = safeSchema.settingsLayout.sections.length
    ? safeSchema.settingsLayout.sections
    : [{ id: "basic", label: "기본 설정", defaultOpen: true }];
  const [openSectionIds, setOpenSectionIds] = useState<string[]>(() =>
    sections.filter((section) => section.defaultOpen !== false).map((section) => section.id)
  );
  const fieldsBySection = new Map<string, ToolSettingField[]>();

  visibleFields.forEach((field) => {
    const sectionId = field.section ?? (field.advanced ? "advanced" : sections[0].id);
    fieldsBySection.set(sectionId, [...(fieldsBySection.get(sectionId) ?? []), field]);
  });

  const previewFields = visibleFields.filter((field) => field.preview || field.required);
  const executionPlan = buildToolExecutionPlan(safeSchema, values);
  const [openReviewPanel, setOpenReviewPanel] = useState<
    "summary" | "checks" | "validation" | "tests" | null
  >(null);
  const reviewTabs = [
    { id: "summary" as const, label: "실행 전 요약", icon: "preview" as AppIconName, count: previewFields.length },
    { id: "checks" as const, label: "점검", icon: "monitor" as AppIconName, count: safeSchema.preflightChecks.length },
    { id: "validation" as const, label: "검증", icon: "settings" as AppIconName, count: executionPlan.issues.length },
    { id: "tests" as const, label: "테스트 요약", icon: "customTools" as AppIconName, count: safeSchema.testCases.length }
  ];

  return (
    <>
    <div className="flowSchemaSettings" onPointerDown={(event) => event.stopPropagation()}>
      {showRiskBar ? <ToolRiskSummary schema={safeSchema} /> : null}

      <ToolExecutionActions
        schema={safeSchema}
        values={values}
        onRuntimeValueChange={onRuntimeValueChange}
      />

      {showPresetControls ? (
      <section className="schemaSettingsSection schemaPresetSection">
        <header>
          <span>저장한 설정</span>
          <SettingPresetControls
            presets={presets}
            values={values}
            onSavePreset={onSavePreset}
            onLoadPreset={onLoadPreset}
            onDeletePreset={onDeletePreset}
            onRenamePreset={onRenamePreset}
            showCurrentNote={false}
          />
        </header>
      </section>
      ) : null}

      {sections.map((section, sectionIndex) => {
        const fields = fieldsBySection.get(section.id) ?? [];
        if (fields.length === 0) {
          return null;
        }
        const isOpen = openSectionIds.includes(section.id);

        return (
          <section className="schemaSettingsSection" key={section.id}>
            <button
              className="schemaSectionToggle"
              onClick={() =>
                setOpenSectionIds((current) =>
                  current.includes(section.id)
                    ? current.filter((id) => id !== section.id)
                    : [...current, section.id]
                )
              }
              type="button"
            >
              <span>
                {isOpen ? "▴" : "▾"}
                {safeSchema.settingsLayout.mode === "steps" ? `${sectionIndex + 1}. ` : ""}
                {section.label}
              </span>
              {section.defaultOpen === false ? <small>고급</small> : null}
            </button>
            {isOpen ? (
              <div className="schemaSettingsFields">
                {fields.map((field) => (
                  <SchemaSettingControl
                    field={field}
                    key={field.id}
                    value={settingValueForField(field, values)}
                    onChange={(value) => onChange(field, value)}
                  />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}

      <section className="schemaSettingsSection schemaReviewSection">
        <header>
          <span>검토</span>
          <small>아이콘을 누르면 세부 내용을 확인합니다.</small>
        </header>
        <div className="schemaReviewActions">
          {reviewTabs.map((tab) => (
            <button
              aria-label={tab.label}
              className={openReviewPanel === tab.id ? "active" : ""}
              key={tab.id}
              onClick={() => setOpenReviewPanel((current) => (current === tab.id ? null : tab.id))}
              title={tab.label}
              type="button"
            >
              <AppIcon name={tab.icon} />
              {tab.count > 0 ? <span>{tab.count}</span> : null}
            </button>
          ))}
        </div>
        {openReviewPanel ? (
          <div className="schemaReviewDetails">
            {openReviewPanel === "summary" ? (
              previewFields.length > 0 ? (
                <dl className="schemaPreviewSection">
                  {previewFields.map((field) => (
                    <Fragment key={field.id}>
                      <dt>{field.label}</dt>
                      <dd>{valueAsText(settingValueForField(field, values)) || "미입력"}</dd>
                    </Fragment>
                  ))}
                </dl>
              ) : (
                <p className="schemaReadyNote">실행 전 요약 항목이 없습니다.</p>
              )
            ) : null}
            {openReviewPanel === "checks" ? (
              safeSchema.preflightChecks.length > 0 ? (
                <div className="schemaCheckList">
                  {safeSchema.preflightChecks.map((check) => (
                    <div className={`schemaCheckItem ${check.severity}`} key={check.id}>
                      <strong>{check.label}</strong>
                      <span>{check.message}</span>
                      {check.fix ? <small>{check.fix}</small> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="schemaReadyNote">실행 전 점검 항목이 없습니다.</p>
              )
            ) : null}
            {openReviewPanel === "validation" ? <ToolRuntimeIssueList issues={executionPlan.issues} /> : null}
            {openReviewPanel === "tests" ? (
              <>
                <ToolExecutionPlanPanel schema={safeSchema} values={values} compact />
                {safeSchema.testCases.length > 0 ? (
                  <div className="schemaTestCaseList">
                    {safeSchema.testCases.map((testCase) => (
                      <div className="schemaTestCaseItem" key={testCase.name}>
                        <strong>{testCase.name}</strong>
                        <span>{testCase.expect}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
    </>
  );
}

function SchemaSettingControl({
  field,
  value,
  onChange
}: {
  field: ToolSettingField;
  value: ToolSettingValue;
  onChange: (value: ToolSettingValue) => void;
}) {
  const options = defaultSettingOptions(field);
  const textValue = valueAsText(value);
  const commonLabel = (
    <span>
      {field.label}
      {field.required ? <b aria-label="필수">*</b> : null}
    </span>
  );
  const description = field.description ? <small>{field.description}</small> : null;
  const rowValue = Array.isArray(value)
    ? value.filter((item): item is Record<string, string | number | boolean> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )
    : [];
  const updateRows = (rows: Record<string, string | number | boolean>[]) => onChange(rows);

  const addStructuredRow = (row: Record<string, string | number | boolean>) => {
    updateRows([...rowValue, row]);
  };

  const updateStructuredRow = (index: number, key: string, nextValue: string) => {
    updateRows(
      rowValue.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]: nextValue
            }
          : row
      )
    );
  };

  const removeStructuredRow = (index: number) => {
    updateRows(rowValue.filter((_, rowIndex) => rowIndex !== index));
  };

  const moveStructuredRow = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= rowValue.length) {
      return;
    }
    const nextRows = [...rowValue];
    const [row] = nextRows.splice(index, 1);
    nextRows.splice(nextIndex, 0, row);
    updateRows(nextRows);
  };

  if (field.type === "checkbox" || field.type === "dry-run") {
    return (
      <label className="schemaSettingControl checkbox">
        <input
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span>
          {field.label}
          {description}
        </span>
      </label>
    );
  }

  if (field.type === "multi-select") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    if (options.length === 0) {
      return (
        <label className="schemaSettingControl">
          {commonLabel}
          <textarea
            onChange={(event) =>
              onChange(
                event.target.value
                  .split(/\r?\n|,/)
                  .map((item) => item.trim())
                  .filter(Boolean)
              )
            }
            placeholder={field.placeholder || "값을 한 줄에 하나씩 입력하세요."}
            value={selected.join("\n")}
          />
          {description}
        </label>
      );
    }

    return (
      <div className="schemaSettingControl">
        {commonLabel}
        <div className="schemaOptionGrid">
          {options.map((option) => (
            <label key={option.value}>
              <input
                checked={selected.includes(option.value)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, option.value]
                      : selected.filter((item) => item !== option.value)
                  )
                }
                type="checkbox"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        {description}
      </div>
    );
  }

  if (isSelectLikeSetting(field.type) && options.length > 0) {
    return (
      <label className="schemaSettingControl">
        {commonLabel}
        <select value={textValue} onChange={(event) => onChange(event.target.value)}>
          <option value="">선택</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {description}
      </label>
    );
  }

  if (field.type === "mapping-table") {
    return (
      <div className="schemaSettingControl schemaStructuredControl">
        {commonLabel}
        <div className="schemaStructuredRows">
          {rowValue.map((row, index) => (
            <div className="schemaStructuredRow threeColumns" key={index}>
              <input
                value={String(row.source ?? "")}
                onChange={(event) => updateStructuredRow(index, "source", event.target.value)}
                placeholder="원본 값"
              />
              <input
                value={String(row.target ?? "")}
                onChange={(event) => updateStructuredRow(index, "target", event.target.value)}
                placeholder="대상 값"
              />
              <button type="button" onClick={() => removeStructuredRow(index)} aria-label="행 삭제">
                ×
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addStructuredRow({ source: "", target: "" })}>
            행 추가
          </button>
        </div>
        {description}
      </div>
    );
  }

  if (field.type === "filter-builder") {
    return (
      <div className="schemaSettingControl schemaStructuredControl">
        {commonLabel}
        <div className="schemaStructuredRows">
          {rowValue.map((row, index) => (
            <div className="schemaStructuredRow filterColumns" key={index}>
              <input
                value={String(row.field ?? "")}
                onChange={(event) => updateStructuredRow(index, "field", event.target.value)}
                placeholder="필드"
              />
              <select
                value={String(row.operator ?? "contains")}
                onChange={(event) => updateStructuredRow(index, "operator", event.target.value)}
              >
                <option value="contains">포함</option>
                <option value="equals">같음</option>
                <option value="not_equals">다름</option>
                <option value="greater_than">초과</option>
                <option value="less_than">미만</option>
              </select>
              <input
                value={String(row.value ?? "")}
                onChange={(event) => updateStructuredRow(index, "value", event.target.value)}
                placeholder="값"
              />
              <button type="button" onClick={() => removeStructuredRow(index)} aria-label="조건 삭제">
                ×
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addStructuredRow({ field: "", operator: "contains", value: "" })}>
            조건 추가
          </button>
        </div>
        {description}
      </div>
    );
  }

  if (field.type === "sort-rule") {
    return (
      <div className="schemaSettingControl schemaStructuredControl">
        {commonLabel}
        <div className="schemaStructuredRows">
          {rowValue.map((row, index) => (
            <div className="schemaStructuredRow threeColumns" key={index}>
              <input
                value={String(row.field ?? "")}
                onChange={(event) => updateStructuredRow(index, "field", event.target.value)}
                placeholder="정렬 필드"
              />
              <select
                value={String(row.direction ?? "asc")}
                onChange={(event) => updateStructuredRow(index, "direction", event.target.value)}
              >
                <option value="asc">오름차순</option>
                <option value="desc">내림차순</option>
              </select>
              <button type="button" onClick={() => removeStructuredRow(index)} aria-label="정렬 삭제">
                ×
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addStructuredRow({ field: "", direction: "asc" })}>
            정렬 추가
          </button>
        </div>
        {description}
      </div>
    );
  }

  if (field.type === "repeatable-list") {
    const valueKey = field.valueKey || "value";
    const isFileList = field.itemType === "file";
    if (isFileList) {
      return (
        <div className="schemaSettingControl schemaStructuredControl">
          {commonLabel}
          <div className="schemaStructuredRows schemaFileListRows">
            {rowValue.map((row, index) => {
              const filePath = rowValueAsText(row, field);
              const summary = field.showItemSummary ? fileListSummaryLabels(row, field) : null;
              return (
                <div
                  className={[
                    "schemaStructuredRow",
                    "fileListColumns",
                    summary ? "withSummary" : ""
                  ].filter(Boolean).join(" ")}
                  key={`${filePath}-${index}`}
                >
                  <span title={filePath}>{fileNameFromPath(filePath) || "선택한 파일"}</span>
                  {summary ? (
                    <>
                      <small className={summary.pending ? "pending" : ""}>{summary.countLabel}</small>
                      <small className={summary.pending ? "pending" : ""}>{summary.rangeLabel}</small>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => moveStructuredRow(index, -1)}
                    aria-label="위로 이동"
                    disabled={index === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStructuredRow(index, 1)}
                    aria-label="아래로 이동"
                    disabled={index === rowValue.length - 1}
                  >
                    ↓
                  </button>
                  <button type="button" onClick={() => removeStructuredRow(index)} aria-label="항목 삭제">
                    ×
                  </button>
                </div>
              );
            })}
            <label className="schemaFileAddButton">
              항목 추가
              <input
                accept={field.accept}
                multiple
                onChange={(event) => {
                  const selectedFiles = Array.from(event.target.files ?? []) as (File & { path?: string })[];
                  const existing = new Set(rowValue.map((row) => rowValueAsText(row, field)));
                  const rowsToAdd = selectedFiles
                    .map((file) => file.path || file.name)
                    .filter((path) => path && !existing.has(path))
                    .map((path) => ({
                      [valueKey]: path
                    }));
                  if (rowsToAdd.length > 0) {
                    updateRows([...rowValue, ...rowsToAdd]);
                  }
                  event.target.value = "";
                }}
                type="file"
              />
            </label>
          </div>
          {description}
        </div>
      );
    }

    return (
      <div className="schemaSettingControl schemaStructuredControl">
        {commonLabel}
        <div className="schemaStructuredRows">
          {rowValue.map((row, index) => (
            <div className="schemaStructuredRow twoColumns" key={index}>
              <input
                value={String(row.value ?? "")}
                onChange={(event) => updateStructuredRow(index, "value", event.target.value)}
                placeholder="값"
              />
              <button type="button" onClick={() => removeStructuredRow(index)} aria-label="항목 삭제">
                ×
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addStructuredRow({ value: "" })}>
            항목 추가
          </button>
        </div>
        {description}
      </div>
    );
  }

  if (["textarea"].includes(field.type)) {
    return (
      <label className="schemaSettingControl">
        {commonLabel}
        <textarea
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder || "한 줄에 하나씩 입력하거나 JSON 형태로 입력하세요."}
          value={textValue}
        />
        {description}
      </label>
    );
  }

  if (field.type === "color") {
    return (
      <label className="schemaSettingControl color">
        {commonLabel}
        <input type="color" value={textValue || "#2563eb"} onChange={(event) => onChange(event.target.value)} />
        {description}
      </label>
    );
  }

  return (
    <label className="schemaSettingControl">
      {commonLabel}
      <input
        accept={field.accept}
        max={field.max}
        min={field.min}
        onChange={(event) =>
          onChange(field.type === "number" || field.type === "tolerance" ? Number(event.target.value) : event.target.value)
        }
        placeholder={field.placeholder}
        step={field.step}
        type={field.type === "number" || field.type === "tolerance" ? "number" : "text"}
        value={textValue}
      />
      {description}
    </label>
  );
}

function FlowNodeResultPreview({ record }: { record?: FlowRunRecord }) {
  if (!record) {
    return (
      <div className="flowNodeResultPreview empty">
        <strong>중간결과 미리보기</strong>
        <p>아직 이 노드의 실행 결과가 없습니다. 실행 버튼을 누르면 예상 결과와 영향 범위가 표시됩니다.</p>
      </div>
    );
  }

  const firstRowKeys = Object.keys(record.preview.rows[0] ?? {});

  return (
    <div className="flowNodeResultPreview">
      <div className="flowNodeResultHeader">
        <span className={`flowRunStatusPill ${record.status}`}>
          {flowRunStatusLabels[record.status]}
        </span>
        <strong>{record.preview.title}</strong>
      </div>
      <p>{record.preview.summary}</p>
      <div className="flowNodeResultMetrics">
        {record.preview.metrics.map((metric) => (
          <div key={`${metric.label}-${metric.value}`}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
      {record.preview.rows.length > 0 ? (
        <div className="flowResultTableWrap">
          <table className="flowResultTable">
            <thead>
              <tr>
                {firstRowKeys.map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {record.preview.rows.map((row, rowIndex) => (
                <tr key={`${record.nodeId}-preview-${rowIndex}`}>
                  {firstRowKeys.map((key) => (
                    <td key={key}>{row[key] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className={`flowImpactBox ${record.impact.tone}`}>
        <strong>실행 전 영향 범위: {record.impact.title}</strong>
        <ul>
          {record.impact.items.slice(0, 5).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function startSavedFlowDrag(event: DragEvent<HTMLElement>, flow: SavedCustomFlow) {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData("application/x-custom-flow", serializeSavedFlowForDrag(flow));
}

function flowCardMeta(flow: SavedCustomFlow) {
  return `노드 ${flow.graph.nodes.length} / 연결 ${flow.graph.connections.length}`;
}

function MarketFlowPanel({
  sharedFlows,
  savedFlows,
  onRegisterSharedFlow
}: {
  sharedFlows: SavedCustomFlow[];
  savedFlows: SavedCustomFlow[];
  onRegisterSharedFlow: (flow: SavedCustomFlow) => void;
}) {
  const sharedFlowIds = new Set(sharedFlows.map((flow) => flow.id));

  return (
    <div className="marketFlowPanel">
      <section className="marketFlowSection">
        <header>
          <strong>Shared Flows</strong>
          <span>공유하도록 등록된 Flow입니다. 캔버스로 드래그하면 그룹으로 추가됩니다.</span>
        </header>
        <div className="marketFlowList">
          {sharedFlows.length > 0 ? (
            sharedFlows.map((flow) => (
              <article
                className="marketFlowCard"
                draggable
                key={flow.id}
                onDragStart={(event) => startSavedFlowDrag(event, flow)}
              >
                <div>
                  <strong>{flow.name}</strong>
                  <span>{flow.description}</span>
                  <small>{flowCardMeta(flow)}</small>
                </div>
              </article>
            ))
          ) : (
            <p className="emptyState compactEmptyState centeredEmptyState">
              공유된 Flow가 없습니다. 아래 My Flow에서 공유할 항목을 등록하세요.
            </p>
          )}
        </div>
      </section>
      <section className="marketFlowSection">
        <header>
          <strong>My Flow</strong>
          <span>이 컴퓨터에 저장된 Flow 중 공유할 항목을 등록합니다.</span>
        </header>
        <div className="marketFlowList">
          {savedFlows.length > 0 ? (
            savedFlows.map((flow) => {
              const registered = sharedFlowIds.has(flow.id);
              return (
                <article
                  className={registered ? "marketFlowCard registered" : "marketFlowCard"}
                  draggable
                  key={flow.id}
                  onDragStart={(event) => startSavedFlowDrag(event, flow)}
                >
                  <div>
                    <strong>{flow.name}</strong>
                    <span>{flow.description}</span>
                    <small>{flowCardMeta(flow)}</small>
                  </div>
                  <button
                    className={
                      registered ? "tableActionButton" : "tableActionButton registerAction"
                    }
                    type="button"
                    disabled={registered}
                    onClick={() => onRegisterSharedFlow(flow)}
                  >
                    {registered ? "등록됨" : "등록"}
                  </button>
                </article>
              );
            })
          ) : (
            <p className="emptyState compactEmptyState centeredEmptyState">
              저장된 My Flow가 없습니다. Custom Flow에서 먼저 저장하세요.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function WorkflowHomeView({
  savedFlows,
  sharedFlows,
  onCreateNew,
  onOpenFlowMarket,
  onOpenShared,
  onOpenSaved,
  onUpdateSavedDetails,
  onDuplicateSaved,
  onDeleteSaved
}: {
  savedFlows: SavedCustomFlow[];
  sharedFlows: SavedCustomFlow[];
  onCreateNew: () => void;
  onOpenFlowMarket: () => void;
  onOpenShared: (flow: SavedCustomFlow) => void;
  onOpenSaved: (flow: SavedCustomFlow) => void;
  onUpdateSavedDetails: (
    flowId: string,
    patch: { name?: string; description?: string }
  ) => void;
  onDuplicateSaved: (flowId: string) => void;
  onDeleteSaved: (flowId: string) => void;
}) {
  const [flowCardMenu, setFlowCardMenu] = useState<{
    flowId: string;
    x: number;
    y: number;
  } | null>(null);
  const [editingFlowId, setEditingFlowId] = useState("");

  return (
    <section className="sectionView customFlowHomeView" onClick={() => setFlowCardMenu(null)}>
      <div className="customFlowHomeGrid">
        <section className="customFlowLibraryPanel">
          <header>
            <div>
              <strong>Share Flow</strong>
              <span>공유 등록된 Flow를 선택하거나 캔버스에 드래그해 사용합니다.</span>
            </div>
            <button
              className="secondaryAction squareAction"
              type="button"
              onClick={onOpenFlowMarket}
              aria-label="Market에서 공유 Flow 보기"
              title="Market에서 공유 Flow 보기"
            >
              +
            </button>
          </header>
          <div className="customFlowCardList">
            {sharedFlows.map((flow) => (
              <article
                className="customFlowCard clickableFlowCard"
                draggable
                key={flow.id}
                onDragStart={(event) => startSavedFlowDrag(event, flow)}
                onClick={() => onOpenShared(flow)}
              >
                <div>
                  <strong>{flow.name}</strong>
                  <span>{flow.description}</span>
                  <small>{flowCardMeta(flow)} · 필요 MCP CAD/Revit/Excel</small>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="customFlowLibraryPanel">
          <header>
            <div>
              <strong>My Flow</strong>
              <span>이 컴퓨터에 저장된 Custom Flow입니다.</span>
            </div>
            <button
              className="secondaryAction squareAction"
              type="button"
              onClick={onCreateNew}
              aria-label="새 Custom Flow 만들기"
              title="새 Custom Flow 만들기"
            >
              +
            </button>
          </header>
          <div className="customFlowCardList">
            {savedFlows.length > 0 ? (
              savedFlows.map((flow) => (
                <article
                  className="customFlowCard clickableFlowCard"
                  draggable
                  key={flow.id}
                  onDragStart={(event) => startSavedFlowDrag(event, flow)}
                  onClick={() => onOpenSaved(flow)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setFlowCardMenu({ flowId: flow.id, x: event.clientX, y: event.clientY });
                  }}
                >
                  {editingFlowId === flow.id ? (
                    <div className="customFlowEditableMeta">
                      <input
                        value={flow.name}
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          onUpdateSavedDetails(flow.id, { name: event.target.value })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Escape" || event.key === "Enter") {
                            setEditingFlowId("");
                          }
                        }}
                        aria-label="플로우 이름"
                      />
                      <textarea
                        value={flow.description}
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          onUpdateSavedDetails(flow.id, { description: event.target.value })
                        }
                        aria-label="플로우 설명"
                      />
                      <div className="customFlowEditableActions">
                        <small>
                          {flowCardMeta(flow)} · {new Date(flow.updatedAt).toLocaleString()}
                        </small>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingFlowId("");
                          }}
                        >
                          완료
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="customFlowDisplayMeta">
                      <div>
                        <strong>{flow.name}</strong>
                        <span>{flow.description}</span>
                        <small>
                          {flowCardMeta(flow)} · {new Date(flow.updatedAt).toLocaleString()}
                        </small>
                      </div>
                      <button
                        className="customFlowCardEditButton"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingFlowId(flow.id);
                        }}
                        aria-label={`${flow.name} 이름과 설명 수정`}
                        title="이름과 설명 수정"
                      >
                        <AppIcon name="edit" />
                      </button>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <p className="emptyState compactEmptyState centeredEmptyState">
                저장한 플로우가 없습니다. 새 Custom Flow를 만들고 편집 화면에서 저장하세요.
              </p>
            )}
          </div>
        </section>
      </div>
      {flowCardMenu ? (
        <div
          className="contextMenu flowCardContextMenu"
          style={{ left: flowCardMenu.x, top: flowCardMenu.y } as CSSProperties}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onDuplicateSaved(flowCardMenu.flowId);
              setFlowCardMenu(null);
            }}
          >
            복제
          </button>
          <button
            className="danger"
            type="button"
            onClick={() => {
              onDeleteSaved(flowCardMenu.flowId);
              setFlowCardMenu(null);
            }}
          >
            삭제
          </button>
        </div>
      ) : null}
    </section>
  );
}

function WorkflowView({
  createRequest,
  homeRequestId,
  openRequest,
  detailsUpdateRequest,
  sharedFlows,
  onCreateRequestConsumed,
  onOpenFlowMarket,
  onNotify,
  onSavedFlowsChange,
  onSavedFlowOpened,
  onSaveSubflowTool
}: {
  createRequest?: WorkflowCreateRequest | null;
  homeRequestId?: number;
  openRequest?: WorkflowOpenRequest | null;
  detailsUpdateRequest?: WorkflowDetailsUpdateRequest | null;
  sharedFlows: SavedCustomFlow[];
  onCreateRequestConsumed?: () => void;
  onOpenFlowMarket: () => void;
  onNotify?: (notification: AppNotificationInput) => void;
  onSavedFlowsChange?: (flows: SavedCustomFlow[]) => void;
  onSavedFlowOpened?: (flow: SavedCustomFlow, source: "menu" | "favorite" | "recent") => void;
  onSaveSubflowTool?: (tool: CustomToolItem) => void;
}) {
  const flowCanvasRef = useRef<HTMLDivElement | null>(null);
  const lastMiddleClickAtRef = useRef(0);
  const lastCanvasPanStartAtRef = useRef(0);
  const suppressNextInputClickRef = useRef(false);
  const initialFlowGraphRef = useRef<StoredFlowGraph | null | undefined>(undefined);
  if (initialFlowGraphRef.current === undefined) {
    initialFlowGraphRef.current = loadStoredFlowGraph();
  }
  const initialFlowGraph = initialFlowGraphRef.current;
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>(() =>
    initialFlowGraph
      ? initialFlowGraph.nodes.map(normalizeStoredBasicFlowNode)
      : defaultFlowNodes()
  );
  const [flowConnections, setFlowConnections] = useState<FlowConnection[]>(() =>
    initialFlowGraph ? initialFlowGraph.connections : defaultFlowConnections()
  );
  const [flowGroups, setFlowGroups] = useState<FlowGroup[]>(() => initialFlowGraph?.groups ?? []);
  const [flowNotes, setFlowNotes] = useState<FlowNote[]>(() => initialFlowGraph?.notes ?? []);
  const [flowHistory, setFlowHistory] = useState<FlowSnapshot[]>([]);
  const [flowFuture, setFlowFuture] = useState<FlowSnapshot[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState(flowNodes[0]?.nodeId ?? "");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(() =>
    flowNodes[0]?.nodeId ? [flowNodes[0].nodeId] : []
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [copiedNode, setCopiedNode] = useState<FlowNode | null>(null);
  const [flowNodeMenu, setFlowNodeMenu] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);
  const [flowCanvasMenu, setFlowCanvasMenu] = useState<{
    x: number;
    y: number;
    worldX: number;
    worldY: number;
  } | null>(null);
  const [flowNoteMenu, setFlowNoteMenu] = useState<{
    noteId: string;
    x: number;
    y: number;
  } | null>(null);
  const [isFlowValidationPinned, setIsFlowValidationPinned] = useState(false);
  const [flowScale, setFlowScale] = useState(initialFlowGraph?.scale ?? 1);
  const [flowPan, setFlowPan] = useState(initialFlowGraph?.pan ?? { x: 0, y: 0 });
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>(() =>
    flowNodes[0]?.nodeId ? [flowNodes[0].nodeId] : []
  );
  const [flowNodeDetailTabs, setFlowNodeDetailTabs] = useState<Record<string, FlowNodeDetailTab>>({});
  const [pendingConnection, setPendingConnection] = useState<{
    nodeId: string;
    portId: string;
  } | null>(null);
  const [connectionDrag, setConnectionDrag] = useState<{
    fromNodeId: string;
    fromPortId: string;
    x: number;
    y: number;
  } | null>(null);
  const [flowPortCenters, setFlowPortCenters] = useState<Record<string, { x: number; y: number }>>({});
  const [smartGuides, setSmartGuides] = useState<SmartGuideLine[]>([]);
  const [activeGroupDropId, setActiveGroupDropId] = useState("");
  const activeGroupDropIdRef = useRef("");
  const [expandedGroupColorId, setExpandedGroupColorId] = useState("");
  const [flowRunMode, setFlowRunMode] = useState<"batch" | "step">("batch");
  const [flowRunScope, setFlowRunScope] = useState<FlowRunScope>("all");
  const [flowRunRecords, setFlowRunRecords] = useState<FlowRunRecord[]>([]);
  const [isFlowRunMenuOpen, setIsFlowRunMenuOpen] = useState(false);
  const [isBasicToolsOpen, setIsBasicToolsOpen] = useState(false);
  const [isFlowSearchOpen, setIsFlowSearchOpen] = useState(false);
  const [flowSearchQuery, setFlowSearchQuery] = useState("");
  const [basicToolsTab, setBasicToolsTab] = useState<"tools" | "ports">("tools");
  const [basicPortFilter, setBasicPortFilter] = useState<FlowBasicPortFilter>("all");
  const [isBasicPortFilterOpen, setIsBasicPortFilterOpen] = useState(false);
  const [activeFileOptions, setActiveFileOptions] =
    useState<FlowActiveFileSelection[]>(detectedActiveFileOptions);
  const [isRefreshingActiveFiles, setIsRefreshingActiveFiles] = useState(false);
  const [activeFileRefreshMessage, setActiveFileRefreshMessage] = useState("");
  const [settingPresets, setSettingPresets] = useState<SettingPreset[]>(() =>
    loadSettingPresets()
  );
  const [savedFlows, setSavedFlows] = useState<SavedCustomFlow[]>(() => loadSavedFlows());
  const [workflowMode, setWorkflowMode] = useState<"home" | "editor">("home");
  const [editingSavedFlowId, setEditingSavedFlowId] = useState("");
  const [editingSavedFlowBaseline, setEditingSavedFlowBaseline] = useState<StoredFlowGraph | null>(null);
  const [deleteFlowRequest, setDeleteFlowRequest] = useState<SavedCustomFlow | null>(null);
  const [isLeaveFlowConfirmOpen, setIsLeaveFlowConfirmOpen] = useState(false);
  const [pendingFlowSettingChange, setPendingFlowSettingChange] = useState<{
    nodeId: string;
    field: ToolSettingField;
    value: ToolSettingValue;
  } | null>(null);
  const [isHistoryMenuOpen, setIsHistoryMenuOpen] = useState(false);
  const [runningNodeIds, setRunningNodeIds] = useState<string[]>([]);
  const runTimersRef = useRef<number[]>([]);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [highlightedConnectionIds, setHighlightedConnectionIds] = useState<string[]>([]);
  const [flowRunIssues, setFlowRunIssues] = useState<FlowValidationIssue[]>([]);
  const [expandedNoteColorId, setExpandedNoteColorId] = useState("");
  const [draggingBasicPortTool, setDraggingBasicPortTool] = useState<FlowBasicPortTool | null>(null);
  const [activePortDropTarget, setActivePortDropTarget] = useState<{
    nodeId: string;
    direction: "input" | "output";
  } | null>(null);
  const [activePromptAttachTargetId, setActivePromptAttachTargetId] = useState("");
  const activePromptAttachTargetIdRef = useRef("");
  const [draggingNote, setDraggingNote] = useState<{
    noteId: string;
    startWorldX: number;
    startWorldY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [draggingNode, setDraggingNode] = useState<{
    nodeId: string;
    nodeIds: string[];
    startWorldX: number;
    startWorldY: number;
    origins: { nodeId: string; x: number; y: number }[];
  } | null>(null);
  const [draggingGroup, setDraggingGroup] = useState<{
    groupId: string;
    nodeIds: string[];
    startWorldX: number;
    startWorldY: number;
    origins: { nodeId: string; x: number; y: number }[];
  } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [panningCanvas, setPanningCanvas] = useState<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const updateActiveGroupDropId = (groupId: string) => {
    activeGroupDropIdRef.current = groupId;
    setActiveGroupDropId((current) => (current === groupId ? current : groupId));
  };

  const updateActivePromptAttachTargetId = (nodeId: string) => {
    activePromptAttachTargetIdRef.current = nodeId;
    setActivePromptAttachTargetId((current) => (current === nodeId ? current : nodeId));
  };

  const cloneFlowSnapshot = (snapshot: FlowSnapshot): FlowSnapshot => ({
    nodes: snapshot.nodes.map((node) => ({
      ...node,
      inputs: node.inputs.map((port) => ({ ...port })),
      outputs: node.outputs.map((port) => ({ ...port }))
    })),
    connections: snapshot.connections.map((connection) => ({ ...connection })),
    groups: snapshot.groups.map((group) => ({
      ...group,
      nodeIds: [...group.nodeIds]
    })),
    notes: snapshot.notes.map((note) => ({ ...note }))
  });

  const currentFlowSnapshot = (): FlowSnapshot =>
    cloneFlowSnapshot({
      nodes: flowNodes,
      connections: flowConnections,
      groups: flowGroups,
      notes: flowNotes
    });

  const applyFlowSnapshot = (snapshot: FlowSnapshot) => {
    const next = cloneFlowSnapshot(snapshot);
    setFlowNodes(next.nodes);
    setFlowConnections(next.connections);
    setFlowGroups(next.groups);
    setFlowNotes(next.notes);
    setSelectedNodeId(next.nodes[0]?.nodeId ?? "");
    setSelectedNodeIds(next.nodes[0]?.nodeId ? [next.nodes[0].nodeId] : []);
    setSelectedGroupIds([]);
    setSelectedNoteIds([]);
    setExpandedNodeIds((current) =>
      current.filter((nodeId) => next.nodes.some((node) => node.nodeId === nodeId))
    );
  };

  const currentStoredFlowGraph = (): StoredFlowGraph => ({
    nodes: flowNodes,
    connections: flowConnections,
    groups: flowGroups,
    notes: flowNotes,
    scale: flowScale,
    pan: flowPan
  });

  const persistCurrentFlowGraph = () => {
    window.localStorage.setItem(
      customFlowGraphStorageKey,
      JSON.stringify(currentStoredFlowGraph())
    );
  };

  const saveCurrentFlowFromShortcut = () => {
    persistCurrentFlowGraph();
    if (editingSavedFlowId) {
      const nextGraph = currentStoredFlowGraph();
      setSavedFlows((flows) => updateSavedFlowGraph(flows, editingSavedFlowId, nextGraph));
      setEditingSavedFlowBaseline(cloneStoredFlowGraph(nextGraph));
    }
    onNotify?.({
      title: "저장되었습니다",
      message: "",
      variant: "save-toast",
      autoDismissMs: 2200
    });
  };

  const loadFlowGraphIntoEditor = (graph: StoredFlowGraph) => {
    const nextNodes = graph.nodes.map(normalizeStoredBasicFlowNode);
    setFlowNodes(nextNodes);
    setFlowConnections(graph.connections);
    setFlowGroups(graph.groups ?? []);
    setFlowNotes(graph.notes ?? []);
    setFlowScale(graph.scale ?? 1);
    setFlowPan(graph.pan ?? { x: 0, y: 0 });
    setFlowRunRecords([]);
    setFlowRunIssues([]);
    setHighlightedNodeIds([]);
    setHighlightedConnectionIds([]);
    setSelectedNodeId(nextNodes[0]?.nodeId ?? "");
    setSelectedNodeIds(nextNodes[0]?.nodeId ? [nextNodes[0].nodeId] : []);
    setSelectedGroupIds([]);
    setSelectedNoteIds([]);
    setWorkflowMode("editor");
  };

  const hasUnsavedSavedFlowChanges = () =>
    Boolean(
      editingSavedFlowId &&
      isStoredFlowGraphDirty(editingSavedFlowBaseline, currentStoredFlowGraph())
    );

  const hasUnsavedNewFlowContent = () => {
    if (editingSavedFlowId) {
      return false;
    }
    if (editingSavedFlowBaseline) {
      return isStoredFlowGraphDirty(editingSavedFlowBaseline, currentStoredFlowGraph());
    }
    return (
      flowNodes.length > 0 ||
      flowConnections.length > 0 ||
      flowGroups.length > 0 ||
      flowNotes.length > 0
    );
  };

  const hasUnsavedFlowChanges = () =>
    hasUnsavedSavedFlowChanges() || hasUnsavedNewFlowContent();

  const saveEditingSavedFlow = () => {
    if (!editingSavedFlowId) {
      return;
    }
    const nextGraph = currentStoredFlowGraph();
    setSavedFlows((flows) => updateSavedFlowGraph(flows, editingSavedFlowId, nextGraph));
    setEditingSavedFlowBaseline(cloneStoredFlowGraph(nextGraph));
  };

  const leaveWorkflowEditor = () => {
    setWorkflowMode("home");
    setEditingSavedFlowId("");
    setEditingSavedFlowBaseline(null);
    setIsLeaveFlowConfirmOpen(false);
  };

  const requestWorkflowHome = () => {
    if (hasUnsavedFlowChanges()) {
      setIsLeaveFlowConfirmOpen(true);
      return;
    }
    leaveWorkflowEditor();
  };

  const createNewFlow = () => {
    const graph = {
      nodes: [],
      connections: [],
      groups: [],
      notes: [],
      scale: 1,
      pan: { x: 0, y: 0 }
    };
    loadFlowGraphIntoEditor(graph);
    setEditingSavedFlowId("");
    setEditingSavedFlowBaseline(null);
    window.localStorage.removeItem(customFlowGraphStorageKey);
  };

  useEffect(() => {
    if (!createRequest) {
      return;
    }
    createNewFlow();
    onCreateRequestConsumed?.();
  }, [createRequest?.requestId]);

  useEffect(() => {
    if (!openRequest) {
      return;
    }
    const nextGraph = cloneStoredFlowGraph(openRequest.graph);
    loadFlowGraphIntoEditor(nextGraph);
    if (openRequest.source === "saved" && openRequest.flowId) {
      setEditingSavedFlowId(openRequest.flowId);
      setEditingSavedFlowBaseline(cloneStoredFlowGraph(nextGraph));
    } else {
      setEditingSavedFlowId("");
      setEditingSavedFlowBaseline(null);
    }
  }, [openRequest?.requestId]);

  useEffect(() => {
    if (!homeRequestId) {
      return;
    }
    requestWorkflowHome();
  }, [homeRequestId]);

  useEffect(() => {
    if (!detailsUpdateRequest) {
      return;
    }
    setSavedFlows((flows) =>
      updateSavedFlowDetails(
        flows,
        detailsUpdateRequest.flowId,
        detailsUpdateRequest.patch
      )
    );
  }, [detailsUpdateRequest?.requestId]);

  const saveCurrentFlowToLibrary = () => {
    if (editingSavedFlowId) {
      saveEditingSavedFlow();
      onNotify?.({
        title: "저장되었습니다",
        message: "",
        variant: "save-toast",
        autoDismissMs: 2200
      });
      return;
    }

    const name = window.prompt("저장할 Custom Flow 이름을 입력하세요.", "새 Custom Flow");
    if (name === null) {
      return;
    }
    const flow = createSavedFlow(name, currentStoredFlowGraph());
    setSavedFlows((flows) => [flow, ...flows]);
    setEditingSavedFlowId(flow.id);
    setEditingSavedFlowBaseline(cloneStoredFlowGraph(flow.graph));
    onSavedFlowOpened?.(flow, "menu");
    onNotify?.({
      title: "저장되었습니다",
      message: "",
      variant: "save-toast",
      autoDismissMs: 2200
    });
  };

  const openSharedFlow = (flow: SavedCustomFlow) => {
    const nextGraph = cloneStoredFlowGraph(flow.graph);
    loadFlowGraphIntoEditor(nextGraph);
    setEditingSavedFlowId("");
    setEditingSavedFlowBaseline(cloneStoredFlowGraph(nextGraph));
  };

  const openSavedFlow = (flow: SavedCustomFlow) => {
    const nextGraph = cloneStoredFlowGraph(flow.graph);
    loadFlowGraphIntoEditor(nextGraph);
    setEditingSavedFlowId(flow.id);
    setEditingSavedFlowBaseline(cloneStoredFlowGraph(nextGraph));
  };

  const updateSavedFlowHomeDetails = (
    flowId: string,
    patch: { name?: string; description?: string }
  ) => {
    setSavedFlows((flows) => updateSavedFlowDetails(flows, flowId, patch));
  };

  const duplicateFlow = (flowId: string) => {
    setSavedFlows((flows) => duplicateSavedFlow(flows, flowId));
  };

  const deleteFlow = (flowId: string) => {
    const flow = savedFlows.find((item) => item.id === flowId);
    if (!flow) {
      return;
    }
    setDeleteFlowRequest(flow);
  };

  const confirmDeleteFlow = () => {
    if (!deleteFlowRequest) {
      return;
    }
    const flowId = deleteFlowRequest.id;
    setSavedFlows((flows) => removeSavedFlow(flows, flowId));
    if (editingSavedFlowId === flowId) {
      setEditingSavedFlowId("");
      setEditingSavedFlowBaseline(null);
      setWorkflowMode("home");
    }
    setDeleteFlowRequest(null);
  };

  const rememberFlowState = () => {
    setFlowFuture([]);
    setFlowHistory((items) => [
      ...items.slice(-29),
      currentFlowSnapshot()
    ]);
  };

  const restorePreviousFlowState = () => {
    setFlowHistory((items) => {
      const previous = items.at(-1);
      if (!previous) {
        return items;
      }

      setFlowFuture((future) => [currentFlowSnapshot(), ...future].slice(0, 30));
      applyFlowSnapshot(previous);
      return items.slice(0, -1);
    });
  };

  const restoreNextFlowState = () => {
    setFlowFuture((items) => {
      const next = items[0];
      if (!next) {
        return items;
      }

      setFlowHistory((history) => [...history.slice(-29), currentFlowSnapshot()]);
      applyFlowSnapshot(next);
      return items.slice(1);
    });
  };

  const restoreHistoryAt = (index: number) => {
    const target = flowHistory[index];
    if (!target) {
      return;
    }

    setFlowFuture([
      currentFlowSnapshot(),
      ...flowHistory.slice(index + 1).reverse().map(cloneFlowSnapshot),
      ...flowFuture
    ].slice(0, 30));
    setFlowHistory(flowHistory.slice(0, index));
    applyFlowSnapshot(target);
    setIsHistoryMenuOpen(false);
  };
  const canvasPointFromPointer = (clientX: number, clientY: number) => {
    if (!flowCanvasRef.current) {
      return { x: 0, y: 0 };
    }

    const rect = flowCanvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - flowPan.x) / flowScale,
      y: (clientY - rect.top - flowPan.y) / flowScale
    };
  };

  const flowPortCenterKey = (
    nodeId: string,
    direction: "input" | "output",
    portId: string
  ) => `${nodeId}:${direction}:${portId}`;

  const isNodePositionChanging = (nodeId: string) =>
    Boolean(
      draggingNode?.nodeIds.includes(nodeId) ||
      draggingGroup?.nodeIds.includes(nodeId)
    );

  const getFlowPortCenter = (
    node: FlowNode,
    direction: "input" | "output",
    portId: string
  ) => {
    if (isNodePositionChanging(node.nodeId)) {
      return flowConnectionEndpoint(node, direction, portId);
    }

    return (
      flowPortCenters[flowPortCenterKey(node.nodeId, direction, portId)] ??
      flowConnectionEndpoint(node, direction, portId)
    );
  };

  useLayoutEffect(() => {
    if (!flowCanvasRef.current) {
      return;
    }
    if (draggingNode || draggingGroup) {
      return;
    }

    const canvasRect = flowCanvasRef.current.getBoundingClientRect();
    const nextCenters: Record<string, { x: number; y: number }> = {};
    const connectorElements = flowCanvasRef.current.querySelectorAll<HTMLElement>(
      "[data-flow-port-center]"
    );

    connectorElements.forEach((element) => {
      const key = element.dataset.flowPortCenter;
      if (!key) {
        return;
      }

      const rect = element.getBoundingClientRect();
      nextCenters[key] = {
        x: (rect.left + rect.width / 2 - canvasRect.left - flowPan.x) / flowScale,
        y: (rect.top + rect.height / 2 - canvasRect.top - flowPan.y) / flowScale
      };
    });

    setFlowPortCenters((current) => {
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(nextCenters);
      if (
        currentKeys.length === nextKeys.length &&
        nextKeys.every(
          (key) =>
            current[key] &&
            Math.abs(current[key].x - nextCenters[key].x) < 0.01 &&
            Math.abs(current[key].y - nextCenters[key].y) < 0.01
        )
      ) {
        return current;
      }

      return nextCenters;
    });
  }, [draggingGroup, draggingNode, expandedNodeIds, flowNodes, flowPan.x, flowPan.y, flowScale]);

  const estimateFlowNodeHeight = (node: FlowNode) => {
    const portRows = Math.max(1, node.inputs.length, node.outputs.length);
    const portHeight = node.inputs.length > 0 || node.outputs.length > 0 ? portRows * 36 : 0;
    const detailsHeight = expandedNodeIds.includes(node.nodeId) ? 104 : 0;
    return 102 + portHeight + detailsHeight;
  };

  const flowNodeBounds = (node: FlowNode) => ({
    id: node.nodeId,
    left: node.x,
    top: node.y,
    right: node.x + flowNodeWidth,
    bottom: node.y + estimateFlowNodeHeight(node)
  });

  const flowNoteBounds = (note: FlowNote) => ({
    id: note.id,
    left: note.x,
    top: note.y,
    right: note.x + (note.width ?? 220),
    bottom: note.y + (note.height ?? 140)
  });

  const boundsFromRects = (rects: SmartGuideRect[]): SmartGuideRect | null => {
    if (rects.length === 0) {
      return null;
    }

    return {
      id: "selection",
      left: Math.min(...rects.map((bound) => bound.left)),
      top: Math.min(...rects.map((bound) => bound.top)),
      right: Math.max(...rects.map((bound) => bound.right)),
      bottom: Math.max(...rects.map((bound) => bound.bottom))
    };
  };

  const normalizeRect = (rect: {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  }) => ({
    left: Math.min(rect.startX, rect.currentX),
    top: Math.min(rect.startY, rect.currentY),
    right: Math.max(rect.startX, rect.currentX),
    bottom: Math.max(rect.startY, rect.currentY)
  });

  const rectsIntersect = (
    first: { left: number; top: number; right: number; bottom: number },
    second: { left: number; top: number; right: number; bottom: number }
  ) =>
    first.left <= second.right &&
    first.right >= second.left &&
    first.top <= second.bottom &&
    first.bottom >= second.top;

  const groupBounds = (nodeIds: string[]) => {
    const nodes = flowNodes.filter((node) => nodeIds.includes(node.nodeId));
    if (nodes.length === 0) {
      return null;
    }

    const bounds = nodes.map(flowNodeBounds);
    return {
      left: Math.min(...bounds.map((bound) => bound.left)) - 24,
      top: Math.min(...bounds.map((bound) => bound.top)) - 38,
      right: Math.max(...bounds.map((bound) => bound.right)) + 24,
      bottom: Math.max(...bounds.map((bound) => bound.bottom)) + 24
    };
  };

  function createFlowGroup(nodeIds = selectedNodeIds) {
    const validNodeIds = Array.from(
      new Set(nodeIds.filter((id) => flowNodes.some((node) => node.nodeId === id)))
    );
    if (validNodeIds.length === 0) {
      return;
    }

    rememberFlowState();
    setFlowGroups((groups) => [
      ...groups,
      {
        id: `group-${Date.now()}`,
        name: `Group ${groups.length + 1}`,
        color: flowGroupColorOptions[0],
        nodeIds: validNodeIds
      }
    ]);
  }

  function saveFlowGroupAsCustomTool(groupId: string) {
    const group = flowGroups.find((item) => item.id === groupId);
    if (!group || group.nodeIds.length === 0 || !onSaveSubflowTool) {
      return;
    }

    const toolSchema = buildFlowGroupToolSchema(group, flowNodes, flowConnections);
    const groupNodes = flowNodes.filter((node) => group.nodeIds.includes(node.nodeId));
    const createdAt = Date.now();
    const riskWarnings =
      toolSchema.risk === "safe" || toolSchema.risk === "read"
        ? []
        : [`${toolRiskLabels[toolSchema.risk]} 작업이 포함되어 있습니다.`];
    const tool: CustomToolItem = {
      id: `custom-flow-${group.id}`,
      sectionId: "workflow",
      name: group.name || "Custom Flow 툴",
      description: `${groupNodes.length}개 노드를 묶은 Custom Flow 서브플로우입니다.`,
      version: "1.0.0",
      author: "Custom Flow",
      usageCount: 0,
      pinned: false,
      registered: true,
      approvalStatus: "approved",
      isToolLike: true,
      riskWarnings,
      toolSchema,
      sourcePath: `custom-flow://${group.id}`,
      installedPath: `custom-flow://${group.id}`,
      versions: [
        {
          id: `custom-flow-${group.id}-${createdAt}`,
          version: "1.0.0",
          author: "Custom Flow",
          description: `${groupNodes.length}개 노드를 묶은 Custom Flow 서브플로우입니다.`,
          sourcePath: `custom-flow://${group.id}`,
          installedPath: `custom-flow://${group.id}`,
          isToolLike: true,
          riskWarnings,
          toolSchema
        }
      ]
    };

    onSaveSubflowTool(tool);
  }

  function removeFlowNodesFromGroups(nodeIds: string[]) {
    const validNodeIds = nodeIds.filter((id) =>
      flowGroups.some((group) => group.nodeIds.includes(id))
    );
    if (validNodeIds.length === 0) {
      return;
    }

    rememberFlowState();
    const removeSet = new Set(validNodeIds);
    const nodeMoveTargets = new Map<string, { x: number; y: number }>();
    flowGroups.forEach((group) => {
      const removedIds = group.nodeIds.filter((nodeId) => removeSet.has(nodeId));
      if (removedIds.length === 0) {
        return;
      }
      const bounds = groupBounds(group.nodeIds);
      if (!bounds) {
        return;
      }
      removedIds.forEach((nodeId, index) => {
        nodeMoveTargets.set(nodeId, {
          x: bounds.right + 34,
          y: bounds.top + 24 + index * 42
        });
      });
    });
    setFlowGroups((groups) => removeNodeIdsFromFlowGroups(groups, validNodeIds));
    setFlowNodes((nodes) =>
      nodes.map((node) => {
        const target = nodeMoveTargets.get(node.nodeId);
        return target ? { ...node, ...target } : node;
      })
    );
    setFlowNodeMenu(null);
  }

  function deleteSelectedFlowItems() {
    const ids = selectedNodeIds.filter((id) => flowNodes.some((node) => node.nodeId === id));
    const groupIds = selectedGroupIds.filter((id) => flowGroups.some((group) => group.id === id));
    const noteIds = selectedNoteIds.filter((id) => flowNotes.some((note) => note.id === id));
    if (ids.length === 0 && groupIds.length === 0 && noteIds.length === 0) {
      return;
    }

    rememberFlowState();
    const idSet = new Set(ids);
    const groupIdSet = new Set(groupIds);
    const noteIdSet = new Set(noteIds);
    setFlowNodes((items) =>
      items
        .filter((node) => !idSet.has(node.nodeId))
        .map((node) =>
          node.attachedToNodeId && idSet.has(node.attachedToNodeId)
            ? { ...node, attachedToNodeId: undefined }
            : node
        )
    );
    setFlowConnections((connections) =>
      connections.filter(
        (connection) => !idSet.has(connection.fromNodeId) && !idSet.has(connection.toNodeId)
      )
    );
    setFlowGroups((groups) =>
      groups
        .filter((group) => !groupIdSet.has(group.id))
        .map((group) => ({
          ...group,
          nodeIds: group.nodeIds.filter((nodeId) => !idSet.has(nodeId))
        }))
        .filter((group) => group.nodeIds.length > 0)
    );
    setFlowNotes((notes) => notes.filter((note) => !noteIdSet.has(note.id)));
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedGroupIds([]);
    setSelectedNoteIds([]);
    setExpandedNodeIds((current) => current.filter((nodeId) => !idSet.has(nodeId)));
    setFlowNodeMenu(null);
  }

  function fitFlowToNodes() {
    if (!flowCanvasRef.current || flowNodes.length === 0) {
      return;
    }

    const rect = flowCanvasRef.current.getBoundingClientRect();
    const bounds = flowNodes.map(flowNodeBounds);
    const left = Math.min(...bounds.map((bound) => bound.left));
    const top = Math.min(...bounds.map((bound) => bound.top));
    const right = Math.max(...bounds.map((bound) => bound.right));
    const bottom = Math.max(...bounds.map((bound) => bound.bottom));
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const padding = 76;
    const nextScale = Math.min(
      1.25,
      Math.max(
        0.42,
        Math.min((rect.width - padding * 2) / width, (rect.height - padding * 2) / height)
      )
    );

    setFlowScale(Number(nextScale.toFixed(2)));
    setFlowPan({
      x: rect.width / 2 - (left + width / 2) * nextScale,
      y: rect.height / 2 - (top + height / 2) * nextScale
    });
  }

  const connectFlowPorts = (
    fromNodeId: string,
    fromPortId: string,
    toNodeId: string,
    toPortId: string
  ) => {
    if (fromNodeId === toNodeId) {
      return;
    }

    rememberFlowState();
    setFlowConnections((connections) => {
      const exists = connections.some(
        (connection) =>
          connection.fromNodeId === fromNodeId &&
          connection.fromPortId === fromPortId &&
          connection.toNodeId === toNodeId &&
          connection.toPortId === toPortId
      );

      return exists
        ? connections.filter(
            (connection) =>
              !(
                connection.fromNodeId === fromNodeId &&
                connection.fromPortId === fromPortId &&
                connection.toNodeId === toNodeId &&
                connection.toPortId === toPortId
              )
          )
        : [
            ...connections,
            {
              id: `conn-${fromNodeId}-${fromPortId}-${toNodeId}-${toPortId}-${Date.now()}`,
              fromNodeId,
              fromPortId,
              toNodeId,
              toPortId
            }
          ];
    });
    setPendingConnection(null);
  };

  const cancelFlowInteraction = () => {
    setPendingConnection(null);
    setConnectionDrag(null);
    setFlowNodeMenu(null);
    setFlowCanvasMenu(null);
    setFlowNoteMenu(null);
    setIsFlowRunMenuOpen(false);
    setIsBasicToolsOpen(false);
    setIsFlowSearchOpen(false);
    setIsHistoryMenuOpen(false);
    setIsFlowValidationPinned(false);
    setExpandedGroupColorId("");
    setExpandedNoteColorId("");
    setSelectionBox(null);
    setDraggingNode(null);
    setDraggingGroup(null);
    setDraggingNote(null);
    setDraggingBasicPortTool(null);
    setActivePortDropTarget(null);
    updateActiveGroupDropId("");
    updateActivePromptAttachTargetId("");
    setPanningCanvas(null);
    setSmartGuides([]);
    setHighlightedNodeIds([]);
    setHighlightedConnectionIds([]);
    setFlowRunIssues((current) => (current.length > 0 ? [] : current));
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedGroupIds([]);
    setSelectedNoteIds([]);
  };

  const createFlowNote = (position: { x: number; y: number }) => {
    rememberFlowState();
    const noteId = `note-${Date.now()}`;
    setFlowNotes((notes) => [
      ...notes,
      {
        id: noteId,
        title: "메모",
        text: "메모",
        x: position.x,
        y: position.y,
        width: 220,
        height: 140,
        color: flowNoteColorOptions[0]
      }
    ]);
    setFlowCanvasMenu(null);
  };

  const startFlowNoteDrag = (event: PointerEvent<HTMLElement>, note: FlowNote) => {
    if (event.button !== 0 || !flowCanvasRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    rememberFlowState();
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedGroupIds([]);
    setSelectedNoteIds([note.id]);
    const rect = flowCanvasRef.current.getBoundingClientRect();
    setDraggingNote({
      noteId: note.id,
      startWorldX: (event.clientX - rect.left - flowPan.x) / flowScale,
      startWorldY: (event.clientY - rect.top - flowPan.y) / flowScale,
      originX: note.x,
      originY: note.y
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateFlowNoteText = (noteId: string, text: string) => {
    setFlowNotes((notes) =>
      notes.map((note) => (note.id === noteId ? { ...note, text } : note))
    );
  };

  const updateFlowNoteTitle = (noteId: string, title: string) => {
    setFlowNotes((notes) =>
      notes.map((note) => (note.id === noteId ? { ...note, title } : note))
    );
  };

  const contextMenuPosition = (
    event: MouseEvent<HTMLElement>,
    size: { width: number; height: number }
  ) => ({
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - size.width - 8)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - size.height - 8))
  });

  const openFlowNoteMenu = (event: MouseEvent<HTMLElement>, noteId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const position = contextMenuPosition(event, { width: 184, height: 78 });
    setFlowNodeMenu(null);
    setFlowCanvasMenu(null);
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedGroupIds([]);
    setSelectedNoteIds([noteId]);
    setFlowNoteMenu({ noteId, ...position });
  };

  const deleteFlowNote = (noteId: string) => {
    if (!flowNotes.some((note) => note.id === noteId)) {
      return;
    }

    rememberFlowState();
    setFlowNotes((notes) => notes.filter((note) => note.id !== noteId));
    setSelectedNoteIds((ids) => ids.filter((id) => id !== noteId));
    setFlowNoteMenu(null);
  };

  const duplicateFlowNote = (noteId: string) => {
    const note = flowNotes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    rememberFlowState();
    const nextNote = {
      ...note,
      id: `note-${Date.now()}`,
      x: note.x + 24,
      y: note.y + 24
    };
    setFlowNotes((notes) => [...notes, nextNote]);
    setSelectedNoteIds([nextNote.id]);
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedGroupIds([]);
    setFlowNoteMenu(null);
  };

  const updateFlowNoteColor = (noteId: string, color: string) => {
    rememberFlowState();
    setFlowNotes((notes) =>
      notes.map((note) => (note.id === noteId ? { ...note, color } : note))
    );
    setExpandedNoteColorId("");
  };

  const updateFlowNoteSize = (noteId: string, width: number, height: number) => {
    setFlowNotes((notes) =>
      notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              width: Math.max(180, Math.round(width)),
              height: Math.max(120, Math.round(height))
            }
          : note
      )
    );
  };

  const updateFlowNodePromptText = (nodeId: string, promptText: string) => {
    setFlowNodes((nodes) =>
      nodes.map((node) => (node.nodeId === nodeId ? { ...node, promptText } : node))
    );
  };

  const updateFlowNodeSetting = (
    nodeId: string,
    field: "target" | "options" | "memo",
    value: string
  ) => {
    setFlowNodes((nodes) =>
      nodes.map((node) =>
        node.nodeId === nodeId
          ? {
              ...node,
              settings: {
                target: node.settings?.target ?? "",
                options: node.settings?.options ?? "",
                memo: node.settings?.memo ?? "",
                [field]: value
              }
            }
          : node
      )
    );
  };

  const commitFlowNodeSettingValue = (
    nodeId: string,
    field: ToolSettingField,
    value: ToolSettingValue
  ) => {
    rememberFlowState();
    setFlowNodes((nodes) =>
      nodes.map((node) =>
        node.nodeId === nodeId
          ? {
              ...node,
              settingsValues: {
                ...(node.settingsValues ?? {}),
                [field.id]: value
              }
            }
          : node
      )
    );
  };

  const updateFlowNodeSettingValue = (
    nodeId: string,
    field: ToolSettingField,
    value: ToolSettingValue
  ) => {
    if (field.confirmOnChange) {
      setPendingFlowSettingChange({ nodeId, field, value });
      return;
    }

    commitFlowNodeSettingValue(nodeId, field, value);
  };

  const updateFlowNodeRuntimeSettingValue = (
    nodeId: string,
    key: string,
    value: ToolSettingValue
  ) => {
    rememberFlowState();
    setFlowNodes((nodes) =>
      nodes.map((node) =>
        node.nodeId === nodeId
          ? {
              ...node,
              settingsValues: {
                ...(node.settingsValues ?? {}),
                [key]: value
              }
            }
          : node
      )
    );
  };

  const saveFlowNodePreset = (
    node: FlowNode,
    options?: { presetId?: string; name?: string }
  ) => {
    const toolId = primaryPresetToolIdForFlowNode(node);
    setSettingPresets((presets) => {
      const existing = options?.presetId
        ? presets.find((preset) => preset.id === options.presetId)
        : undefined;
      const presetName =
        options?.name ??
        existing?.name ??
        `${node.name} 설정 ${new Date().toLocaleString("ko-KR")}`;
      const preset = existing
        ? {
            ...existing,
            toolId,
            name: presetName,
            values: cloneSettingValues(node.settingsValues ?? {})
          }
        : createSettingPreset(toolId, presetName, node.settingsValues ?? {});

      return upsertSettingPreset(presets, preset);
    });
  };

  const loadFlowNodePreset = (nodeId: string, preset: SettingPreset) => {
    rememberFlowState();
    setFlowNodes((nodes) =>
      nodes.map((node) =>
        node.nodeId === nodeId
          ? {
              ...node,
              settingsValues: cloneSettingValues(preset.values)
            }
          : node
      )
    );
  };

  const deleteFlowNodePreset = (presetId: string) => {
    setSettingPresets((presets) => removeSettingPreset(presets, presetId));
  };

  const renameFlowNodePreset = (presetId: string, name: string) => {
    setSettingPresets((presets) => renameSettingPreset(presets, presetId, name));
  };

  const toggleFlowNodeActiveFile = (
    nodeId: string,
    option: (typeof detectedActiveFileOptions)[number]
  ) => {
    rememberFlowState();
    setFlowNodes((nodes) =>
      nodes.map((node) => {
        if (node.nodeId !== nodeId) {
          return node;
        }

        const current = node.activeFileSelections ?? [];
        const isSelected = current.some((selection) => selection.id === option.id);
        return withActiveFileOutputPort({
          ...node,
          activeFileSelections: isSelected
            ? current.filter((selection) => selection.id !== option.id)
            : [...current, option]
        });
      })
    );
  };

  const refreshDetectedActiveFiles = async () => {
    if (!window.activeFiles?.detect) {
      setActiveFileRefreshMessage("현재 실행 환경에서는 활성 파일 새로고침을 사용할 수 없습니다.");
      return;
    }

    setIsRefreshingActiveFiles(true);
    setActiveFileRefreshMessage("현재 열린 파일을 확인하는 중입니다.");
    try {
      const detectedFiles = await window.activeFiles.detect();
      if (detectedFiles.length === 0) {
        setActiveFileRefreshMessage(
          "CAD/Revit MCP 서버에서 현재 파일명을 받지 못했습니다. MCP 서버가 실행 중인지 확인하세요."
        );
        return;
      }

      const nextOptions = mergeActiveFileOptions(detectedActiveFileOptions, detectedFiles);
      setActiveFileOptions(nextOptions);
      setFlowNodes((nodes) =>
        nodes.map((node) =>
          node.id === "basic-active-file"
            ? withActiveFileOutputPort({
                ...node,
                activeFileSelections: syncActiveFileSelections(
                  node.activeFileSelections,
                  nextOptions
                )
              })
            : node
        )
      );
      setActiveFileRefreshMessage(`${detectedFiles.length}개 활성 파일을 갱신했습니다.`);
    } catch {
      setActiveFileRefreshMessage("활성 파일을 확인하지 못했습니다. MCP 연결 상태를 확인하세요.");
    } finally {
      setIsRefreshingActiveFiles(false);
    }
  };

  const updateFlowNodePathSelection = (nodeId: string, file: File | null) => {
    if (!file) {
      return;
    }

    rememberFlowState();
    const fileWithPath = file as File & { path?: string };
    setFlowNodes((nodes) =>
      nodes.map((node) =>
        node.nodeId === nodeId
          ? {
              ...node,
              pathSelection: {
                name: file.name,
                path: fileWithPath.path || file.name
              }
            }
          : node
      )
    );
  };

  const isPromptFlowNode = (node: FlowNode) => node.id === "basic-custom-prompt";

  const canDropBasicPortTool = (
    tool: FlowBasicPortTool,
    direction: "input" | "output"
  ) => tool.direction === "both" || tool.direction === direction;

  const flowPortToolScopeLabel = (direction: FlowBasicPortDirection) => {
    if (direction === "both") {
      return "공용";
    }
    return direction === "input" ? "Input" : "Output";
  };

  const flowPortToolScopeClass = (direction: FlowBasicPortDirection) => {
    if (direction === "both") {
      return "both";
    }
    return direction;
  };

  const addCustomFlowPort = (
    nodeId: string,
    direction: "input" | "output",
    label: string,
    type: FlowPortType
  ) => {
    rememberFlowState();
    const port: FlowPort = {
      id: `custom-${direction}-${Date.now()}`,
      label,
      type,
      iconName: flowPortIconName(type),
      custom: true
    };
    setFlowNodes((nodes) =>
      nodes.map((node) =>
        node.nodeId === nodeId
          ? {
              ...node,
              [direction === "input" ? "inputs" : "outputs"]: [
                ...(direction === "input" ? node.inputs : node.outputs),
                port
              ]
            }
          : node
      )
    );
    setExpandedNodeIds((ids) => (ids.includes(nodeId) ? ids : [...ids, nodeId]));
  };

  const removeCustomFlowPort = (
    nodeId: string,
    direction: "input" | "output",
    portId: string
  ) => {
    rememberFlowState();
    setFlowNodes((nodes) =>
      nodes.map((node) =>
        node.nodeId === nodeId
          ? {
              ...node,
              [direction === "input" ? "inputs" : "outputs"]:
                direction === "input"
                  ? node.inputs.filter((port) => port.id !== portId || !port.custom)
                  : node.outputs.filter((port) => port.id !== portId || !port.custom)
            }
          : node
      )
    );
    setFlowConnections((connections) =>
      connections.filter((connection) =>
        direction === "input"
          ? !(connection.toNodeId === nodeId && connection.toPortId === portId)
          : !(connection.fromNodeId === nodeId && connection.fromPortId === portId)
      )
    );
  };

  const handleBasicToolDragStart = (event: DragEvent<HTMLElement>, tool: FlowTool) => {
    event.dataTransfer.setData("application/x-flow-tool-data", JSON.stringify(tool));
    event.dataTransfer.effectAllowed = "copy";
  };

  const handleBasicPortToolDragStart = (
    event: DragEvent<HTMLElement>,
    tool: FlowBasicPortTool
  ) => {
    setDraggingBasicPortTool(tool);
    event.dataTransfer.setData("application/x-flow-port-tool", JSON.stringify(tool));
    event.dataTransfer.effectAllowed = "copy";
  };

  const handleCustomPortDragStart = (
    event: DragEvent<HTMLElement>,
    nodeId: string,
    direction: "input" | "output",
    portId: string
  ) => {
    event.dataTransfer.setData(
      "application/x-flow-remove-port",
      JSON.stringify({ nodeId, direction, portId })
    );
    event.dataTransfer.effectAllowed = "move";
  };

  useEffect(() => {
    const closeFlowNodeMenu = (event: globalThis.PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(".flowCanvasToolbar") ||
        target?.closest(".flowValidationPanel") ||
        target?.closest(".flowNodeContextMenu") ||
        target?.closest(".flowNoteContextMenu") ||
        target?.closest(".flowGroupColorMenu") ||
        target?.closest(".flowNoteColorMenu")
      ) {
        return;
      }

      setFlowNodeMenu(null);
      setFlowCanvasMenu(null);
      setFlowNoteMenu(null);
      setIsFlowRunMenuOpen(false);
      setIsBasicToolsOpen(false);
      setIsHistoryMenuOpen(false);
      setIsFlowValidationPinned(false);
      setExpandedGroupColorId("");
      setExpandedNoteColorId("");
    };
    window.addEventListener("pointerdown", closeFlowNodeMenu);
    return () => window.removeEventListener("pointerdown", closeFlowNodeMenu);
  }, []);

  useEffect(() => {
    if (!canAutoPersistCustomFlowGraph(workflowMode) || !editingSavedFlowId) {
      return undefined;
    }

    const saveTimerId = window.setTimeout(() => {
      window.localStorage.setItem(
        customFlowGraphStorageKey,
        JSON.stringify({
          nodes: flowNodes,
          connections: flowConnections,
          groups: flowGroups,
          notes: flowNotes,
          scale: flowScale,
          pan: flowPan
        })
      );
    }, 140);

    return () => window.clearTimeout(saveTimerId);
  }, [
    editingSavedFlowId,
    flowConnections,
    flowGroups,
    flowNodes,
    flowNotes,
    flowPan,
    flowScale,
    workflowMode
  ]);

  useEffect(() => {
    saveSettingPresets(settingPresets);
  }, [settingPresets]);

  useEffect(() => {
    saveSavedFlows(savedFlows);
    onSavedFlowsChange?.(listSavedFlows(savedFlows));
  }, [onSavedFlowsChange, savedFlows]);

  useEffect(() => {
    setFlowRunIssues((current) => (current.length > 0 ? [] : current));
  }, [flowConnections, flowNodes]);

  useEffect(
    () => () => {
      runTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      runTimersRef.current = [];
    },
    []
  );

  useEffect(() => {
    const handleFlowKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (isTyping && event.key === "Escape") {
        event.preventDefault();
        target?.blur();
        setFlowNoteMenu(null);
        setFlowNodeMenu(null);
        setFlowCanvasMenu(null);
        setExpandedGroupColorId("");
        setExpandedNoteColorId("");
        setPendingConnection(null);
        setConnectionDrag(null);
        setDraggingBasicPortTool(null);
        setActivePortDropTarget(null);
        updateActiveGroupDropId("");
        updateActivePromptAttachTargetId("");
        setHighlightedNodeIds([]);
        setHighlightedConnectionIds([]);
        setFlowRunIssues((current) => (current.length > 0 ? [] : current));
        return;
      }

      if (
        isTyping &&
        selectedNoteIds.length > 0 &&
        event.key === "Delete" &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        deleteSelectedFlowItems();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        target?.blur();
        setIsFlowSearchOpen(true);
        setIsBasicToolsOpen(false);
        setIsHistoryMenuOpen(false);
        setIsFlowRunMenuOpen(false);
        return;
      }

      if (isTyping) {
        return;
      }

      if (
        canSaveCustomFlowFromShortcut({
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          workflowMode
        })
      ) {
        event.preventDefault();
        saveCurrentFlowFromShortcut();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        cancelFlowInteraction();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        restorePreviousFlowState();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        restoreNextFlowState();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        const selectedNode = flowNodes.find((node) => node.nodeId === selectedNodeId);
        if (selectedNode) {
          event.preventDefault();
          setCopiedNode({ ...selectedNode });
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        if (copiedNode) {
          event.preventDefault();
          pasteFlowNode(copiedNode);
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g") {
        event.preventDefault();
        createFlowGroup();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedNodeIds.length > 0 || selectedGroupIds.length > 0 || selectedNoteIds.length > 0) {
          event.preventDefault();
          deleteSelectedFlowItems();
        }
      }
    };

    window.addEventListener("keydown", handleFlowKeyDown);
    return () => window.removeEventListener("keydown", handleFlowKeyDown);
  }, [
    copiedNode,
    flowConnections,
    flowFuture,
    flowGroups,
    flowHistory,
    flowNodes,
    flowNotes,
    flowPan,
    flowScale,
    onNotify,
    selectedNodeId,
    selectedNodeIds,
    selectedGroupIds,
    selectedNoteIds,
    workflowMode
  ]);

  useEffect(() => {
    if (!panningCanvas) {
      return;
    }

    const moveCanvas = (event: globalThis.PointerEvent | globalThis.MouseEvent) => {
      setFlowPan({
        x: panningCanvas.startX + event.clientX - panningCanvas.startClientX,
        y: panningCanvas.startY + event.clientY - panningCanvas.startClientY
      });
    };

    const stopCanvasPan = () => setPanningCanvas(null);

    window.addEventListener("pointermove", moveCanvas);
    window.addEventListener("pointerup", stopCanvasPan);
    window.addEventListener("pointercancel", stopCanvasPan);
    window.addEventListener("mousemove", moveCanvas);
    window.addEventListener("mouseup", stopCanvasPan);

    return () => {
      window.removeEventListener("pointermove", moveCanvas);
      window.removeEventListener("pointerup", stopCanvasPan);
      window.removeEventListener("pointercancel", stopCanvasPan);
      window.removeEventListener("mousemove", moveCanvas);
      window.removeEventListener("mouseup", stopCanvasPan);
    };
  }, [panningCanvas]);

  useEffect(() => {
    if (!selectionBox) {
      return;
    }

    const moveSelection = (event: globalThis.PointerEvent) => {
      const point = canvasPointFromPointer(event.clientX, event.clientY);
      setSelectionBox((current) => (current ? { ...current, currentX: point.x, currentY: point.y } : current));
    };

    const stopSelection = () => {
      setSelectionBox((current) => {
        if (!current) {
          return null;
        }

        const selectionRect = normalizeRect(current);
        const selectedIds = flowNodes
          .filter((node) => {
            const bounds = flowNodeBounds(node);
            return rectsIntersect(selectionRect, {
              left: bounds.left - 10,
              top: bounds.top - 10,
              right: bounds.right + 10,
              bottom: bounds.bottom + 10
            });
          })
          .map((node) => node.nodeId);
        const selectedNotes = flowNotes
          .filter((note) => rectsIntersect(selectionRect, flowNoteBounds(note)))
          .map((note) => note.id);
        const selectedGroups = flowGroups
          .filter((group) => {
            const bounds = groupBounds(group.nodeIds);
            return bounds ? rectsIntersect(selectionRect, bounds) : false;
          })
          .map((group) => group.id);
        setSelectedNodeIds(selectedIds);
        setSelectedNodeId(selectedIds[0] ?? "");
        setSelectedNoteIds(selectedNotes);
        setSelectedGroupIds(selectedGroups);
        return null;
      });
    };

    window.addEventListener("pointermove", moveSelection);
    window.addEventListener("pointerup", stopSelection);
    window.addEventListener("pointercancel", stopSelection);

    return () => {
      window.removeEventListener("pointermove", moveSelection);
      window.removeEventListener("pointerup", stopSelection);
      window.removeEventListener("pointercancel", stopSelection);
    };
  }, [selectionBox, flowGroups, flowNodes, flowNotes, flowPan.x, flowPan.y, flowScale]);

  useEffect(() => {
    if (!draggingNode) {
      return;
    }

    let queuedFlowNodes: FlowNode[] | null = null;
    let animationFrameId = 0;
    let didStopDrag = false;
    const scheduleFlowNodesUpdate = (nextNodes: FlowNode[]) => {
      queuedFlowNodes = nextNodes;
      if (animationFrameId) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = 0;
        const nodes = queuedFlowNodes;
        queuedFlowNodes = null;
        if (nodes) {
          setFlowNodes(nodes);
        }
      });
    };
    const flushFlowNodesUpdate = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
      const nodes = queuedFlowNodes;
      queuedFlowNodes = null;
      if (nodes) {
        setFlowNodes(nodes);
      }
    };

    const moveNode = (event: globalThis.PointerEvent) => {
      if (!flowCanvasRef.current) {
        return;
      }

      const rect = flowCanvasRef.current.getBoundingClientRect();
      const nextWorldX = (event.clientX - rect.left - flowPan.x) / flowScale;
      const nextWorldY = (event.clientY - rect.top - flowPan.y) / flowScale;
      const deltaX = nextWorldX - draggingNode.startWorldX;
      const deltaY = nextWorldY - draggingNode.startWorldY;
      const originMap = new Map(draggingNode.origins.map((origin) => [origin.nodeId, origin]));
      const selectedIdSet = new Set(draggingNode.nodeIds);
      let snapDeltaX = 0;
      let snapDeltaY = 0;

      if (event.shiftKey) {
        const movingBounds = boundsFromRects(
          flowNodes
            .filter((node) => selectedIdSet.has(node.nodeId))
            .map((node) => {
              const origin = originMap.get(node.nodeId);
              const x = (origin?.x ?? node.x) + deltaX;
              const y = (origin?.y ?? node.y) + deltaY;
              return {
                id: node.nodeId,
                left: x,
                top: y,
                right: x + flowNodeWidth,
                bottom: y + estimateFlowNodeHeight(node)
              };
            })
        );

        if (movingBounds) {
          const snap = calculateSmartGuideSnap({
            moving: movingBounds,
            stationary: flowNodes
              .filter((node) => !selectedIdSet.has(node.nodeId))
              .map(flowNodeBounds),
            threshold: 8 / flowScale
          });
          snapDeltaX = snap.deltaX;
          snapDeltaY = snap.deltaY;
          setSmartGuides(snap.guides);
        }
      } else {
        setSmartGuides([]);
      }

      const movedBounds = boundsFromRects(
        flowNodes
          .filter((node) => selectedIdSet.has(node.nodeId))
          .map((node) => {
            const origin = originMap.get(node.nodeId);
            const x = (origin?.x ?? node.x) + deltaX + snapDeltaX;
            const y = (origin?.y ?? node.y) + deltaY + snapDeltaY;
            return {
              id: node.nodeId,
              left: x,
              top: y,
              right: x + flowNodeWidth,
              bottom: y + estimateFlowNodeHeight(node)
            };
          })
      );

      if (movedBounds) {
        const draggingSingleNode = flowNodes.find((node) => node.nodeId === draggingNode.nodeId);
        const isDraggingPrompt =
          draggingNode.nodeIds.length === 1 && draggingSingleNode && isPromptFlowNode(draggingSingleNode);
        const center = {
          x: (movedBounds.left + movedBounds.right) / 2,
          y: (movedBounds.top + movedBounds.bottom) / 2
        };
        const targetGroup = isDraggingPrompt ? undefined : flowGroups.find((group) => {
          if (draggingNode.nodeIds.every((nodeId) => group.nodeIds.includes(nodeId))) {
            return false;
          }
          const bounds = groupBounds(group.nodeIds);
          if (!bounds) {
            return false;
          }
          return (
            center.x >= bounds.left &&
            center.x <= bounds.right &&
            center.y >= bounds.top &&
            center.y <= bounds.bottom
          );
        });
        updateActiveGroupDropId(targetGroup?.id ?? "");
        if (isDraggingPrompt) {
          const promptCenterX = (movedBounds.left + movedBounds.right) / 2;
          const targetNode = flowNodes
            .filter((node) => node.nodeId !== draggingNode.nodeId && !isPromptFlowNode(node))
            .map((node) => {
              const bounds = flowNodeBounds(node);
              const horizontallyAligned =
                promptCenterX >= bounds.left - 36 && promptCenterX <= bounds.right + 36;
              const nearNodeBottom =
                movedBounds.top >= bounds.top && movedBounds.top <= bounds.bottom + 180;
              return {
                node,
                distance: Math.abs(movedBounds.top - bounds.bottom),
                matches: horizontallyAligned && nearNodeBottom
              };
            })
            .filter((candidate) => candidate.matches)
            .sort((a, b) => a.distance - b.distance)[0]?.node;
          updateActivePromptAttachTargetId(targetNode?.nodeId ?? "");
        } else {
          updateActivePromptAttachTargetId("");
        }
      } else {
        updateActiveGroupDropId("");
        updateActivePromptAttachTargetId("");
      }

      scheduleFlowNodesUpdate(
        applyFlowNodeDrag(flowNodes, draggingNode.origins, {
          x: deltaX + snapDeltaX,
          y: deltaY + snapDeltaY
        })
      );
    };

    const stopNodeDrag = () => {
      if (didStopDrag) {
        return;
      }
      didStopDrag = true;
      flushFlowNodesUpdate();
      const groupId = activeGroupDropIdRef.current;
      if (groupId) {
        const droppedIds = draggingNode.nodeIds;
        setFlowGroups((groups) =>
          groups.map((group) =>
            group.id === groupId
              ? { ...group, nodeIds: Array.from(new Set([...group.nodeIds, ...droppedIds])) }
              : group
          )
        );
      }

      const targetNodeId = activePromptAttachTargetIdRef.current;
      if (draggingNode.nodeIds.length === 1) {
        const promptNodeId = draggingNode.nodeIds[0];
        if (!targetNodeId) {
          setFlowNodes((items) =>
            items.map((node) =>
              node.nodeId === promptNodeId ? { ...node, attachedToNodeId: undefined } : node
            )
          );
        } else {
          const targetNode = flowNodes.find((node) => node.nodeId === targetNodeId);
          if (targetNode) {
            const nextY = targetNode.y + estimateFlowNodeHeight(targetNode) + 14;
            setFlowNodes((items) =>
              items.map((node) =>
                node.nodeId === promptNodeId
                  ? {
                      ...node,
                      x: targetNode.x,
                      y: nextY,
                      attachedToNodeId: targetNodeId
                    }
                  : node.nodeId === targetNodeId
                    ? node
                    : node.attachedToNodeId === targetNodeId && node.nodeId !== promptNodeId
                      ? { ...node, attachedToNodeId: undefined }
                      : node
              )
            );
          }
        }
      }
      updateActiveGroupDropId("");
      updateActivePromptAttachTargetId("");
      setDraggingNode(null);
      setSmartGuides([]);
    };

    window.addEventListener("pointermove", moveNode);
    window.addEventListener("pointerup", stopNodeDrag);
    window.addEventListener("pointercancel", stopNodeDrag);

    return () => {
      window.removeEventListener("pointermove", moveNode);
      window.removeEventListener("pointerup", stopNodeDrag);
      window.removeEventListener("pointercancel", stopNodeDrag);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [draggingNode, flowPan.x, flowPan.y, flowScale]);

  useEffect(() => {
    if (!draggingGroup) {
      return;
    }

    let queuedFlowNodes: FlowNode[] | null = null;
    let animationFrameId = 0;
    let didStopGroupDrag = false;
    const scheduleFlowNodesUpdate = (nextNodes: FlowNode[]) => {
      queuedFlowNodes = nextNodes;
      if (animationFrameId) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = 0;
        const nodes = queuedFlowNodes;
        queuedFlowNodes = null;
        if (nodes) {
          setFlowNodes(nodes);
        }
      });
    };
    const flushFlowNodesUpdate = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
      const nodes = queuedFlowNodes;
      queuedFlowNodes = null;
      if (nodes) {
        setFlowNodes(nodes);
      }
    };

    const moveGroup = (event: globalThis.PointerEvent) => {
      if (!flowCanvasRef.current) {
        return;
      }

      const rect = flowCanvasRef.current.getBoundingClientRect();
      const nextWorldX = (event.clientX - rect.left - flowPan.x) / flowScale;
      const nextWorldY = (event.clientY - rect.top - flowPan.y) / flowScale;
      const deltaX = nextWorldX - draggingGroup.startWorldX;
      const deltaY = nextWorldY - draggingGroup.startWorldY;
      scheduleFlowNodesUpdate(
        applyFlowNodeDrag(flowNodes, draggingGroup.origins, { x: deltaX, y: deltaY })
      );
    };

    const stopGroupDrag = () => {
      if (didStopGroupDrag) {
        return;
      }
      didStopGroupDrag = true;
      flushFlowNodesUpdate();
      setDraggingGroup(null);
    };

    window.addEventListener("pointermove", moveGroup);
    window.addEventListener("pointerup", stopGroupDrag);
    window.addEventListener("pointercancel", stopGroupDrag);

    return () => {
      window.removeEventListener("pointermove", moveGroup);
      window.removeEventListener("pointerup", stopGroupDrag);
      window.removeEventListener("pointercancel", stopGroupDrag);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [draggingGroup, flowPan.x, flowPan.y, flowScale]);

  useEffect(() => {
    if (!draggingNote) {
      return;
    }

    let queuedFlowNotes: FlowNote[] | null = null;
    let animationFrameId = 0;
    let didStopNoteDrag = false;
    const scheduleFlowNotesUpdate = (nextNotes: FlowNote[]) => {
      queuedFlowNotes = nextNotes;
      if (animationFrameId) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = 0;
        const notes = queuedFlowNotes;
        queuedFlowNotes = null;
        if (notes) {
          setFlowNotes(notes);
        }
      });
    };
    const flushFlowNotesUpdate = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
      const notes = queuedFlowNotes;
      queuedFlowNotes = null;
      if (notes) {
        setFlowNotes(notes);
      }
    };

    const moveNote = (event: globalThis.PointerEvent) => {
      if (!flowCanvasRef.current) {
        return;
      }

      const rect = flowCanvasRef.current.getBoundingClientRect();
      const nextWorldX = (event.clientX - rect.left - flowPan.x) / flowScale;
      const nextWorldY = (event.clientY - rect.top - flowPan.y) / flowScale;
      scheduleFlowNotesUpdate(
        flowNotes.map((note) =>
          note.id === draggingNote.noteId
            ? {
                ...note,
                x: draggingNote.originX + nextWorldX - draggingNote.startWorldX,
                y: draggingNote.originY + nextWorldY - draggingNote.startWorldY
              }
            : note
        )
      );
    };

    const stopNoteDrag = () => {
      if (didStopNoteDrag) {
        return;
      }
      didStopNoteDrag = true;
      flushFlowNotesUpdate();
      setDraggingNote(null);
    };

    window.addEventListener("pointermove", moveNote);
    window.addEventListener("pointerup", stopNoteDrag);
    window.addEventListener("pointercancel", stopNoteDrag);

    return () => {
      window.removeEventListener("pointermove", moveNote);
      window.removeEventListener("pointerup", stopNoteDrag);
      window.removeEventListener("pointercancel", stopNoteDrag);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [draggingNote, flowPan.x, flowPan.y, flowScale]);

  useEffect(() => {
    if (!connectionDrag) {
      return;
    }

    const moveConnection = (event: globalThis.PointerEvent) => {
      const point = canvasPointFromPointer(event.clientX, event.clientY);
      setConnectionDrag((current) => (current ? { ...current, ...point } : current));
    };

    const stopConnection = (event: globalThis.PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const inputNodeId = target
        ?.closest("[data-flow-input-node]")
        ?.getAttribute("data-flow-input-node");
      const inputPortId = target
        ?.closest("[data-flow-input-port]")
        ?.getAttribute("data-flow-input-port");
      const outputNodeId = target
        ?.closest("[data-flow-output-node]")
        ?.getAttribute("data-flow-output-node");

      if (inputNodeId && inputPortId) {
        connectFlowPorts(
          connectionDrag.fromNodeId,
          connectionDrag.fromPortId,
          inputNodeId,
          inputPortId
        );
        suppressNextInputClickRef.current = true;
        setConnectionDrag(null);
        return;
      }

      if (!outputNodeId) {
        setConnectionDrag(null);
        setPendingConnection(null);
      }
    };

    window.addEventListener("pointermove", moveConnection);
    window.addEventListener("pointerup", stopConnection);
    window.addEventListener("pointercancel", stopConnection);

    return () => {
      window.removeEventListener("pointermove", moveConnection);
      window.removeEventListener("pointerup", stopConnection);
      window.removeEventListener("pointercancel", stopConnection);
    };
  }, [connectionDrag, flowPan.x, flowPan.y, flowScale]);

  const addFlowNode = (toolInput: string | FlowTool, position?: { x: number; y: number }) => {
    const tool =
      typeof toolInput === "string"
        ? flowToolPalette.find((item) => item.id === toolInput)
        : toolInput;
    if (!tool) {
      return;
    }

    const nodeId = `node-${tool.id}-${Date.now()}`;
    const nextTool = cloneFlowTool(tool);
    const nodeDefaults = tool.id === "basic-custom-prompt" ? { promptText: "" } : {};
    rememberFlowState();
    setFlowNodes((items) => [
      ...items,
      { ...nextTool, ...nodeDefaults, nodeId, ...(position ?? defaultFlowNodePosition(items.length)) }
    ]);
    setExpandedNodeIds((ids) => [...ids.filter((id) => id !== nodeId), nodeId]);
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedGroupIds([]);
    setSelectedNoteIds([]);
  };

  const handleFlowDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const removedPortRaw = event.dataTransfer.getData("application/x-flow-remove-port");
    if (removedPortRaw) {
      try {
        const removedPort = JSON.parse(removedPortRaw) as {
          nodeId?: string;
          direction?: "input" | "output";
          portId?: string;
        };
        if (removedPort.nodeId && removedPort.direction && removedPort.portId) {
          removeCustomFlowPort(removedPort.nodeId, removedPort.direction, removedPort.portId);
        }
      } catch {
        // Ignore invalid drag payloads from outside the app.
      }
      setActivePortDropTarget(null);
      return;
    }

    if (event.dataTransfer.types.includes("application/x-flow-port-tool")) {
      setActivePortDropTarget(null);
      setDraggingBasicPortTool(null);
      return;
    }

    const draggedFlow = parseDraggedSavedFlow(
      event.dataTransfer.getData("application/x-custom-flow")
    );
    if (draggedFlow) {
      const dropPoint = canvasPointFromPointer(event.clientX, event.clientY);
      rememberFlowState();
      const next = insertStoredFlowGraphAsGroup(
        {
          nodes: flowNodes,
          connections: flowConnections,
          groups: flowGroups,
          notes: flowNotes
        },
        draggedFlow.graph,
        {
          flowName: draggedFlow.name,
          x: dropPoint.x - 120,
          y: dropPoint.y - 28
        }
      );
      const importedGroup = next.groups[next.groups.length - 1];
      setFlowNodes(next.nodes);
      setFlowConnections(next.connections);
      setFlowGroups(next.groups);
      setFlowNotes(next.notes);
      setSelectedNodeId("");
      setSelectedNodeIds(importedGroup?.nodeIds ?? []);
      setSelectedGroupIds(importedGroup ? [importedGroup.id] : []);
      setSelectedNoteIds([]);
      return;
    }

    const toolId = event.dataTransfer.getData("application/x-flow-tool");
    const draggedTool = parseDraggedFlowTool(
      event.dataTransfer.getData("application/x-flow-tool-data")
    );
    const tool = draggedTool ?? flowToolPalette.find((item) => item.id === toolId);
    if (!tool) {
      return;
    }

    const dropPoint = canvasPointFromPointer(event.clientX, event.clientY);
    addFlowNode(tool, {
      x: dropPoint.x - 120,
      y: dropPoint.y - 28
    });
  };

  const handleFlowPortToolDrop = (
    event: DragEvent<HTMLDivElement>,
    nodeId: string,
    direction: "input" | "output"
  ) => {
    const portToolRaw = event.dataTransfer.getData("application/x-flow-port-tool");
    if (!portToolRaw) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    try {
      const portTool = JSON.parse(portToolRaw) as FlowBasicPortTool;
      if (!portTool.direction || !portTool.label || !portTool.type) {
        return;
      }
      if (!canDropBasicPortTool(portTool, direction)) {
        return;
      }
      addCustomFlowPort(nodeId, direction, portTool.label, portTool.type);
    } catch {
      // Ignore invalid drag payloads from outside the app.
    } finally {
      setActivePortDropTarget(null);
      setDraggingBasicPortTool(null);
    }
  };

  const handleFlowWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!flowCanvasRef.current) {
      return;
    }

    const rect = flowCanvasRef.current.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const worldX = (pointerX - flowPan.x) / flowScale;
    const worldY = (pointerY - flowPan.y) / flowScale;
    const zoomStep = event.deltaY < 0 ? 0.08 : -0.08;
    const nextScale = Math.min(1.8, Math.max(0.28, Number((flowScale + zoomStep).toFixed(2))));

    setFlowScale(nextScale);
    setFlowPan({
      x: pointerX - worldX * nextScale,
      y: pointerY - worldY * nextScale
    });
  };

  const blurActiveFlowInput = () => {
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT" ||
        active.isContentEditable)
    ) {
      active.blur();
    }
  };

  const startCanvasPan = (event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastCanvasPanStartAtRef.current < 80) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    lastCanvasPanStartAtRef.current = now;
    event.preventDefault();
    event.stopPropagation();
    if (now - lastMiddleClickAtRef.current < 320) {
      lastMiddleClickAtRef.current = 0;
      setPanningCanvas(null);
      fitFlowToNodes();
      return;
    }

    lastMiddleClickAtRef.current = now;
    setFlowNodeMenu(null);
    setFlowCanvasMenu(null);
    setPanningCanvas({
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: flowPan.x,
      startY: flowPan.y
    });
  };

  const handleFlowCanvasPointerDownCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button === 1) {
      blurActiveFlowInput();
      startCanvasPan(event);
    }
  };

  const handleFlowCanvasMouseDownCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button === 1) {
      blurActiveFlowInput();
      startCanvasPan(event);
    }
  };

  const handleFlowCanvasPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (event.button === 1) {
      return;
    }

    if (event.button !== 0 || target?.closest(".flowNode")) {
      return;
    }

    event.preventDefault();
    blurActiveFlowInput();
    setFlowNodeMenu(null);
    setFlowCanvasMenu(null);
    setSelectedGroupIds([]);
    setSelectedNoteIds([]);
    if (pendingConnection || connectionDrag) {
      setPendingConnection(null);
      setConnectionDrag(null);
      return;
    }
    const point = canvasPointFromPointer(event.clientX, event.clientY);
    setSelectionBox({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y
    });
  };

  const startSelectionBoxFromPointer = (event: PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setFlowNodeMenu(null);
    setFlowCanvasMenu(null);
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedGroupIds([]);
    setSelectedNoteIds([]);
    const point = canvasPointFromPointer(event.clientX, event.clientY);
    setSelectionBox({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y
    });
  };

  const handleFlowCanvasContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".flowNode") || target?.closest(".flowNote") || target?.closest(".flowGroupBox")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const point = canvasPointFromPointer(event.clientX, event.clientY);
    setFlowNodeMenu(null);
    setFlowCanvasMenu({
      x: event.clientX,
      y: event.clientY,
      worldX: point.x,
      worldY: point.y
    });
  };

  const handleFlowCanvasDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".flowNode") || target?.closest(".flowNote") || target?.closest(".flowGroupBox")) {
      return;
    }

    event.preventDefault();
    const point = canvasPointFromPointer(event.clientX, event.clientY);
    createFlowNote({ x: point.x, y: point.y });
  };

  const handleFlowNodePointerDown = (event: PointerEvent<HTMLDivElement>, nodeId: string) => {
    if (event.button !== 0) {
      return;
    }

    blurActiveFlowInput();
    event.stopPropagation();
    setSelectedGroupIds([]);
    setSelectedNoteIds([]);
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      setSelectedNodeIds((ids) => {
        const next = ids.includes(nodeId)
          ? ids.filter((id) => id !== nodeId)
          : [...ids, nodeId];
        setSelectedNodeId(next.at(-1) ?? "");
        return next;
      });
      return;
    }

    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
  };

  const startNodeDrag = (event: PointerEvent<HTMLElement>, nodeId: string) => {
    if (event.button !== 0) {
      return;
    }

    blurActiveFlowInput();
    event.preventDefault();
    event.stopPropagation();
    setFlowNodeMenu(null);
    if (!flowCanvasRef.current) {
      return;
    }

    const rect = flowCanvasRef.current.getBoundingClientRect();
    const startWorldX = (event.clientX - rect.left - flowPan.x) / flowScale;
    const startWorldY = (event.clientY - rect.top - flowPan.y) / flowScale;
    const nextSelection =
      selectedNodeIds.includes(nodeId)
        ? selectedNodeIds
        : event.ctrlKey || event.metaKey || event.shiftKey
          ? [...selectedNodeIds, nodeId]
          : [nodeId];
    const selectionWithAttachedPrompts = [
      ...nextSelection,
      ...flowNodes
        .filter((node) => node.attachedToNodeId && nextSelection.includes(node.attachedToNodeId))
        .map((node) => node.nodeId)
    ];
    const uniqueSelection = Array.from(new Set(selectionWithAttachedPrompts));
    const origins = flowNodes
      .filter((node) => uniqueSelection.includes(node.nodeId))
      .map((node) => ({ nodeId: node.nodeId, x: node.x, y: node.y }));
    if (origins.length === 0) {
      return;
    }

    rememberFlowState();
    setSelectedNodeId(nodeId);
    setSelectedNodeIds(uniqueSelection);
    setSelectedGroupIds([]);
    setSelectedNoteIds([]);
    setDraggingNode({
      nodeId,
      nodeIds: uniqueSelection,
      startWorldX,
      startWorldY,
      origins
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startConnectionDrag = (
    event: PointerEvent<HTMLElement>,
    nodeId: string,
    portId: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const point = canvasPointFromPointer(event.clientX, event.clientY);
    setPendingConnection({ nodeId, portId });
    setConnectionDrag({ fromNodeId: nodeId, fromPortId: portId, ...point });
  };

  const handleInputPortClick = (
    event: MouseEvent<HTMLElement>,
    nodeId: string,
    portId: string
  ) => {
    event.stopPropagation();
    if (suppressNextInputClickRef.current) {
      suppressNextInputClickRef.current = false;
      return;
    }
    if (!pendingConnection || pendingConnection.nodeId === nodeId) {
      rememberFlowState();
      setFlowConnections((connections) =>
        connections.filter(
          (connection) => !(connection.toNodeId === nodeId && connection.toPortId === portId)
        )
      );
      return;
    }

    connectFlowPorts(pendingConnection.nodeId, pendingConnection.portId, nodeId, portId);
  };

  const removeFlowConnection = (connectionId: string) => {
    rememberFlowState();
    setFlowConnections((connections) =>
      connections.filter((connection) => connection.id !== connectionId)
    );
  };

  const pasteFlowNode = (node: FlowNode) => {
    const nodeId = `node-${node.id}-${Date.now()}`;
    const pastedNode = {
      ...node,
      inputs: node.inputs.map((port) => ({ ...port })),
      outputs: node.outputs.map((port) => ({ ...port })),
      nodeId,
      x: node.x + 34,
      y: node.y + 34
    };

    rememberFlowState();
    setFlowNodes((items) => [...items, pastedNode]);
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
  };

  const deleteFlowNode = (nodeId: string) => {
    if (!flowNodes.some((node) => node.nodeId === nodeId)) {
      return;
    }

    rememberFlowState();
    setFlowNodes((items) =>
      items
        .filter((node) => node.nodeId !== nodeId)
        .map((node) =>
          node.attachedToNodeId === nodeId ? { ...node, attachedToNodeId: undefined } : node
        )
    );
    setFlowConnections((connections) =>
      connections.filter(
        (connection) => connection.fromNodeId !== nodeId && connection.toNodeId !== nodeId
      )
    );
    setSelectedNodeId((current) => (current === nodeId ? "" : current));
    setSelectedNodeIds((ids) => ids.filter((id) => id !== nodeId));
    setFlowGroups((groups) =>
      groups
        .map((group) => ({
          ...group,
          nodeIds: group.nodeIds.filter((id) => id !== nodeId)
        }))
        .filter((group) => group.nodeIds.length > 0)
    );
    setExpandedNodeIds((ids) => ids.filter((id) => id !== nodeId));
    setFlowNodeMenu(null);
  };

  const openFlowNodeMenu = (event: MouseEvent<HTMLDivElement>, nodeId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const position = contextMenuPosition(event, { width: 184, height: 150 });
    setSelectedNodeId(nodeId);
    setSelectedNodeIds((ids) => (ids.includes(nodeId) ? ids : [nodeId]));
    setFlowNodeMenu({ nodeId, ...position });
  };

  const updateFlowGroupName = (groupId: string, name: string) => {
    setFlowGroups((groups) =>
      groups.map((group) => (group.id === groupId ? { ...group, name } : group))
    );
  };

  const updateFlowGroupColor = (groupId: string, color: string) => {
    rememberFlowState();
    setFlowGroups((groups) =>
      groups.map((group) => (group.id === groupId ? { ...group, color } : group))
    );
    setExpandedGroupColorId("");
  };

  const startGroupDrag = (event: PointerEvent<HTMLElement>, group: FlowGroup) => {
    if (event.button !== 0 || !flowCanvasRef.current) {
      return;
    }

    blurActiveFlowInput();
    event.preventDefault();
    event.stopPropagation();
    const baseNodeIds = group.nodeIds.filter((id) => flowNodes.some((node) => node.nodeId === id));
    const validNodeIds = Array.from(
      new Set([
        ...baseNodeIds,
        ...flowNodes
          .filter((node) => node.attachedToNodeId && baseNodeIds.includes(node.attachedToNodeId))
          .map((node) => node.nodeId)
      ])
    );
    const origins = flowNodes
      .filter((node) => validNodeIds.includes(node.nodeId))
      .map((node) => ({ nodeId: node.nodeId, x: node.x, y: node.y }));
    if (origins.length === 0) {
      return;
    }

    const rect = flowCanvasRef.current.getBoundingClientRect();
    const startWorldX = (event.clientX - rect.left - flowPan.x) / flowScale;
    const startWorldY = (event.clientY - rect.top - flowPan.y) / flowScale;
    rememberFlowState();
    setFlowNodeMenu(null);
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedNoteIds([]);
    setSelectedGroupIds([group.id]);
    setDraggingGroup({
      groupId: group.id,
      nodeIds: validNodeIds,
      startWorldX,
      startWorldY,
      origins
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const nodeMap = new Map(flowNodes.map((node) => [node.nodeId, node]));
  const pendingOutputNode = pendingConnection ? nodeMap.get(pendingConnection.nodeId) : null;
  const pendingOutputPort = pendingOutputNode?.outputs.find(
    (port) => port.id === pendingConnection?.portId
  );
  const flowGridSize = 26 * flowScale;
  const flowCanvasStyle = {
    "--flow-grid-size": `${flowGridSize}px`,
    "--flow-grid-x": `${flowPan.x % flowGridSize}px`,
    "--flow-grid-y": `${flowPan.y % flowGridSize}px`
  } as CSSProperties;
  const renderedFlowGroups = flowGroups
    .map((group) => ({ group, bounds: groupBounds(group.nodeIds) }))
    .filter((item): item is { group: FlowGroup; bounds: NonNullable<ReturnType<typeof groupBounds>> } =>
      Boolean(item.bounds)
    );
  const selectionRect = selectionBox ? normalizeRect(selectionBox) : null;
  const flowValidationIssues = useMemo(
    () => validateFlowGraph(flowNodes, flowConnections),
    [flowConnections, flowNodes]
  );
  const flowVisibleIssues = useMemo(() => {
    const issueMap = new Map<string, FlowValidationIssue>();
    flowValidationIssues.forEach((issue) => issueMap.set(issue.id, issue));
    flowRunIssues.forEach((issue) => issueMap.set(issue.id, issue));
    return Array.from(issueMap.values());
  }, [flowRunIssues, flowValidationIssues]);
  const flowValidationErrorCount = flowVisibleIssues.filter(
    (issue) => issue.severity === "error"
  ).length;
  const flowValidationWarningCount = flowVisibleIssues.length - flowValidationErrorCount;
  const flowValidationTone =
    flowValidationErrorCount > 0
      ? "error"
      : flowValidationWarningCount > 0
        ? "warning"
        : "ready";
  const flowValidationIssueCount = flowVisibleIssues.length;
  const nodeIdsForValidationIssue = (issue: FlowValidationIssue) => {
    const connection = issue.connectionId
      ? flowConnections.find((item) => item.id === issue.connectionId)
      : null;

    return issue.nodeId
      ? [issue.nodeId]
      : connection
        ? [connection.fromNodeId, connection.toNodeId]
        : [];
  };
  const flowValidationNodeToneById = useMemo(() => {
    const toneMap = new Map<string, "error" | "warning">();
    flowVisibleIssues.forEach((issue) => {
      nodeIdsForValidationIssue(issue).forEach((nodeId) => {
        const current = toneMap.get(nodeId);
        if (issue.severity === "error" || !current) {
          toneMap.set(nodeId, issue.severity);
        }
      });
    });
    return toneMap;
  }, [flowConnections, flowVisibleIssues]);
  const flowValidationNodeIssuesById = useMemo(() => {
    const issueMap = new Map<string, FlowValidationIssue[]>();
    flowVisibleIssues.forEach((issue) => {
      nodeIdsForValidationIssue(issue).forEach((nodeId) => {
        issueMap.set(nodeId, [...(issueMap.get(nodeId) ?? []), issue]);
      });
    });
    return issueMap;
  }, [flowConnections, flowVisibleIssues]);
  const flowRunRecordByNodeId = useMemo(() => {
    const recordMap = new Map<string, FlowRunRecord>();
    flowRunRecords.forEach((record) => recordMap.set(record.nodeId, record));
    return recordMap;
  }, [flowRunRecords]);
  const normalizedFlowSearchQuery = flowSearchQuery.trim().toLowerCase();
  const flowSearchResults = useMemo(() => {
    if (!normalizedFlowSearchQuery) {
      return flowNodes.slice(0, 8);
    }

    return flowNodes
      .filter((node) => {
        const haystack = [
          node.name,
          node.description,
          ...node.inputs.map((port) => port.label),
          ...node.outputs.map((port) => port.label)
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedFlowSearchQuery);
      })
      .slice(0, 12);
  }, [flowNodes, normalizedFlowSearchQuery]);
  const basicPortFilterLabel =
    flowBasicPortFilters.find((filter) => filter.id === basicPortFilter)?.label ?? "전체";
  const filteredBasicPortTools = useMemo(
    () => flowBasicPortTools.filter((tool) => flowBasicPortToolMatchesFilter(tool, basicPortFilter)),
    [basicPortFilter]
  );

  const runFlow = () => {
    const nodeIds = resolveFlowRunNodeIds(
      flowNodes,
      flowConnections,
      flowRunMode,
      flowRunScope,
      selectedNodeId || flowNodes[0]?.nodeId
    );
    if (nodeIds.length === 0) {
      return;
    }

    runTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    runTimersRef.current = [];
    setRunningNodeIds([]);
    setFlowRunRecords([]);

    if (flowValidationIssues.length > 0) {
      const nextRunIssues = flowValidationIssues.map((issue) => ({
        ...issue,
        title: `실행 중단: ${issue.title}`,
        message: `${issue.message} 이 문제를 해결한 뒤 다시 실행하세요.`
      }));
      setFlowRunIssues((current) =>
        areFlowValidationIssuesEqual(current, nextRunIssues) ? current : nextRunIssues
      );
      setIsFlowValidationPinned(true);
      const firstIssue = flowValidationIssues[0];
      const connection = firstIssue.connectionId
        ? flowConnections.find((item) => item.id === firstIssue.connectionId)
        : null;
      setHighlightedConnectionIds(firstIssue.connectionId ? [firstIssue.connectionId] : []);
      setHighlightedNodeIds(
        firstIssue.nodeId
          ? [firstIssue.nodeId]
          : connection
            ? [connection.fromNodeId, connection.toNodeId]
            : []
      );
      return;
    }

    setFlowRunIssues((current) => (current.length > 0 ? [] : current));
    setFlowRunRecords(buildFlowRunRecords(flowNodes, flowConnections, nodeIds));
    nodeIds.forEach((nodeId, index) => {
      const startTimerId = window.setTimeout(() => {
        setRunningNodeIds([nodeId]);
        setFlowRunRecords((records) =>
          records.map((record) =>
            record.nodeId === nodeId
              ? { ...record, status: "running", message: "실행 중입니다." }
              : record
          )
        );
      }, index * 520);
      const finishTimerId = window.setTimeout(() => {
        setFlowRunRecords((records) =>
          records.map((record) =>
            record.nodeId === nodeId
              ? {
                  ...record,
                  status: "success",
                  message: "실행 완료. 중간 결과를 확인하세요."
                }
              : record
          )
        );
      }, index * 520 + 380);
      runTimersRef.current.push(startTimerId);
      runTimersRef.current.push(finishTimerId);
    });

    const clearTimerId = window.setTimeout(() => {
      setRunningNodeIds([]);
      runTimersRef.current = [];
    }, nodeIds.length * 520 + 420);
    runTimersRef.current.push(clearTimerId);
  };

  const focusFlowIssue = (issue: (typeof flowValidationIssues)[number]) => {
    const nextConnectionIds = issue.connectionId ? [issue.connectionId] : [];
    const connection = issue.connectionId
      ? flowConnections.find((item) => item.id === issue.connectionId)
      : null;
    const nextNodeIds = issue.nodeId
      ? [issue.nodeId]
      : connection
        ? [connection.fromNodeId, connection.toNodeId]
        : [];

    setHighlightedConnectionIds(nextConnectionIds);
    setHighlightedNodeIds(nextNodeIds);
    if (nextNodeIds[0]) {
      setSelectedNodeId(nextNodeIds[0]);
      setSelectedNodeIds(nextNodeIds);
      setSelectedGroupIds([]);
      setSelectedNoteIds([]);
      setExpandedNodeIds((ids) =>
        ids.includes(nextNodeIds[0]) ? ids : [...ids, nextNodeIds[0]]
      );
    }
  };
  const focusFlowNode = (nodeId: string) => {
    const node = flowNodes.find((item) => item.nodeId === nodeId);
    if (!node || !flowCanvasRef.current) {
      return;
    }

    const rect = flowCanvasRef.current.getBoundingClientRect();
    const nodeHeight = estimateFlowNodeHeight(node);
    setSelectedNodeId(node.nodeId);
    setSelectedNodeIds([node.nodeId]);
    setSelectedGroupIds([]);
    setSelectedNoteIds([]);
    setExpandedNodeIds((ids) => (ids.includes(node.nodeId) ? ids : [...ids, node.nodeId]));
    setFlowPan({
      x: rect.width / 2 - (node.x + flowNodeWidth / 2) * flowScale,
      y: rect.height / 2 - (node.y + nodeHeight / 2) * flowScale
    });
    setIsFlowSearchOpen(false);
  };
  const flowNodeMenuNodeIds = flowNodeMenu
    ? selectedNodeIds.includes(flowNodeMenu.nodeId)
      ? selectedNodeIds
      : [flowNodeMenu.nodeId]
    : [];
  const flowNodeMenuGroupedNodeIds = flowNodeMenuNodeIds.filter((nodeId) =>
    flowGroups.some((group) => group.nodeIds.includes(nodeId))
  );
  const flowNodeMenuHasGroup =
    flowNodeMenuGroupedNodeIds.length > 0 ||
    Boolean(
      flowNodeMenu &&
        flowGroups.some((group) => group.nodeIds.includes(flowNodeMenu.nodeId))
    );
  const flowRunCompletedCount = flowRunRecords.filter((record) => record.status === "success").length;
  const flowRunImpactItems = Array.from(
    new Set(flowRunRecords.flatMap((record) => record.impact.items))
  ).slice(0, 6);
  const isFlowToolbarActive =
    isBasicToolsOpen || isHistoryMenuOpen || isFlowRunMenuOpen || isFlowSearchOpen;

  if (workflowMode === "home") {
    return (
      <>
        <WorkflowHomeView
          savedFlows={listSavedFlows(savedFlows)}
          sharedFlows={sharedFlows}
          onCreateNew={createNewFlow}
          onOpenFlowMarket={onOpenFlowMarket}
          onOpenShared={openSharedFlow}
          onOpenSaved={openSavedFlow}
          onUpdateSavedDetails={updateSavedFlowHomeDetails}
          onDuplicateSaved={duplicateFlow}
          onDeleteSaved={deleteFlow}
        />
        {deleteFlowRequest ? (
          <div className="flowConfirmBackdrop" role="presentation">
            <section
              className="flowConfirmDialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="deleteFlowDialogTitle"
            >
              <strong id="deleteFlowDialogTitle">플로우 삭제</strong>
              <p>
                `{deleteFlowRequest.name}` 플로우를 삭제할까요? 이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="flowConfirmActions">
                <button type="button" onClick={() => setDeleteFlowRequest(null)}>
                  취소
                </button>
                <button className="danger" type="button" onClick={confirmDeleteFlow}>
                  삭제
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <section className="sectionView customFlowView">
      <div
        ref={flowCanvasRef}
        className={["flowCanvas", panningCanvas ? "panning" : ""].filter(Boolean).join(" ")}
        style={flowCanvasStyle}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleFlowDrop}
        onPointerDownCapture={handleFlowCanvasPointerDownCapture}
        onMouseDownCapture={handleFlowCanvasMouseDownCapture}
        onPointerDown={handleFlowCanvasPointerDown}
        onContextMenu={handleFlowCanvasContextMenu}
        onDoubleClick={handleFlowCanvasDoubleClick}
        onAuxClick={(event) => {
          if (event.button === 1) {
            event.preventDefault();
          }
        }}
        onWheel={handleFlowWheel}
      >
        <div
          className="flowCanvasWorld"
          style={{ transform: `translate(${flowPan.x}px, ${flowPan.y}px) scale(${flowScale})` } as CSSProperties}
        >
          <svg className="flowConnectionLayer" aria-label="Flow node connections">
            {flowConnections.map((connection) => {
              const node = nodeMap.get(connection.fromNodeId);
              const nextNode = nodeMap.get(connection.toNodeId);
              if (!node || !nextNode) {
                return null;
              }

              const outputPort = node.outputs.find((port) => port.id === connection.fromPortId);
              const inputPort = nextNode.inputs.find((port) => port.id === connection.toPortId);
              const connectionColor = flowConnectionColor(node, outputPort);
              const start = getFlowPortCenter(node, "output", connection.fromPortId);
              const end = getFlowPortCenter(nextNode, "input", connection.toPortId);
              const startX = start.x;
              const startY = start.y;
              const endX = end.x;
              const endY = end.y;
              const curve = Math.max(80, Math.abs(endX - startX) * 0.5);
              const isWarning = !isFlowTypeCompatible(outputPort, inputPort);

              return (
                <path
                  className={[
                    isWarning ? "warningConnectionPath" : "",
                    highlightedConnectionIds.includes(connection.id) ? "issueConnectionPath" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  d={`M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`}
                  key={connection.id}
                  onClick={() => removeFlowConnection(connection.id)}
                  style={{ stroke: connectionColor } as CSSProperties}
                />
              );
            })}
            {connectionDrag ? (() => {
              const node = nodeMap.get(connectionDrag.fromNodeId);
              if (!node) {
                return null;
              }

              const start = getFlowPortCenter(node, "output", connectionDrag.fromPortId);
              const outputPort = node.outputs.find((port) => port.id === connectionDrag.fromPortId);
              const connectionColor = flowConnectionColor(node, outputPort);
              const startX = start.x;
              const startY = start.y;
              const endX = connectionDrag.x;
              const endY = connectionDrag.y;
              const curve = Math.max(80, Math.abs(endX - startX) * 0.5);

              return (
                <path
                  className="pendingConnectionPath"
                  d={`M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`}
                  style={{ stroke: connectionColor } as CSSProperties}
                />
              );
            })() : null}
          </svg>
          {smartGuides.length > 0 ? (
            <div className="flowSmartGuideLayer" aria-hidden="true">
              {smartGuides.map((guide, index) => (
                <Fragment key={`${guide.axis}-${guide.type}-${guide.position}-${index}`}>
                  <span
                    className={[
                      "flowSmartGuide",
                      guide.axis === "x" ? "vertical" : "horizontal",
                      guide.type
                    ].join(" ")}
                    style={
                      guide.axis === "x"
                        ? {
                            left: guide.position,
                            top: guide.start,
                            height: Math.max(1, guide.end - guide.start)
                          }
                        : {
                            left: guide.start,
                            top: guide.position,
                            width: Math.max(1, guide.end - guide.start)
                          }
                    }
                  />
                  {guide.label ? (
                    <span
                      className="flowSmartGuideLabel"
                      style={{
                        left: guide.labelX ?? guide.position,
                        top: guide.labelY ?? guide.start
                      } as CSSProperties}
                    >
                      {guide.label}
                    </span>
                  ) : null}
                </Fragment>
              ))}
            </div>
          ) : null}
          {renderedFlowGroups.map(({ group, bounds }) => (
            <div
              className={[
                "flowGroupBox",
                draggingGroup?.groupId === group.id ? "dragging" : "",
                activeGroupDropId === group.id ? "dropTarget" : "",
                selectedGroupIds.includes(group.id) ? "selected" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              key={group.id}
              onPointerDown={(event) => startGroupDrag(event, group)}
              style={{
                left: bounds.left,
                top: bounds.top,
                width: bounds.right - bounds.left,
                height: bounds.bottom - bounds.top,
                "--flow-group-color": group.color,
                "--flow-group-bg": `${group.color}38`
              } as CSSProperties}
            >
              <div className="flowGroupHeader">
                <input
                  className="flowGroupNameInput"
                  value={group.name}
                  onChange={(event) => updateFlowGroupName(group.id, event.target.value)}
                  onPointerDown={(event) => {
                    if (event.button === 0) {
                      event.stopPropagation();
                    }
                  }}
                  aria-label="그룹 이름"
                />
                <button
                  className="flowGroupSaveButton"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    saveFlowGroupAsCustomTool(group.id);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  title="이 그룹을 커스텀 플로우 툴로 저장"
                >
                  툴 저장
                </button>
                <div
                  className="flowGroupColorMenu"
                  onPointerDown={(event) => {
                    if (event.button === 0) {
                      event.stopPropagation();
                    }
                  }}
                >
                  <button
                    className="flowGroupColorCurrent"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedGroupColorId((current) => (current === group.id ? "" : group.id));
                    }}
                    style={{ "--group-choice-color": group.color } as CSSProperties}
                    aria-label="그룹 색상 변경"
                  />
                  {expandedGroupColorId === group.id ? (
                    <div className="flowGroupColorChoices">
                      {flowGroupColorOptions.map((color) => (
                        <button
                          className={color === group.color ? "selected" : ""}
                          key={color}
                          type="button"
                          onClick={() => updateFlowGroupColor(group.id, color)}
                          style={{ "--group-choice-color": color } as CSSProperties}
                          aria-label={`그룹 색상 ${color}`}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {flowNotes.map((note) => (
            <div
              className={["flowNote", selectedNoteIds.includes(note.id) ? "selected" : ""]
                .filter(Boolean)
                .join(" ")}
              key={note.id}
              style={{
                left: note.x,
                top: note.y,
                width: note.width ?? 220,
                height: note.height ?? 140,
                "--flow-note-color": note.color ?? flowNoteColorOptions[0]
              } as CSSProperties}
              onPointerDown={(event) => {
                const target = event.target instanceof Element ? event.target : null;
                if (event.button === 1) {
                  return;
                }
                if (event.shiftKey && !target?.closest(".flowNoteColorMenu")) {
                  startSelectionBoxFromPointer(event);
                  return;
                }
                if (event.button !== 0) {
                  return;
                }

                if (!target?.closest("textarea") && !target?.closest("input")) {
                  blurActiveFlowInput();
                }
                setSelectedNodeId("");
                setSelectedNodeIds([]);
                setSelectedGroupIds([]);
                setSelectedNoteIds([note.id]);
                setFlowNoteMenu(null);
                if (target?.closest(".flowNoteColorMenu")) {
                  event.stopPropagation();
                  return;
                }
                if (target?.closest("textarea") || target?.closest("input")) {
                  event.stopPropagation();
                  return;
                }

                event.preventDefault();
                event.stopPropagation();
              }}
              onContextMenu={(event) => openFlowNoteMenu(event, note.id)}
              onPointerUp={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                updateFlowNoteSize(note.id, rect.width / flowScale, rect.height / flowScale);
              }}
              tabIndex={0}
            >
              <div className="flowNoteHeaderRow" onPointerDown={(event) => event.stopPropagation()}>
                <button
                  className="flowNoteDragHandle"
                  type="button"
                  onPointerDown={(event) => startFlowNoteDrag(event, note)}
                  aria-label="메모 이동"
                >
                  ⋮⋮
                </button>
                <input
                  className="flowNoteTitleInput"
                  value={note.title ?? "메모"}
                  onChange={(event) => updateFlowNoteTitle(note.id, event.target.value)}
                  onContextMenu={(event) => openFlowNoteMenu(event, note.id)}
                  onFocus={() => {
                    setSelectedNodeId("");
                    setSelectedNodeIds([]);
                    setSelectedGroupIds([]);
                    setSelectedNoteIds([note.id]);
                  }}
                  aria-label="메모 제목"
                />
              </div>
              <div
                className="flowNoteColorMenu"
                onPointerDown={(event) => {
                  if (event.button === 0) {
                    event.stopPropagation();
                  }
                }}
              >
                <button
                  className="flowNoteColorCurrent"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setExpandedNoteColorId((current) => (current === note.id ? "" : note.id));
                  }}
                  style={{ "--note-choice-color": note.color ?? flowNoteColorOptions[0] } as CSSProperties}
                  aria-label="메모 색상 변경"
                />
                {expandedNoteColorId === note.id ? (
                  <div className="flowNoteColorChoices">
                    {flowNoteColorOptions.map((color) => (
                      <button
                        className={color === (note.color ?? flowNoteColorOptions[0]) ? "selected" : ""}
                        key={color}
                        type="button"
                        onClick={() => updateFlowNoteColor(note.id, color)}
                        style={{ "--note-choice-color": color } as CSSProperties}
                        aria-label={`메모 색상 ${color}`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              <textarea
                className="flowNoteTextArea"
                value={note.text}
                onChange={(event) => updateFlowNoteText(note.id, event.target.value)}
                onContextMenu={(event) => openFlowNoteMenu(event, note.id)}
                onPointerDown={(event) => {
                  if (event.button === 0) {
                    event.stopPropagation();
                    setSelectedNodeId("");
                    setSelectedNodeIds([]);
                    setSelectedGroupIds([]);
                    setSelectedNoteIds([note.id]);
                  }
                }}
                aria-label="메모"
              />
            </div>
          ))}
          {flowNodes.map((node) => {
              const isExpanded = expandedNodeIds.includes(node.nodeId);
              const activeDetailTab = flowNodeDetailTabs[node.nodeId] ?? "content";
              const nodePalette = isBasicFlowNode(node)
                ? flowBasicNodePalette
                : flowPaletteForType(flowTypeForNode(node));
              const hasInputPorts = node.inputs.length > 0;
              const hasOutputPorts = node.outputs.length > 0;
              const outputOnlyValue =
                !hasInputPorts && hasOutputPorts && node.id === "basic-active-file"
                  ? (node.activeFileSelections ?? []).length > 0
                    ? (node.activeFileSelections ?? []).map((file) => file.label).join(", ")
                    : "인식된 파일 없음"
                  : !hasInputPorts && hasOutputPorts && node.id === "basic-path-select"
                    ? node.pathSelection?.name ?? "선택된 파일 없음"
                    : "";
              const validationTone = flowValidationNodeToneById.get(node.nodeId);
              const validationIssuesForNode = flowValidationNodeIssuesById.get(node.nodeId) ?? [];
              const validationIssueTooltip = validationIssuesForNode
                .map((issue) => {
                  const label = issue.severity === "error" ? "오류" : "경고";
                  return `${label}: ${issue.title}\n${issue.message}`;
                })
                .join("\n\n");
              const displayIconName = flowNodeDisplayIconName(node);
              const incomingPortIds = new Set(
                flowConnections
                  .filter((connection) => connection.toNodeId === node.nodeId)
                  .map((connection) => connection.toPortId)
              );
              const outgoingPortIds = new Set(
                flowConnections
                  .filter((connection) => connection.fromNodeId === node.nodeId)
                  .map((connection) => connection.fromPortId)
              );
              return (
                <div
                  className={[
                    "flowNode",
                    isExpanded ? "expanded" : "",
                    selectedNodeIds.includes(node.nodeId) ? "selected" : "",
                    draggingNode?.nodeIds.includes(node.nodeId) ? "dragging" : "",
                    runningNodeIds.includes(node.nodeId) ? "running" : "",
                    validationTone === "error" ? "issueError" : "",
                    validationTone === "warning" ? "issueWarning" : "",
                    highlightedNodeIds.includes(node.nodeId) ? "issueHighlighted" : "",
                    activePromptAttachTargetId === node.nodeId ? "promptAttachTarget" : "",
                    node.attachedToNodeId ? "attachedPrompt" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={node.nodeId}
                  onPointerDown={(event) => handleFlowNodePointerDown(event, node.nodeId)}
                  onContextMenu={(event) => openFlowNodeMenu(event, node.nodeId)}
                  style={{
                    left: node.x,
                    top: node.y,
                    zIndex: isExpanded ? 5 : 4,
                    "--flow-node-bg": nodePalette.surface,
                    "--flow-node-border": nodePalette.border
                  } as CSSProperties}
                >
                  <div
                    className="flowNodeHeader"
                    onPointerDown={(event) => startNodeDrag(event, node.nodeId)}
                  >
                    <AppIcon className="flowNodeProgramIcon" name={displayIconName} />
                    <span className="flowNodeTitleBlock">
                      <strong>{node.name}</strong>
                      <small>{node.description}</small>
                    </span>
                    {validationTone ? (
                      <span
                        className="flowNodeIssueHover"
                        tabIndex={0}
                        aria-label={
                          validationIssueTooltip ||
                          (validationTone === "error" ? "오류가 있는 노드" : "경고가 있는 노드")
                        }
                      >
                        <span className={`flowNodeIssueBadge ${validationTone}`}>
                          {validationTone === "error" ? "×" : "!"}
                        </span>
                        <span className="flowNodeIssueTooltip" role="tooltip">
                          {validationIssueTooltip ||
                            (validationTone === "error" ? "오류가 있는 노드" : "경고가 있는 노드")}
                        </span>
                      </span>
                    ) : null}
                    <button
                      className="flowNodeChevron"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedNodeId(node.nodeId);
                        setSelectedGroupIds([]);
                        setSelectedNoteIds([]);
                        setExpandedNodeIds((ids) =>
                          ids.includes(node.nodeId)
                            ? ids.filter((id) => id !== node.nodeId)
                            : [...ids, node.nodeId]
                        );
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      aria-label={`${node.name} ${isExpanded ? "접기" : "펼치기"}`}
                    >
                      {isExpanded ? "▴" : "▾"}
                    </button>
                  </div>
                  <div className={["flowNodeBody", isExpanded ? "expanded" : "compact"].join(" ")}>
                    {hasInputPorts || hasOutputPorts ? (
                    <div
                      className={[
                        "flowPortColumns",
                        outputOnlyValue ? "hasOutputValue" : "",
                        !hasInputPorts && hasOutputPorts ? "outputOnly" : "",
                        hasInputPorts && !hasOutputPorts ? "inputOnly" : "",
                        !hasInputPorts || !hasOutputPorts ? "singleColumn" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {hasInputPorts ? (
                      <div
                        className={[
                          "flowPorts",
                          "left",
                          activePortDropTarget?.nodeId === node.nodeId &&
                          activePortDropTarget.direction === "input"
                            ? "portDropTarget"
                            : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onDragOver={(event) => {
                          if (!draggingBasicPortTool) {
                            return;
                          }
                          if (!canDropBasicPortTool(draggingBasicPortTool, "input")) {
                            return;
                          }
                          event.preventDefault();
                          event.stopPropagation();
                          setActivePortDropTarget({ nodeId: node.nodeId, direction: "input" });
                        }}
                        onDragLeave={() =>
                          setActivePortDropTarget((current) =>
                            current?.nodeId === node.nodeId && current.direction === "input"
                              ? null
                              : current
                          )
                        }
                        onDrop={(event) => handleFlowPortToolDrop(event, node.nodeId, "input")}
                      >
                        <strong>Input</strong>
                        {node.inputs.map((port) => (
                          (() => {
                            const portPalette = flowPaletteForType(port.type);
                            const isPendingInputTarget =
                              Boolean(pendingConnection) && pendingConnection?.nodeId !== node.nodeId;
                            const isCompatibleInputTarget =
                              isPendingInputTarget && isFlowTypeCompatible(pendingOutputPort, port);
                            return (
                          <div
                            className={[
                              "flowPortRow",
                              "inputPortRow",
                              incomingPortIds.has(port.id) ? "connected" : "",
                              isPendingInputTarget
                                ? isCompatibleInputTarget
                                  ? "compatibleTarget"
                                  : "incompatibleTarget"
                                : "",
                              port.custom ? "customPort" : ""
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={port.id}
                            data-flow-input-node={node.nodeId}
                            data-flow-input-port={port.id}
                            draggable={Boolean(port.custom)}
                            onDragStart={(event) =>
                              port.custom
                                ? handleCustomPortDragStart(event, node.nodeId, "input", port.id)
                                : undefined
                            }
                            onClick={(event) => handleInputPortClick(event, node.nodeId, port.id)}
                            title={`입력 포트: ${port.label}`}
                            aria-label={`${node.name} ${port.label} 입력 포트`}
                            style={{
                              "--flow-port-color": portPalette.accent,
                              "--flow-port-ring": portPalette.border
                            } as CSSProperties}
                          >
                            <span
                              className="flowPortConnector"
                              data-flow-port-center={flowPortCenterKey(node.nodeId, "input", port.id)}
                              aria-hidden="true"
                            />
                            <span>{port.label}</span>
                            {port.custom ? (
                              <button
                                className="flowPortDeleteButton"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeCustomFlowPort(node.nodeId, "input", port.id);
                                }}
                                onPointerDown={(event) => event.stopPropagation()}
                                aria-label={`${port.label} 입력 포트 삭제`}
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                            );
                          })()
                        ))}
                      </div>
                      ) : null}
                      {outputOnlyValue ? (
                        <div className="flowOutputValue" title={outputOnlyValue}>
                          {outputOnlyValue}
                        </div>
                      ) : null}
                      {hasOutputPorts ? (
                      <div
                        className={[
                          "flowPorts",
                          "right",
                          activePortDropTarget?.nodeId === node.nodeId &&
                          activePortDropTarget.direction === "output"
                            ? "portDropTarget"
                            : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onDragOver={(event) => {
                          if (!draggingBasicPortTool) {
                            return;
                          }
                          if (!canDropBasicPortTool(draggingBasicPortTool, "output")) {
                            return;
                          }
                          event.preventDefault();
                          event.stopPropagation();
                          setActivePortDropTarget({ nodeId: node.nodeId, direction: "output" });
                        }}
                        onDragLeave={() =>
                          setActivePortDropTarget((current) =>
                            current?.nodeId === node.nodeId && current.direction === "output"
                              ? null
                              : current
                          )
                        }
                        onDrop={(event) => handleFlowPortToolDrop(event, node.nodeId, "output")}
                      >
                        <strong>Output</strong>
                        {node.outputs.map((port) => (
                          (() => {
                            const portPalette = flowPaletteForType(port.type);
                            return (
                          <div
                            className={[
                              "flowPortRow",
                              "outputPortRow",
                              outgoingPortIds.has(port.id) ? "connected" : "",
                              port.custom ? "customPort" : "",
                              pendingConnection?.nodeId === node.nodeId &&
                              pendingConnection.portId === port.id
                                ? "pending"
                                : ""
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={port.id}
                            data-flow-output-node={node.nodeId}
                            data-flow-output-port={port.id}
                            draggable={Boolean(port.custom)}
                            onDragStart={(event) =>
                              port.custom
                                ? handleCustomPortDragStart(event, node.nodeId, "output", port.id)
                                : undefined
                            }
                            onPointerDown={(event) => startConnectionDrag(event, node.nodeId, port.id)}
                            title={`출력 포트: ${port.label}`}
                            aria-label={`${node.name} ${port.label} 출력 포트`}
                            style={{
                              "--flow-port-color": portPalette.accent,
                              "--flow-port-ring": portPalette.border
                            } as CSSProperties}
                          >
                            {port.custom ? (
                              <button
                                className="flowPortDeleteButton"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeCustomFlowPort(node.nodeId, "output", port.id);
                                }}
                                onPointerDown={(event) => event.stopPropagation()}
                                aria-label={`${port.label} 출력 포트 삭제`}
                              >
                                ×
                              </button>
                            ) : null}
                            <span>{port.label}</span>
                            <span
                              className="flowPortConnector"
                              data-flow-port-center={flowPortCenterKey(node.nodeId, "output", port.id)}
                              aria-hidden="true"
                            />
                          </div>
                            );
                          })()
                        ))}
                      </div>
                      ) : null}
                    </div>
                    ) : null}
                    {isExpanded ? (
                      <div className="flowNodeDetails">
                        <div className="flowNodeDetailTabs" role="tablist" aria-label={`${node.name} 상세`}>
                          <button
                            className={activeDetailTab === "content" ? "selected" : ""}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setFlowNodeDetailTabs((tabs) => ({
                                ...tabs,
                                [node.nodeId]: "content"
                              }));
                            }}
                          >
                            {node.id === "basic-active-file" ? "프로그램" : "작동 원리"}
                          </button>
                          <button
                            className={activeDetailTab === "settings" ? "selected" : ""}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setFlowNodeDetailTabs((tabs) => ({
                                ...tabs,
                                [node.nodeId]: "settings"
                              }));
                            }}
                          >
                            설정
                          </button>
                          <button
                            className={activeDetailTab === "result" ? "selected" : ""}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setFlowNodeDetailTabs((tabs) => ({
                                ...tabs,
                                [node.nodeId]: "result"
                              }));
                            }}
                          >
                            결과
                          </button>
                        </div>
                        {activeDetailTab === "settings" ? (
                          <div className="flowNodeSettingsPanel">
                            {node.settingsSchema?.settings.length ? (
                              <FlowNodeSchemaSettings
                                schema={node.settingsSchema}
                                values={node.settingsValues}
                                onChange={(field, value) =>
                                  updateFlowNodeSettingValue(node.nodeId, field, value)
                                }
                                onRuntimeValueChange={(key, value) =>
                                  updateFlowNodeRuntimeSettingValue(node.nodeId, key, value)
                                }
                                presets={listSettingPresetsForFlowNode(settingPresets, node)}
                                onSavePreset={(options) => saveFlowNodePreset(node, options)}
                                onLoadPreset={(preset) => loadFlowNodePreset(node.nodeId, preset)}
                                onDeletePreset={deleteFlowNodePreset}
                                onRenamePreset={renameFlowNodePreset}
                              />
                            ) : (
                              <>
                                <label>
                                  <span>작업 대상</span>
                                  <input
                                    value={node.settings?.target ?? ""}
                                    onChange={(event) =>
                                      updateFlowNodeSetting(node.nodeId, "target", event.target.value)
                                    }
                                    onPointerDown={(event) => event.stopPropagation()}
                                    placeholder="파일, 선택 범위, 객체 기준"
                                  />
                                </label>
                                <label>
                                  <span>실행 옵션</span>
                                  <input
                                    value={node.settings?.options ?? ""}
                                    onChange={(event) =>
                                      updateFlowNodeSetting(node.nodeId, "options", event.target.value)
                                    }
                                    onPointerDown={(event) => event.stopPropagation()}
                                    placeholder="필터, 레이어, 객체 조건 등"
                                  />
                                </label>
                                <label>
                                  <span>메모</span>
                                  <textarea
                                    value={node.settings?.memo ?? ""}
                                    onChange={(event) =>
                                      updateFlowNodeSetting(node.nodeId, "memo", event.target.value)
                                    }
                                    onPointerDown={(event) => event.stopPropagation()}
                                    placeholder="실행 전 확인할 내용을 적어둡니다."
                                  />
                                </label>
                              </>
                            )}
                          </div>
                        ) : activeDetailTab === "result" ? (
                          <FlowNodeResultPreview record={flowRunRecordByNodeId.get(node.nodeId)} />
                        ) : node.id === "basic-result-preview" ? (
                          <div className="flowNodePreview">
                            <strong>결과값</strong>
                            <p>아직 실행 결과가 없습니다. 실행 후 이 영역에 결과가 표시됩니다.</p>
                          </div>
                        ) : node.id === "basic-path-select" ? (
                          <div className="flowPathPicker">
                            <strong>선택한 경로</strong>
                            <p>{node.pathSelection?.path ?? "아직 선택한 파일이 없습니다."}</p>
                            <label className="flowFilePickButton">
                              파일 선택
                              <input
                                type="file"
                                onChange={(event) =>
                                  updateFlowNodePathSelection(
                                    node.nodeId,
                                    event.currentTarget.files?.[0] ?? null
                                  )
                                }
                                onPointerDown={(event) => event.stopPropagation()}
                              />
                            </label>
                          </div>
                        ) : node.id === "basic-active-file" ? (
                          <div className="flowActiveFilePicker">
                            <div className="flowActiveFileHeader">
                              <strong>프로그램</strong>
                              <button
                                type="button"
                                onClick={() => void refreshDetectedActiveFiles()}
                                onPointerDown={(event) => event.stopPropagation()}
                                disabled={isRefreshingActiveFiles}
                              >
                                {isRefreshingActiveFiles ? "확인 중" : "새로고침"}
                              </button>
                            </div>
                            <div className="flowActiveFileList">
                              {activeFileOptions.map((option) => {
                                const selected = (node.activeFileSelections ?? []).some(
                                  (selection) => selection.id === option.id
                                );
                                return (
                                  <label className="flowActiveFileOption" key={option.id}>
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => toggleFlowNodeActiveFile(node.nodeId, option)}
                                      onPointerDown={(event) => event.stopPropagation()}
                                    />
                                    <AppIcon name={option.program} />
                                    <span>
                                      <b>{option.label}</b>
                                      <small>{option.path}</small>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            {(node.activeFileSelections ?? []).length > 0 ? (
                              <p>
                                선택됨: {(node.activeFileSelections ?? []).map((file) => file.label).join(", ")}
                              </p>
                            ) : (
                              <p>사용할 프로그램을 선택하세요. 새로고침하면 연결된 MCP 서버에서 현재 파일명을 확인합니다.</p>
                            )}
                            {activeFileRefreshMessage ? (
                              <p className="flowActiveFileRefreshMessage">{activeFileRefreshMessage}</p>
                            ) : null}
                          </div>
                        ) : node.id === "basic-custom-prompt" ? (
                          <label className="flowPromptEditor">
                            <strong>프롬프트</strong>
                            <textarea
                              value={node.promptText ?? ""}
                              onChange={(event) =>
                                updateFlowNodePromptText(node.nodeId, event.target.value)
                              }
                              onPointerDown={(event) => event.stopPropagation()}
                              placeholder="이 노드가 붙은 대상 노드를 실행할 때 추가할 문장을 입력합니다."
                            />
                          </label>
                        ) : (
                          <>
                            <strong>작동 원리</strong>
                            <ToolRiskSummary schema={node.settingsSchema} />
                            <div className="flowNodePrincipleList">
                              {operationPrincipleStepsForTool(
                                String(node.programIcon).toUpperCase(),
                                node.name,
                                node.settingsSchema,
                                node.description
                              ).map((step) => (
                                <div key={step.title}>
                                  <span>{step.title}</span>
                                  <small>{step.description}</small>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
          })}
          {selectionRect ? (
            <div
              className="flowSelectionBox"
              style={{
                left: selectionRect.left,
                top: selectionRect.top,
                width: selectionRect.right - selectionRect.left,
                height: selectionRect.bottom - selectionRect.top
              } as CSSProperties}
            />
          ) : null}
        </div>
        {flowNodeMenu ? (
          <div
            className="contextMenu flowNodeContextMenu"
            style={{ left: flowNodeMenu.x, top: flowNodeMenu.y } as CSSProperties}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                createFlowGroup(
                  selectedNodeIds.includes(flowNodeMenu.nodeId)
                    ? selectedNodeIds
                    : [flowNodeMenu.nodeId]
                );
                setFlowNodeMenu(null);
              }}
            >
              <span>그룹 만들기</span>
              <kbd>Ctrl+G</kbd>
            </button>
            {flowNodeMenuHasGroup ? (
              <button
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeFlowNodesFromGroups(
                    flowNodeMenuGroupedNodeIds.length > 0
                      ? flowNodeMenuGroupedNodeIds
                      : flowNodeMenu
                        ? [flowNodeMenu.nodeId]
                        : []
                  );
                }}
              >
                <span>그룹에서 제거</span>
                <kbd>Ctrl+G 해제</kbd>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const node = flowNodes.find((item) => item.nodeId === flowNodeMenu.nodeId);
                if (node) {
                  pasteFlowNode(node);
                }
                setFlowNodeMenu(null);
              }}
            >
              <span>복제</span>
              <kbd>Ctrl+C / V</kbd>
            </button>
            <button
              className="danger"
              type="button"
              onClick={() => deleteFlowNode(flowNodeMenu.nodeId)}
            >
              <span>삭제</span>
              <kbd>Del</kbd>
            </button>
          </div>
        ) : null}
        {flowCanvasMenu ? (
          <div
            className="contextMenu flowNodeContextMenu"
            style={{ left: flowCanvasMenu.x, top: flowCanvasMenu.y } as CSSProperties}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => createFlowNote({ x: flowCanvasMenu.worldX, y: flowCanvasMenu.worldY })}
            >
              <span>메모 만들기</span>
              <kbd>Double Click</kbd>
            </button>
          </div>
        ) : null}
        {flowNoteMenu ? (
          <div
            className="contextMenu flowNodeContextMenu flowNoteContextMenu"
            style={{ left: flowNoteMenu.x, top: flowNoteMenu.y } as CSSProperties}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={() => duplicateFlowNote(flowNoteMenu.noteId)}>
              <span>복제</span>
              <kbd>Ctrl+C / V</kbd>
            </button>
            <button
              className="danger"
              type="button"
              onClick={() => deleteFlowNote(flowNoteMenu.noteId)}
            >
              <span>삭제</span>
              <kbd>Del</kbd>
            </button>
          </div>
        ) : null}
        <div
          className={["flowCanvasToolbar", isFlowToolbarActive ? "menuOpen" : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            className="flowToolbarIconButton"
            type="button"
            aria-label="저장"
            title="저장"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              saveCurrentFlowToLibrary();
            }}
          >
            <AppIcon name="save" />
          </button>
          <div className="flowToolbarSplit flowSearchSplit">
            <button
              className="flowSearchButton flowToolbarIconButton"
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsFlowSearchOpen((current) => !current);
                setIsBasicToolsOpen(false);
                setIsHistoryMenuOpen(false);
                setIsFlowRunMenuOpen(false);
              }}
              aria-label="노드 검색"
              title="노드 검색 Ctrl+F"
            >
              <AppIcon name="search" />
            </button>
            {isFlowSearchOpen ? (
              <div className="flowToolbarMenu flowSearchMenu">
                <label className="flowSearchField">
                  <span>노드 검색</span>
                  <input
                    autoFocus
                    value={flowSearchQuery}
                    onChange={(event) => setFlowSearchQuery(event.target.value)}
                    placeholder="노드명, 설명, 포트 검색"
                  />
                </label>
                <div className="flowSearchResults">
                  {flowSearchResults.length > 0 ? (
                    flowSearchResults.map((node) => (
                      <button key={node.nodeId} type="button" onClick={() => focusFlowNode(node.nodeId)}>
                        <AppIcon
                          className="flowSearchResultIcon"
                          name={flowNodeDisplayIconName(node)}
                        />
                        <span>{node.name}</span>
                        <small>{node.description}</small>
                      </button>
                    ))
                  ) : (
                    <p className="flowToolbarMenuEmpty">검색 결과가 없습니다.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <div className="flowToolbarSplit flowBasicToolsSplit">
            <button
              className="flowBasicToolsButton"
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsBasicToolsOpen((current) => !current);
                setIsFlowSearchOpen(false);
                setIsHistoryMenuOpen(false);
                setIsFlowRunMenuOpen(false);
              }}
              aria-label="기본도구"
              title="기본도구"
            >
              도구
            </button>
            {isBasicToolsOpen ? (
              <div
                className="flowToolbarMenu basicToolsMenu"
                onWheel={(event) => event.stopPropagation()}
              >
                <div className="basicToolsTabs">
                  <button
                    className={basicToolsTab === "tools" ? "selected" : ""}
                    type="button"
                    onClick={() => setBasicToolsTab("tools")}
                  >
                    툴
                  </button>
                  <button
                    className={basicToolsTab === "ports" ? "selected" : ""}
                    type="button"
                    onClick={() => setBasicToolsTab("ports")}
                  >
                    연결값 도구
                  </button>
                </div>
                {basicToolsTab === "tools" ? (
                  <div className="basicToolsList">
                    {flowBasicTools.map((tool) => (
                      <button
                        className="basicNodeToolButton"
                        draggable
                        key={tool.id}
                        type="button"
                        onDragStart={(event) => handleBasicToolDragStart(event, tool)}
                        onClick={() => addFlowNode(tool)}
                      >
                        <AppIcon className="basicToolsIcon" name={tool.programIcon} />
                        <span>{tool.name}</span>
                        <small>{tool.description}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                  <div
                    className={`basicPortFilterPanel ${isBasicPortFilterOpen ? "open" : ""}`}
                    aria-label="연결값 도구 필터"
                  >
                    <button
                      className="basicPortFilterToggle"
                      type="button"
                      onClick={() => setIsBasicPortFilterOpen((current) => !current)}
                      aria-expanded={isBasicPortFilterOpen}
                    >
                      <span>필터</span>
                      <strong>{basicPortFilterLabel}</strong>
                      <span className="basicPortFilterChevron">⌄</span>
                    </button>
                    {isBasicPortFilterOpen ? (
                      <div className="basicPortFilterBar">
                        {flowBasicPortFilters.map((filter) => (
                      <button
                        className={basicPortFilter === filter.id ? "selected" : ""}
                        key={filter.id}
                        type="button"
                        onClick={() => setBasicPortFilter(filter.id)}
                      >
                        {filter.label}
                      </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="basicToolsList">
                    {filteredBasicPortTools.map((tool) => {
                      const palette = flowPaletteForType(tool.type);
                      return (
                        <button
                          className="basicPortToolButton"
                          draggable
                          key={tool.id}
                          type="button"
                          onDragStart={(event) => handleBasicPortToolDragStart(event, tool)}
                          onDragEnd={() => {
                            setDraggingBasicPortTool(null);
                            setActivePortDropTarget(null);
                          }}
                          style={{
                            "--basic-tool-color": palette.accent,
                            "--basic-tool-bg": palette.surface
                          } as CSSProperties}
                        >
                          <span className="basicToolTitle">{tool.label}</span>
                          <span className="basicToolProgramTag">{tool.programScope}</span>
                          <span
                            className={`basicToolScopeTag ${flowPortToolScopeClass(tool.direction)}`}
                          >
                            {flowPortToolScopeLabel(tool.direction)}
                          </span>
                          <small>{tool.description}</small>
                        </button>
                      );
                    })}
                  </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
          <div className="flowToolbarSplit">
            <button
              type="button"
              onClick={restorePreviousFlowState}
              disabled={flowHistory.length === 0}
              aria-label="뒤로가기"
              title="뒤로가기"
            >
              ↶
            </button>
            <button
              className="flowToolbarArrow"
              type="button"
              onClick={() => setIsHistoryMenuOpen((current) => !current)}
              disabled={flowHistory.length === 0}
              aria-label="되돌릴 위치 선택"
              title="되돌릴 위치 선택"
            >
              ▾
            </button>
            {isHistoryMenuOpen ? (
              <div className="flowToolbarMenu historyMenu">
                {flowHistory.length > 0 ? (
                  flowHistory
                    .map((snapshot, index) => ({ snapshot, index }))
                    .slice(-8)
                    .reverse()
                    .map(({ snapshot, index }) => (
                      <button key={`history-${index}`} type="button" onClick={() => restoreHistoryAt(index)}>
                        <span>{snapshot.nodes[0]?.name ?? "빈 흐름"}</span>
                        <small>노드 {snapshot.nodes.length} / 연결 {snapshot.connections.length}</small>
                      </button>
                    ))
                ) : (
                  <span className="flowToolbarMenuEmpty">되돌릴 기록이 없습니다.</span>
                )}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={restoreNextFlowState}
            disabled={flowFuture.length === 0}
            aria-label="앞으로가기"
            title="앞으로가기"
          >
            ↷
          </button>
          <div className="flowToolbarSplit">
            <button
              className="flowRunButton"
              type="button"
              onClick={runFlow}
              disabled={flowNodes.length === 0}
              aria-label="실행"
              title={flowRunMode === "step" ? "단계별 실행" : "일괄 실행"}
            >
              ▶
            </button>
            <button
              className="flowToolbarArrow"
              type="button"
              onClick={() => setIsFlowRunMenuOpen((current) => !current)}
              aria-label="실행 설정"
              title="실행 설정"
            >
              ▾
            </button>
            {isFlowRunMenuOpen ? (
              <div className="flowToolbarMenu runMenu">
                <span className="flowRunMenuLabel">실행 방식</span>
                <button
                  className={flowRunMode === "batch" ? "selected" : ""}
                  type="button"
                  onClick={() => {
                    setFlowRunMode("batch");
                  }}
                >
                  <span>일괄 실행</span>
                  <small>전체 흐름을 한 번에 실행</small>
                </button>
                <button
                  className={flowRunMode === "step" ? "selected" : ""}
                  type="button"
                  onClick={() => {
                    setFlowRunMode("step");
                  }}
                >
                  <span>단계별 실행</span>
                  <small>선택 노드부터 한 단계씩 실행</small>
                </button>
                <span className="flowRunMenuLabel">실행 범위</span>
                {(["all", "selected", "to-selected", "from-selected"] as FlowRunScope[]).map(
                  (scope) => (
                    <button
                      className={flowRunScope === scope ? "selected" : ""}
                      type="button"
                      key={scope}
                      onClick={() => setFlowRunScope(scope)}
                    >
                      <span>{flowRunScopeLabels[scope]}</span>
                      <small>
                        {scope === "all"
                          ? "모든 노드를 실행합니다."
                          : scope === "selected"
                            ? "현재 선택한 노드만 실행합니다."
                            : scope === "to-selected"
                              ? "처음부터 선택 노드까지 실행합니다."
                              : "선택 노드부터 마지막까지 실행합니다."}
                      </small>
                    </button>
                  )
                )}
              </div>
            ) : null}
          </div>
        </div>
        {flowRunRecords.length > 0 ? (
          <aside
            className="flowRunTimelinePanel"
            aria-label="Custom Flow 실행 로그"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <span>
                실행 로그
                <small>
                  {flowRunMode === "step" ? "단계별" : "일괄"} · {flowRunScopeLabels[flowRunScope]}
                </small>
              </span>
              <strong>
                {flowRunCompletedCount}/{flowRunRecords.length}
              </strong>
            </header>
            {flowRunImpactItems.length > 0 ? (
              <div className="flowRunImpactSummary">
                <strong>실행 전 영향 범위</strong>
                <ul>
                  {flowRunImpactItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flowRunTimelineList">
              {flowRunRecords.map((record, index) => (
                <button
                  className={`flowRunTimelineItem ${record.status}`}
                  type="button"
                  key={record.id}
                  onClick={() => {
                    focusFlowNode(record.nodeId);
                    setFlowNodeDetailTabs((tabs) => ({
                      ...tabs,
                      [record.nodeId]: "result"
                    }));
                  }}
                >
                  <span className="flowRunStepNumber">{index + 1}</span>
                  <span>
                    <strong>{record.nodeName}</strong>
                    <small>{record.message}</small>
                  </span>
                  <em>{flowRunStatusLabels[record.status]}</em>
                </button>
              ))}
            </div>
          </aside>
        ) : null}
        <aside
          className={[
            "flowValidationPanel",
            flowValidationTone,
            isFlowValidationPinned ? "pinned" : ""
          ].join(" ")}
          aria-label="Custom Flow 흐름 점검"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            className="flowValidationToggle"
            type="button"
            onClick={() => setIsFlowValidationPinned((current) => !current)}
            aria-label="흐름 점검 보기"
          >
            {flowValidationIssueCount > 0 ? (
              <span className="flowValidationBadge">{flowValidationIssueCount}</span>
            ) : null}
            <span className="flowValidationIcon">
              {flowValidationTone === "ready" ? "✓" : flowValidationTone === "warning" ? "!" : "×"}
            </span>
          </button>
          <div className="flowValidationPopover">
            <div className="flowValidationHeader">
              <strong>흐름 점검</strong>
              <span>
                오류 {flowValidationErrorCount} / 경고 {flowValidationWarningCount}
              </span>
            </div>
            <div className="flowValidationList">
              {flowVisibleIssues.length > 0 ? (
                flowVisibleIssues.map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    className={`flowValidationItem ${issue.severity}`}
                    onClick={() => focusFlowIssue(issue)}
                  >
                    <strong>{issue.title}</strong>
                    <span>{issue.message}</span>
                  </button>
                ))
              ) : (
                <p className="flowValidationReady">흐름 점검을 통과했습니다.</p>
              )}
            </div>
          </div>
        </aside>
        {isLeaveFlowConfirmOpen ? (
          <div
            className="flowConfirmBackdrop"
            role="presentation"
            onMouseDown={() => setIsLeaveFlowConfirmOpen(false)}
          >
            <section
              className="flowConfirmDialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="leaveFlowDialogTitle"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <strong id="leaveFlowDialogTitle">저장되지 않은 변경</strong>
              <p>현재 Custom Flow에 저장되지 않은 변경이 있습니다. 저장하지 않고 나갈까요?</p>
              <div className="flowConfirmActions">
                <button type="button" onClick={() => setIsLeaveFlowConfirmOpen(false)}>
                  취소
                </button>
                <button type="button" onClick={saveCurrentFlowToLibrary}>
                  저장
                </button>
                <button className="danger" type="button" onClick={leaveWorkflowEditor}>
                  저장하지 않고 나가기
                </button>
              </div>
            </section>
          </div>
        ) : null}
        {pendingFlowSettingChange ? (
          <div
            className="flowConfirmBackdrop"
            role="presentation"
            onMouseDown={() => setPendingFlowSettingChange(null)}
          >
            <section
              className="flowConfirmDialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="flowSettingConfirmTitle"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <strong id="flowSettingConfirmTitle">설정 변경 확인</strong>
              <p>
                {pendingFlowSettingChange.field.label} 설정은 실행 결과나 원본 데이터에 영향을 줄 수 있습니다.
                변경할까요?
              </p>
              <div className="flowConfirmActions">
                <button type="button" onClick={() => setPendingFlowSettingChange(null)}>
                  취소
                </button>
                <button
                  className="danger"
                  type="button"
                  onClick={() => {
                    commitFlowNodeSettingValue(
                      pendingFlowSettingChange.nodeId,
                      pendingFlowSettingChange.field,
                      pendingFlowSettingChange.value
                    );
                    setPendingFlowSettingChange(null);
                  }}
                >
                  변경
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function IntegrationView({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="sectionView">
      <div className="panel integrationPanel">
        <div className="panelHeader">
          <h2>{title}</h2>
        </div>
        <div className="toolList">
          {items.map((item) => (
            <div className="toolItem" key={item}>
              <strong>{item}</strong>
              <span>이 기능은 이후 MCP 연결 단계에서 실제 명령과 연결합니다.</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function topbarTitle(tabId: WorkspaceTabId, sectionId: SidebarSectionId) {
  if (sectionId === "workflow") {
    return "Custom Flow";
  }

  if (sectionId === "monitor") {
    return "Process Monitor";
  }

  if (sectionId === "revit") {
    return "Revit MCP 서버";
  }

  if (sectionId === "excel") {
    return "Excel MCP 도구";
  }

  if (sectionId === "tekla") {
    return "Tekla MCP 도구";
  }

  const titles: Record<WorkspaceTabId, string> = {
    registry: "MCP 서버 연결 관리",
    cad: "CAD MCP 서버",
    revit: "Revit MCP 서버",
    workflow: "Custom Flow",
    excel: "Excel MCP 도구",
    tekla: "Tekla MCP 도구"
  };
  return titles[tabId];
}

function topbarSubtitle(tabId: WorkspaceTabId, sectionId: SidebarSectionId) {
  if (sectionId === "home") {
    return "공지사항, 신규 커스텀 툴, Other Tools를 한곳에서 확인합니다.";
  }

  if (sectionId === "revit") {
    return "Revit에서 모델 작업을 실행하는 MCP 연결을 관리합니다.";
  }

  if (sectionId === "workflow") {
    return "MCP 툴을 노드처럼 연결해 원하는 자동화 흐름을 구성합니다.";
  }

  if (sectionId === "monitor") {
    return "MCP 브리지 실행 상태와 작업 로그를 확인합니다.";
  }

  if (sectionId === "excel") {
    return "Excel 표와 시트 데이터를 MCP 작업 흐름에 연결할 준비 영역입니다.";
  }

  if (sectionId === "tekla") {
    return "Tekla 모델 정보를 MCP 작업 흐름과 연결할 준비 영역입니다.";
  }

  const subtitles: Record<WorkspaceTabId, string> = {
    registry: "전체 MCP 서버 등록 정보를 관리합니다.",
    cad: "CAD 작업에 사용할 MCP 툴과 작업 페이지를 정리합니다.",
    revit: "Revit 작업에 사용할 MCP 툴과 작업 페이지를 정리합니다.",
    workflow: "여러 프로그램의 MCP 툴을 연결하는 플로우를 정리합니다.",
    excel: "Excel 표와 시트 데이터를 MCP 작업 흐름에 연결합니다.",
    tekla: "Tekla 모델 정보를 MCP 작업 흐름과 연결합니다."
  };
  return subtitles[tabId];
}

function toolPanelTitle(tabId: WorkspaceTabId) {
  const titles: Record<WorkspaceTabId, string> = {
    registry: "Registry MCP 툴",
    cad: "CAD MCP 툴",
    revit: "Revit MCP 툴",
    workflow: "Custom Flow MCP 툴",
    excel: "Excel MCP 툴",
    tekla: "Tekla MCP 툴"
  };
  return titles[tabId];
}

function statusLabel(status: McpServerRecord["status"]) {
  const labels = {
    unknown: "확인 전",
    running: "실행 중",
    stopped: "중지됨",
    error: "오류"
  };
  return labels[status];
}

function targetLabel(target: McpServerRecord["target"]) {
  const labels: Record<McpServerRecord["target"], string> = {
    cad: "CAD",
    revit: "Revit",
    excel: "Excel",
    tekla: "Tekla",
    other: "Other"
  };
  return labels[target];
}
