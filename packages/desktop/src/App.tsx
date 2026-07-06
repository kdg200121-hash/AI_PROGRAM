import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, MouseEvent, PointerEvent, WheelEvent } from "react";
import { useLayoutEffect } from "react";
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
  overviewCards,
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
  serverInputFromDraft,
  validateServerDraft,
  type ServerDraft
} from "./registryEditor";
import { AppIcon, type AppIconName } from "./uiIcons";
import { isNewerVersion, shouldRequireSharedToolReview } from "./toolSharingPolicy";
import {
  cloneFlowTool,
  customFlowGraphStorageKey,
  defaultFlowConnections,
  defaultFlowNodePosition,
  defaultFlowNodes,
  flowConnectionEndpoint,
  flowNodeWidth,
  flowToolIdFromMenuItem,
  flowToolPalette,
  isFlowTypeCompatible,
  loadStoredFlowGraph,
  parseDraggedFlowTool,
  serializeFlowToolForDrag,
  type FlowConnection,
  type FlowGroup,
  type FlowNode,
  type FlowPort,
  type FlowPortType,
  type FlowSnapshot,
  type FlowTool,
  type StoredFlowGraph
} from "./customFlowModel";
import { validateFlowGraph } from "./customFlowValidation";
import {
  emptyProcessSnapshot,
  type ProcessSnapshot,
  type ServerProcessResult
} from "./processMonitor";

const pinnedTabsStorageKey = "mcp-registry:pinned-tabs";
const favoriteSectionsStorageKey = "mcp-registry:favorite-sections";
const favoriteSubmenusStorageKey = "mcp-registry:favorite-submenus";
const recentSubmenusStorageKey = "mcp-registry:recent-submenus";
const sidebarOrderStorageKey = "mcp-registry:sidebar-order";
const submenuOrderStorageKey = "mcp-registry:submenu-order";
const customSubmenusStorageKey = "mcp-registry:custom-submenus";
const submenuMetaStorageKey = "mcp-registry:submenu-meta";
const customToolsStorageKey = "mcp-registry:custom-tools";
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
  any: { accent: "#4f7fbd", border: "#bfd4ed", surface: "#f6faff", group: "#bfdbfe" }
};

const flowPaletteForType = (type?: FlowPortType | "tekla") =>
  flowTypePalette[type ?? "any"] ?? flowTypePalette.any;

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
}

interface CustomToolItem {
  id: string;
  sectionId: SidebarSectionId;
  name: string;
  description: string;
  version: string;
  author: string;
  usageCount: number;
  pinned: boolean;
  registered: boolean;
  approvalStatus: "approved" | "pending";
  isToolLike: boolean;
  riskWarnings: string[];
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
}

type CustomToolSortField = "section" | "name" | "version" | "author" | "usageCount";
type SortDirection = "desc" | "asc";
type CustomToolFormMode = "new" | "update";
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
  toolWarning: string;
  error: string;
}

interface AppNotification {
  id: string;
  title: string;
  message: string;
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

const defaultSubmenuItems: SubmenuItem[] = [
  {
    id: "tools",
    label: "Share Tools",
    description: "모든 사용자에게 기본으로 제공되는 공용 MCP 툴을 정리합니다."
  },
  {
    id: "settings",
    label: "Custom Tools",
    description: "MD 파일 기반 커스텀 툴을 가져오고 상단고정으로 관리합니다."
  },
  { id: "add", label: "+", description: "" }
];

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
    value === "add" ||
    value.startsWith("custom-") ||
    value.startsWith("share-") ||
    defaultSubmenuItems.some((item) => item.id === value)
  );
}

function parseSubmenuKey(key: SubmenuKey) {
  const [sectionId, submenuId] = key.split(":") as [SidebarSectionId, SubmenuId];
  return { sectionId, submenuId };
}

function isSidebarSectionId(value: string): value is SidebarSectionId {
  return sidebarSections.some((section) => section.id === value);
}

function makeSubmenuKey(sectionId: SidebarSectionId, submenuId: SubmenuId): SubmenuKey {
  return `${sectionId}:${submenuId}`;
}

function isValidSubmenuKey(value: string): value is SubmenuKey {
  const [sectionId, submenuId] = value.split(":");
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
        usageCount: 0,
        pinned: Boolean(tool.pinned ?? (tool as { favorite?: unknown }).favorite),
        registered: Boolean(tool.registered ?? true),
        approvalStatus: tool.approvalStatus === "pending" ? "pending" : "approved",
        isToolLike: Boolean(tool.isToolLike ?? true),
        riskWarnings: Array.isArray(tool.riskWarnings)
          ? tool.riskWarnings.map(String)
          : [],
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
                  : []
              }))
          : undefined
      }));
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

  return "cad";
}

function connectionScopeForPage(sectionId: SidebarSectionId, tabId: WorkspaceTabId) {
  if (tabId === "registry" || sectionId === "monitor" || sectionId === "home") {
    return { label: "MCP", targets: null };
  }

  if (sectionId === "workflow") {
    return { label: "MCP", targets: ["cad", "revit"] as McpTarget[] };
  }

  if (sectionId === "revit") {
    return { label: "Revit MCP", targets: ["revit"] as McpTarget[] };
  }

  if (sectionId === "servers") {
    return { label: "CAD MCP", targets: ["cad"] as McpTarget[] };
  }

  return { label: `${sidebarLabel(sectionId)} MCP`, targets: ["other"] as McpTarget[] };
}

function requiredMcpTargetsForSection(sectionId: SidebarSectionId): McpTarget[] | null {
  if (sectionId === "workflow") {
    return ["cad", "revit"];
  }

  if (sectionId === "revit") {
    return ["revit"];
  }

  if (sectionId === "servers") {
    return ["cad"];
  }

  if (sectionId === "excel" || sectionId === "tekla") {
    return ["other"];
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
  return submenuId.startsWith("custom-tool-") ? "customTools" : "shareTools";
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
  const [isCustomToolFormOpen, setIsCustomToolFormOpen] = useState(false);
  const [customToolDialogScope, setCustomToolDialogScope] = useState<SidebarSectionId | "all">(
    "servers"
  );
  const [customToolDraft, setCustomToolDraft] = useState<CustomToolDraft>(() =>
    createCustomToolDraft()
  );
  const [customToolSort, setCustomToolSort] = useState<{
    field: CustomToolSortField;
    direction: SortDirection;
  } | null>(null);
  const [activeSettingsSection, setActiveSettingsSection] =
    useState<SettingsSectionId>("servers");
  const [colorMode, setColorMode] = useState<ColorMode>("light");
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
  const [expandedCustomToolIds, setExpandedCustomToolIds] = useState<string[]>([]);
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
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);

  const activeOpenTab = openTabs.find((tab) => tab.id === activeOpenTabId) ?? openTabs[0];
  const activeTab = activeOpenTab.workspaceTabId;
  const activeSidebarSection = activeOpenTab.sectionId;

  const pushAppNotification = (notification: Omit<AppNotification, "id">) => {
    setAppNotifications((items) => [
      ...items,
      { ...notification, id: `${Date.now()}-${items.length}` }
    ]);
  };

  const dismissAppNotification = (id: string) => {
    setAppNotifications((items) => items.filter((item) => item.id !== id));
  };

  const installSaveToolSkill = async () => {
    try {
      const result = await window.skillInstaller?.installSaveTool();
      pushAppNotification({
        title: "/SAVE 스킬 설치 완료",
        message: result?.installedPath
          ? `이 컴퓨터에서 /SAVE 툴이름 명령을 사용할 수 있습니다. 설치 위치: ${result.installedPath}`
          : "이 컴퓨터에서 /SAVE 툴이름 명령을 사용할 수 있습니다."
      });
    } catch {
      pushAppNotification({
        title: "/SAVE 스킬 설치 실패",
        message: "앱에 포함된 save-tool 스킬을 찾거나 설치하지 못했습니다. 프로그램 폴더 구성을 다시 확인해주세요."
      });
    }
  };

  const installMcpToolBuilderSkill = async () => {
    try {
      const result = await window.skillInstaller?.installMcpToolBuilder();
      pushAppNotification({
        title: "MCP Tool Builder 설치 완료",
        message: result?.installedPath
          ? `이 컴퓨터에서 MCP TOOL md 파일 제작 가이드 스킬을 사용할 수 있습니다. 설치 위치: ${result.installedPath}`
          : "이 컴퓨터에서 MCP TOOL md 파일 제작 가이드 스킬을 사용할 수 있습니다."
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
    window.localStorage.setItem(accountUsersStorageKey, JSON.stringify(accountUsers));
  }, [accountUsers]);

  useEffect(() => {
    if (!storageWritesReadyRef.current) {
      return;
    }
    window.localStorage.setItem(accountPolicyStorageKey, JSON.stringify(accountPolicy));
  }, [accountPolicy]);

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
                nickname: githubUser.nickname,
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

  const isCurrentAdmin = githubUser?.githubId === githubToolSource.owner;
  const currentAccountUser = accountUsers.find((user) => user.githubId === githubUser?.githubId);
  const isLicenseAllowed =
    accountPolicy.licenseMode === "all" ||
    Boolean(currentAccountUser?.license) ||
    Boolean(isCurrentAdmin);
  const isSignupApproved = !currentAccountUser || currentAccountUser.status === "active";
  const isAccountAccessAllowed = isLicenseAllowed && isSignupApproved;

  useEffect(() => {
    notifyLicenseExpiry(currentAccountUser);
  }, [currentAccountUser?.githubId, currentAccountUser?.licenseExpiresAt, currentAccountUser?.license]);

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
          isCustomToolFormOpen ||
          isAuthDialogOpen ||
          isTabOverflowOpen
        ) {
          event.preventDefault();
          setContextMenu(null);
          setIsRegistryDialogOpen(false);
          setIsMonitorDialogOpen(false);
          setIsCustomToolDialogOpen(false);
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

      if (!registry.servers.some((server) => server.id === selectedId)) {
        setSelectedId(registry.servers[0].id);
      }
      return;
    }

    if (visibleServers.length === 0) {
      setSelectedId("");
      return;
    }

    if (!visibleServers.some((server) => server.id === selectedId)) {
      setSelectedId(visibleServers[0].id);
    }
  }, [activeSettingsSection, isRegistryDialogOpen, registry.servers, selectedId, visibleServers]);

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

    if (submenuId.startsWith("custom-tool-")) {
      const customTool = customTools.find((tool) => tool.id === submenuId);
      if (customTool) {
        return {
          id: submenuId,
          label: customTool.name,
          description: customTool.description || `${customTool.author} 쨌 v${customTool.version}`,
          ...submenuMeta[key]
        };
      }
    }

    const base =
      [...defaultSubmenuItems, ...(customSubmenus[sectionId] ?? [])].find(
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
    const availableItems = [
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
          description: tool.description || `${tool.author} 쨌 v${tool.version}`
        }))
    ];
    const availableIds = availableItems.map((item) => item.id);
    const orderedIds = [
      ...savedOrder.filter((id) => id !== "add" && availableIds.includes(id)),
      ...availableItems
        .map((item) => item.id)
        .filter((id) => id !== "add" && !savedOrder.includes(id)),
      "add" as SubmenuId
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
    if (submenuId === "add") {
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
      nickname: githubUser?.nickname ?? ""
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

  const openCustomToolDialog = (scope: SidebarSectionId | "all") => {
    setCustomToolDialogScope(scope);
    setIsCustomToolDialogOpen(true);
    void syncCustomToolsFromGitHub();
    void refreshToolReviewStates();
  };

  const openCustomToolForm = () => {
    setCustomToolDraft({
      ...createCustomToolDraft(),
      author: githubUser?.nickname ?? githubToolSource.owner
    });
    setIsCustomToolFormOpen(true);
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
      setCustomTools((items) => {
        const existingGithubItems = items.filter((item) =>
          item.installedPath?.startsWith(githubToolPathPrefix)
        );

        return [
          ...githubTools.map((tool) => {
            const sectionId = isSidebarSectionId(tool.sectionId) ? tool.sectionId : "servers";
            const existing = existingGithubItems.find((item) => item.installedPath === tool.path);

            return {
              id: existing?.id ?? `github-tool-${hashString(tool.path)}`,
              sectionId,
              name: tool.name,
              description: tool.description,
              version: tool.version,
              author: tool.author || githubToolSource.owner,
              usageCount: existing?.usageCount ?? 0,
              pinned: existing?.pinned ?? false,
              registered: existing?.registered ?? false,
              approvalStatus: existing?.approvalStatus ?? "approved",
              isToolLike: tool.isToolLike,
              riskWarnings: tool.riskWarnings,
              sourcePath: tool.path,
              installedPath: tool.path,
              reviewUrl: existing?.reviewUrl,
              versions: [
                {
                  id: tool.id,
                  version: tool.version,
                  author: tool.author || githubToolSource.owner,
                  description: tool.description,
                  sourcePath: tool.path,
                  installedPath: tool.path,
                  reviewUrl: existing?.reviewUrl,
                  isToolLike: tool.isToolLike,
                  riskWarnings: tool.riskWarnings
                }
              ]
            };
          })
        ];
      });
      setGithubToolStatus(
        githubTools.length > 0
          ? `GitHub에서 ${githubTools.length}개의 MD 툴을 가져왔습니다.`
          : "GitHub tools 폴더에 등록된 MD 툴이 없습니다."
      );
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
      const notifications: Omit<AppNotification, "id">[] = [];
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
      setCustomToolPathError("경로를 읽지 못했습니다. 폴더 권한이나 경로를 다시 확인하세요.");
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
          riskWarnings: tool.riskWarnings
        });
        groupedTools.set(groupKey, group);
      });

      return [
        ...remainingItems,
        ...[...groupedTools.values()].map((tool) => {
          const versions = [...tool.versions].sort((left, right) =>
            right.version.localeCompare(left.version, "ko", { numeric: true })
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
            isToolLike: activeVersion.isToolLike,
            riskWarnings: activeVersion.riskWarnings,
            usageCount: 0,
            pinned: existing?.pinned ?? false,
            registered: existing?.registered ?? false,
            approvalStatus: existing?.approvalStatus ?? "approved",
            sourcePath: activeVersion.sourcePath,
            installedPath: activeVersion.installedPath,
            versions
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
      filePath: selectedFile.path,
      fileName: selectedFile.name,
      preview: selectedFile.preview,
      isToolLike: selectedFile.isToolLike,
      riskWarnings: selectedFile.riskWarnings,
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
      author: tool?.author ?? draft.author,
      isToolLike: tool?.isToolLike ?? draft.isToolLike,
      riskWarnings: tool?.riskWarnings ?? draft.riskWarnings,
      toolWarning:
        tool && !tool.isToolLike
          ? "이 MD 파일은 툴 문서 형태가 아닐 수 있습니다. 그래도 등록은 가능합니다."
          : "",
      error: ""
    }));
  };

  const saveCustomToolDraft = async () => {
    const name = customToolDraft.name.trim();
    const description = customToolDraft.description.trim();
    const version = customToolDraft.version.trim();
    const author = customToolDraft.author.trim();

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
          ? error.message.includes("403")
            ? "GitHub 권한이 부족합니다. 로그아웃 후 다시 로그인해서 저장소 권한을 승인해주세요."
            : error.message
          : "GitHub 툴 등록에 실패했습니다.";
      setCustomToolDraft((draft) => ({
        ...draft,
        error: message
      }));
      return;
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
                sourcePath: customToolDraft.filePath,
                installedPath,
                reviewUrl,
                reviewNumber,
                reviewState,
                versions: item.versions
                  ? [
                      ...item.versions.filter((itemVersion) => itemVersion.version !== version),
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
                        riskWarnings: customToolDraft.riskWarnings
                      }
                    ]
                  : item.versions
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
        item.id === toolId ? { ...item, approvalStatus: "approved" } : item
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
          sourcePath: version.sourcePath,
          installedPath: version.installedPath
        };
      })
    );
  };

  const deleteCustomTool = (toolId: string) => {
    setCustomTools((items) => items.filter((item) => item.id !== toolId));
    setExpandedCustomToolIds((items) => items.filter((id) => id !== toolId));
    setOpenTabs((tabs) =>
      tabs.map((tab) => (tab.submenuKey?.endsWith(`:${toolId}`) ? { ...tab, submenuKey: null } : tab))
    );
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

  const updateServerDraft = (field: keyof ServerDraft, value: ServerDraft[keyof ServerDraft]) => {
    setServerDraft((draft) => ({ ...draft, [field]: value }));
    setRegistryError("");
  };

  const startCreatingServer = (target: McpTarget = activeTab === "revit" ? "revit" : "cad") => {
    setIsCreatingServer(true);
    setSelectedId("");
    setServerDraft(createServerDraft(target));
    setRegistryError("");
  };

  const cancelServerEdit = () => {
    setIsCreatingServer(false);
    setRegistryError("");
    if (selectedRegistryServer) {
      setSelectedId(selectedRegistryServer.id);
      setServerDraft(serverDraftFromRecord(selectedRegistryServer));
      return;
    }

    setSelectedId(registry.servers[0]?.id ?? "");
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

  const saveServer = async () => {
    const errors = validateServerDraft(serverDraft);
    if (errors.length > 0) {
      setRegistryError(errors.join(" "));
      return;
    }

    const input = serverInputFromDraft(serverDraft);
    const api = window.mcpRegistry;
    setRegistryError("");

    try {
      if (isCreatingServer) {
        if (api) {
          const next = await api.addServer(input);
          applyRegistryResult(next, next.servers.at(-1)?.id ?? "");
        } else {
          const now = new Date().toISOString();
          const server: McpServerRecord = {
            ...input,
            id: crypto.randomUUID(),
            status: "unknown",
            createdAt: now,
            updatedAt: now
          };
          applyRegistryResult({ ...registry, servers: [...registry.servers, server] }, server.id);
        }
        setIsCreatingServer(false);
        return;
      }

      if (!selectedRegistryServer) {
        return;
      }

      if (api) {
        const next = await api.updateServer(selectedRegistryServer.id, input);
        applyRegistryResult(next, selectedRegistryServer.id);
      } else {
        const now = new Date().toISOString();
        const next = {
          ...registry,
          servers: registry.servers.map((server) =>
            server.id === selectedRegistryServer.id
              ? { ...server, ...input, id: server.id, updatedAt: now }
              : server
          )
        };
        applyRegistryResult(next, selectedRegistryServer.id);
      }
    } catch (error) {
      setRegistryError(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  const deleteSelectedServer = async () => {
    if (!selectedRegistryServer || isCreatingServer) {
      return;
    }

    const api = window.mcpRegistry;
    setRegistryError("");

    try {
      if (api) {
        const next = await api.deleteServer(selectedRegistryServer.id);
        applyRegistryResult(next, "");
      } else {
        const next = {
          ...registry,
          servers: registry.servers.filter((server) => server.id !== selectedRegistryServer.id)
        };
        applyRegistryResult(next, "");
      }
    } catch (error) {
      setRegistryError(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  };

  const autoAddServers = async () => {
    const api = window.mcpRegistry;
    setRegistryError("");
    setAutoAddMessage("");

    if (!api) {
      const message = "자동 추가 테스트는 데스크톱 프로그램에서 사용할 수 있습니다.";
      setRegistryError(message);
      setAutoAddMessage(message);
      return;
    }

    try {
      const beforeCount = registry.servers.length;
      const next = await api.autoAddServers();
      applyRegistryResult(next, next.servers.at(-1)?.id ?? selectedId);
      setIsCreatingServer(false);
      const message =
        next.servers.length === beforeCount
          ? "새로 감지된 MCP 서버가 없습니다."
          : `${next.servers.length - beforeCount}개 서버를 자동 추가했습니다.`;
      setRegistryError(message);
      setAutoAddMessage(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "자동 추가에 실패했습니다.";
      setRegistryError(message);
      setAutoAddMessage(message);
    }
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
  const displaySubmenuItem = isCompact ? null : activeSubmenuItem;
  const displayPageTitle = isCompact ? sidebarLabel(activeCompactSection) : activePageTitle;
  const displayPageSubtitle = isCompact
    ? topbarSubtitle(displayServerWorkspace, activeCompactSection)
    : activePageSubtitle;
  const displayCustomTool =
    displaySubmenuInfo && displaySubmenuInfo.submenuId.startsWith("custom-tool-")
      ? customTools.find((tool) => tool.id === displaySubmenuInfo.submenuId)
      : undefined;
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
      ? "More Tools"
      : `${sidebarLabel(customToolDialogScope)} Custom Tools`;
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
  const pendingReviewTools = customTools.filter(
    (tool) => tool.approvalStatus === "pending" || tool.reviewState === "open"
  );

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
    return "승인 대기";
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
            onClick={autoAddServers}
          >
            <span className={`statusDot ${connectionSummary.tone}`} />
            <span>{connectionSummary.label}</span>
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
              {githubUser ? `${githubUser.nickname}님` : "로그인"}
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
            <AppIcon name="moreTools" className="utilityIcon" />
          </span>
          <span className="navFull">
            <AppIcon name="moreTools" className="utilityIcon" />
            <span>More Tools</span>
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
          <div className={displaySubmenuInfo && displaySubmenuItem && !displayCustomTool ? "topbarTitle editable" : "topbarTitle"}>
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
            ) : displaySubmenuInfo && displaySubmenuItem ? (
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
          />
        ) : null}

        {!displaySubmenuItem && displaySidebarSection === "workflow" ? <WorkflowView /> : null}

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
            <strong>{isSignupApproved ? "라이선스가 필요합니다." : "관리자 승인이 필요합니다."}</strong>
            <span>
              {isSignupApproved
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
                    <div className="dialogSummary">
                      <Metric label="등록 서버" value={registry.servers.length} />
                      <Metric label="연결 서버" value={runningCount} />
                      <Metric label="미연결 서버" value={disconnectedCount} />
                    </div>
                    <div className="dialogServerGrid">
                      <section className="dialogPanel">
                        <div className="panelHeader">
                          <h2>서버 목록</h2>
                          <span className="panelHeaderNote">자동 감지 또는 수동 추가로 연결할 MCP 서버를 등록합니다.</span>
                          <div className="panelHeaderActions">
                            <button className="secondaryAction" type="button" onClick={autoAddServers}>
                              자동 추가
                            </button>
                            <button className="secondaryAction" type="button" onClick={() => startCreatingServer()}>
                              수동 추가
                            </button>
                          </div>
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
                                  setSelectedId(server.id);
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
                        {isCreatingServer || selectedRegistryServer ? (
                        <div className="inlineServerDetail">
                        <div className="panelHeader">
                          <h2>{isCreatingServer ? "새 서버 추가" : "선택 서버 상세"}</h2>
                        </div>
                          <div className="details serverEditor">
                            <label className="field">
                              <span>서버 이름</span>
                              <input
                                value={serverDraft.name}
                                onChange={(event) => updateServerDraft("name", event.target.value)}
                              />
                            </label>
                            <label className="field">
                              <span>대상</span>
                              <select
                                value={serverDraft.target}
                                onChange={(event) =>
                                  updateServerDraft("target", event.target.value as McpTarget)
                                }
                              >
                                <option value="cad">CAD</option>
                                <option value="revit">Revit</option>
                                <option value="other">Other</option>
                              </select>
                            </label>
                            <label className="field">
                              <span>연결 방식</span>
                              <select
                                value={serverDraft.connectionType}
                                onChange={(event) =>
                                  updateServerDraft(
                                    "connectionType",
                                    event.target.value as ServerDraft["connectionType"]
                                  )
                                }
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
                                onChange={(event) => updateServerDraft("url", event.target.value)}
                              />
                            </label>
                            <label className="field">
                              <span>포트</span>
                              <input
                                inputMode="numeric"
                                value={serverDraft.port}
                                onChange={(event) => updateServerDraft("port", event.target.value)}
                              />
                            </label>
                            <label className="field">
                              <span>실행 명령</span>
                              <input
                                value={serverDraft.launchCommand}
                                onChange={(event) =>
                                  updateServerDraft("launchCommand", event.target.value)
                                }
                              />
                            </label>
                            <label className="field">
                              <span>작업 폴더</span>
                              <input
                                value={serverDraft.workingDirectory}
                                onChange={(event) =>
                                  updateServerDraft("workingDirectory", event.target.value)
                                }
                              />
                            </label>
                            <label className="field">
                              <span>메모</span>
                              <textarea
                                value={serverDraft.notes}
                                onChange={(event) => updateServerDraft("notes", event.target.value)}
                              />
                            </label>
                            {registryError ? <p className="formError">{registryError}</p> : null}
                            {processActionMessage ? (
                              <p className="processActionMessage">{processActionMessage}</p>
                            ) : null}
                            <div className="serverEditorActions">
                              <button className="primary" type="button" onClick={saveServer}>
                                저장
                              </button>
                              <button
                                className="secondaryAction"
                                type="button"
                                disabled={
                                  isCreatingServer ||
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
                                disabled={isCreatingServer || !isSelectedServerRunning}
                                onClick={() =>
                                  selectedRegistryServer
                                    ? stopServerProcess(selectedRegistryServer.id)
                                    : undefined
                                }
                              >
                                중지
                              </button>
                              <button className="secondaryAction" type="button" onClick={cancelServerEdit}>
                                초기화
                              </button>
                              <button
                                className="dangerAction"
                                type="button"
                                disabled={isCreatingServer}
                                onClick={deleteSelectedServer}
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        </div>
                        ) : null}
                      </section>
                    </div>
                  </>
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
                        <strong>{githubUser ? `${githubUser.nickname}님` : "로그인이 필요합니다."}</strong>
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
                              앱 승인 또는 GitHub PR 머지가 필요한 툴입니다.
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
                                <th>앱 승인</th>
                                <th>GitHub</th>
                                <th>관리</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pendingReviewTools.map((tool) => (
                                <tr key={tool.id}>
                                  <td>{tool.name}</td>
                                  <td>{tool.version}</td>
                                  <td>{tool.author}</td>
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
                                  <td className="emptyTableCell" colSpan={6}>
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
                <span>MD 형태의 커스텀 툴을 가져오고 상단고정으로 관리합니다.</span>
              </div>
              <div className="dialogHeaderActions">
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
                  className="dialogWindowButton"
                  aria-label="닫기"
                  title="닫기"
                  onClick={() => setIsCustomToolDialogOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div className="dialogContent standaloneDialogContent">
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
                    <th>{renderSortHeader("name", "툴 이름")}</th>
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
                    value={customToolDraft.author}
                    onChange={(event) =>
                      setCustomToolDraft((draft) => ({
                        ...draft,
                        author: event.target.value,
                        error: ""
                      }))
                    }
                  />
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
                <button className="primary" type="button" onClick={saveCustomToolDraft}>
                  저장
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

      {appNotifications.length > 0 ? (
        <div className="notificationStack" role="status" aria-live="polite">
          {appNotifications.map((notification) => (
            <section className="appNotification" key={notification.id}>
              <div>
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
              </div>
              <button
                className="notificationCloseButton"
                type="button"
                aria-label="알림 닫기"
                onClick={() => dismissAppNotification(notification.id)}
              >
                ×
              </button>
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

function ToolWorkspaceView({
  menuLabel,
  tools,
  customTools,
  isMcpReady,
  disabledReason,
  onAddCustomTool,
  onCustomToolContext,
  onOpenTool
}: {
  menuLabel: string;
  tools: ReturnType<typeof getToolsForWorkspace>;
  customTools: CustomToolItem[];
  isMcpReady: boolean;
  disabledReason: string;
  onAddCustomTool: () => void;
  onCustomToolContext: (event: MouseEvent<HTMLButtonElement>, toolId: string) => void;
  onOpenTool: (submenuId: SubmenuId) => void;
}) {
  return (
    <section className="sectionView toolWorkspaceView">
      <div className="toolLibraryGrid">
        <ToolLibrarySection
          iconName="shareTools"
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
          onOpenTool={onOpenTool}
        />
        <CustomToolSection
          customTools={customTools}
          isMcpReady={isMcpReady}
          disabledReason={disabledReason}
          onAddCustomTool={onAddCustomTool}
          onCustomToolContext={onCustomToolContext}
          onOpenTool={onOpenTool}
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

function SubmenuPage({
  menuLabel,
  submenu
}: {
  menuLabel: string;
  submenu: SubmenuItem;
}) {
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
          <div className="principleList">
            <div>
              <strong>입력 수집</strong>
              <span>파일, 객체, 선택 범위처럼 실행에 필요한 기준을 먼저 모읍니다.</span>
            </div>
            <div>
              <strong>MCP 명령 연결</strong>
              <span>정리된 입력값을 연결된 MCP 서버의 실제 명령으로 넘깁니다.</span>
            </div>
            <div>
              <strong>결과 확인</strong>
              <span>실행 결과와 후속 확인 항목을 기록해 다음 작업으로 이어갑니다.</span>
            </div>
          </div>
        </section>

        <section className="panel submenuConfigPanel">
          <div className="panelHeader">
            <div>
              <h2>설정</h2>
              <span className="panelHeaderNote">툴 실행 전에 필요한 기준값을 입력합니다.</span>
            </div>
          </div>
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
        </section>
      </div>
    </section>
  );
}

function HomeDashboard({
  customTools,
  onInstallSaveTool,
  onInstallMcpToolBuilder
}: {
  customTools: CustomToolItem[];
  onInstallSaveTool: () => void;
  onInstallMcpToolBuilder: () => void;
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
              <span>/SAVE 툴이름 명령하면 해당 채팅이 TOOL로 저장됩니다.</span>
            </div>
            <button
              className="secondaryAction homeDownloadButton"
              type="button"
              aria-label="/SAVE 스킬 다운로드"
              title="/SAVE 스킬 다운로드"
              onClick={onInstallSaveTool}
            >
              <AppIcon name="download" />
            </button>
          </div>
          <div className="homeListItem homeToolSaveItem">
            <div>
              <strong>MCP TOOL 만들기</strong>
              <span>질문을 따라가며 작동 원리, 설정, 입출력 포트가 있는 TOOL md 파일을 만듭니다.</span>
            </div>
            <button
              className="secondaryAction homeDownloadButton"
              type="button"
              aria-label="MCP Tool Builder 다운로드"
              title="MCP Tool Builder 다운로드"
              onClick={onInstallMcpToolBuilder}
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
  iconName,
  title,
  description,
  tools,
  isMcpReady,
  disabledReason,
  onOpenTool
}: {
  iconName: AppIconName;
  title: string;
  description: string;
  tools: { id: string; name: string; description: string; version?: string; author?: string }[];
  isMcpReady: boolean;
  disabledReason: string;
  onOpenTool?: (submenuId: SubmenuId) => void;
}) {
  return (
    <section className="panel toolLibrarySection">
      <PanelHeader iconName={iconName} title={title} description={description} />
      <div className="toolList">
        {tools.map((tool) => (
          <button
            className={isMcpReady ? "toolItem toolItemButton" : "toolItem toolItemButton disabledToolItem"}
            type="button"
            disabled={!isMcpReady}
            title={isMcpReady ? undefined : disabledReason}
            aria-label={isMcpReady ? tool.name : `${tool.name}: ${disabledReason}`}
            key={tool.id}
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
        ))}
      </div>
    </section>
  );
}

function CustomToolSection({
  customTools,
  isMcpReady,
  disabledReason,
  onAddCustomTool,
  onCustomToolContext,
  onOpenTool
}: {
  customTools: CustomToolItem[];
  isMcpReady: boolean;
  disabledReason: string;
  onAddCustomTool: () => void;
  onCustomToolContext: (event: MouseEvent<HTMLButtonElement>, toolId: string) => void;
  onOpenTool: (submenuId: SubmenuId) => void;
}) {
  return (
    <section className="panel toolLibrarySection">
      <PanelHeader
        iconName="customTools"
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
          .map((tool) => (
            <button
              className={[
                "toolItem",
                "toolItemButton",
                tool.pinned ? "pinnedToolItem" : "",
                tool.isToolLike ? "" : "suspectToolItem",
                isMcpReady ? "" : "disabledToolItem"
              ]
                .filter(Boolean)
                .join(" ")}
              key={tool.id}
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
              onClick={() => {
                if (
                  tool.riskWarnings.length > 0 &&
                  !window.confirm(`주의가 필요한 툴입니다.\n\n${tool.riskWarnings.join("\n")}\n\n그래도 실행하시겠습니까?`)
                ) {
                  return;
                }
                if (
                  !tool.isToolLike &&
                  !window.confirm(
                    "이 MD 파일은 툴 문서 형태가 아닐 수 있습니다. 그래도 실행하시겠습니까?"
                  )
                ) {
                  return;
                }
                onOpenTool(tool.id);
              }}
              onContextMenu={(event) => onCustomToolContext(event, tool.id)}
            >
              <span className="customToolItemTitle">
                <strong>
                  {tool.name}
                  {tool.riskWarnings.length > 0 ? (
                    <span className="toolRiskBadge inlineRiskBadge" title={tool.riskWarnings.join("\n")}>
                      주의
                    </span>
                  ) : null}
                </strong>
                <small>v{tool.version} - {tool.author}</small>
              </span>
              <span>{tool.description || "등록된 설명이 없습니다."}</span>
            </button>
          ))}
        {customTools.length === 0 ? (
          <p className="emptyState compactEmptyState centeredEmptyState">
            등록된 커스텀 툴이 없습니다.
          </p>
        ) : null}
      </div>
    </section>
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

function WorkflowView() {
  const flowCanvasRef = useRef<HTMLDivElement | null>(null);
  const lastMiddleClickAtRef = useRef(0);
  const initialFlowGraphRef = useRef<StoredFlowGraph | null | undefined>(undefined);
  if (initialFlowGraphRef.current === undefined) {
    initialFlowGraphRef.current = loadStoredFlowGraph();
  }
  const initialFlowGraph = initialFlowGraphRef.current;
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>(() =>
    initialFlowGraph?.nodes.length ? initialFlowGraph.nodes : defaultFlowNodes()
  );
  const [flowConnections, setFlowConnections] = useState<FlowConnection[]>(() =>
    initialFlowGraph?.connections.length ? initialFlowGraph.connections : defaultFlowConnections()
  );
  const [flowGroups, setFlowGroups] = useState<FlowGroup[]>(() => initialFlowGraph?.groups ?? []);
  const [flowHistory, setFlowHistory] = useState<FlowSnapshot[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState(flowNodes[0]?.nodeId ?? "");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(() =>
    flowNodes[0]?.nodeId ? [flowNodes[0].nodeId] : []
  );
  const [copiedNode, setCopiedNode] = useState<FlowNode | null>(null);
  const [flowNodeMenu, setFlowNodeMenu] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);
  const [flowScale, setFlowScale] = useState(initialFlowGraph?.scale ?? 1);
  const [flowPan, setFlowPan] = useState(initialFlowGraph?.pan ?? { x: 0, y: 0 });
  const [expandedNodeId, setExpandedNodeId] = useState(flowNodes[0]?.nodeId ?? "");
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

  const rememberFlowState = () => {
    setFlowHistory((items) => [
      ...items.slice(-29),
      {
        nodes: flowNodes.map((node) => ({
          ...node,
          inputs: node.inputs.map((port) => ({ ...port })),
          outputs: node.outputs.map((port) => ({ ...port }))
        })),
        connections: flowConnections.map((connection) => ({ ...connection })),
        groups: flowGroups.map((group) => ({
          ...group,
          nodeIds: [...group.nodeIds]
        }))
      }
    ]);
  };

  const restorePreviousFlowState = () => {
    setFlowHistory((items) => {
      const previous = items.at(-1);
      if (!previous) {
        return items;
      }

      setFlowNodes(previous.nodes.map((node) => ({
        ...node,
        inputs: node.inputs.map((port) => ({ ...port })),
        outputs: node.outputs.map((port) => ({ ...port }))
      })));
      setFlowConnections(previous.connections.map((connection) => ({ ...connection })));
      setFlowGroups(previous.groups.map((group) => ({
        ...group,
        nodeIds: [...group.nodeIds]
      })));
      setSelectedNodeId(previous.nodes[0]?.nodeId ?? "");
      setSelectedNodeIds(previous.nodes[0]?.nodeId ? [previous.nodes[0].nodeId] : []);
      setExpandedNodeId((current) =>
        previous.nodes.some((node) => node.nodeId === current) ? current : previous.nodes[0]?.nodeId ?? ""
      );
      return items.slice(0, -1);
    });
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

  const getFlowPortCenter = (
    node: FlowNode,
    direction: "input" | "output",
    portId: string
  ) =>
    flowPortCenters[flowPortCenterKey(node.nodeId, direction, portId)] ??
    flowConnectionEndpoint(node, direction, portId);

  useLayoutEffect(() => {
    if (!flowCanvasRef.current) {
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
  }, [expandedNodeId, flowNodes, flowPan.x, flowPan.y, flowScale]);

  const estimateFlowNodeHeight = (node: FlowNode) => {
    const portRows = Math.max(1, node.inputs.length, node.outputs.length);
    const detailsHeight = expandedNodeId === node.nodeId ? 104 : 0;
    return 102 + portRows * 36 + detailsHeight;
  };

  const flowNodeBounds = (node: FlowNode) => ({
    left: node.x,
    top: node.y,
    right: node.x + flowNodeWidth,
    bottom: node.y + estimateFlowNodeHeight(node)
  });

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
        color: flowTypePalette.any.group,
        nodeIds: validNodeIds
      }
    ]);
  }

  function deleteSelectedFlowNodes() {
    const ids = selectedNodeIds.filter((id) => flowNodes.some((node) => node.nodeId === id));
    if (ids.length === 0) {
      return;
    }

    rememberFlowState();
    const idSet = new Set(ids);
    setFlowNodes((items) => items.filter((node) => !idSet.has(node.nodeId)));
    setFlowConnections((connections) =>
      connections.filter(
        (connection) => !idSet.has(connection.fromNodeId) && !idSet.has(connection.toNodeId)
      )
    );
    setFlowGroups((groups) =>
      groups
        .map((group) => ({
          ...group,
          nodeIds: group.nodeIds.filter((nodeId) => !idSet.has(nodeId))
        }))
        .filter((group) => group.nodeIds.length > 0)
    );
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setExpandedNodeId((current) => (idSet.has(current) ? "" : current));
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

  useEffect(() => {
    const closeFlowNodeMenu = () => setFlowNodeMenu(null);
    window.addEventListener("click", closeFlowNodeMenu);
    return () => window.removeEventListener("click", closeFlowNodeMenu);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      customFlowGraphStorageKey,
      JSON.stringify({
        nodes: flowNodes,
        connections: flowConnections,
        groups: flowGroups,
        scale: flowScale,
        pan: flowPan
      })
    );
  }, [flowConnections, flowGroups, flowNodes, flowPan, flowScale]);

  useEffect(() => {
    const handleFlowKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (isTyping) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        restorePreviousFlowState();
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
        if (selectedNodeIds.length > 0) {
          event.preventDefault();
          deleteSelectedFlowNodes();
        }
      }
    };

    window.addEventListener("keydown", handleFlowKeyDown);
    return () => window.removeEventListener("keydown", handleFlowKeyDown);
  }, [copiedNode, flowConnections, flowGroups, flowNodes, selectedNodeId, selectedNodeIds]);

  useEffect(() => {
    if (!panningCanvas) {
      return;
    }

    const moveCanvas = (event: globalThis.PointerEvent) => {
      setFlowPan({
        x: panningCanvas.startX + event.clientX - panningCanvas.startClientX,
        y: panningCanvas.startY + event.clientY - panningCanvas.startClientY
      });
    };

    const stopCanvasPan = () => setPanningCanvas(null);

    window.addEventListener("pointermove", moveCanvas);
    window.addEventListener("pointerup", stopCanvasPan);
    window.addEventListener("pointercancel", stopCanvasPan);

    return () => {
      window.removeEventListener("pointermove", moveCanvas);
      window.removeEventListener("pointerup", stopCanvasPan);
      window.removeEventListener("pointercancel", stopCanvasPan);
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
          .filter((node) => rectsIntersect(selectionRect, flowNodeBounds(node)))
          .map((node) => node.nodeId);
        setSelectedNodeIds(selectedIds);
        setSelectedNodeId(selectedIds[0] ?? "");
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
  }, [selectionBox, flowNodes, flowPan.x, flowPan.y, flowScale]);

  useEffect(() => {
    if (!draggingNode) {
      return;
    }

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
      setFlowNodes((items) =>
        items.map((node) => {
          const origin = originMap.get(node.nodeId);
          return origin ? { ...node, x: origin.x + deltaX, y: origin.y + deltaY } : node;
        })
      );
    };

    const stopNodeDrag = () => setDraggingNode(null);

    window.addEventListener("pointermove", moveNode);
    window.addEventListener("pointerup", stopNodeDrag);
    window.addEventListener("pointercancel", stopNodeDrag);

    return () => {
      window.removeEventListener("pointermove", moveNode);
      window.removeEventListener("pointerup", stopNodeDrag);
      window.removeEventListener("pointercancel", stopNodeDrag);
    };
  }, [draggingNode, flowPan.x, flowPan.y, flowScale]);

  useEffect(() => {
    if (!draggingGroup) {
      return;
    }

    const moveGroup = (event: globalThis.PointerEvent) => {
      if (!flowCanvasRef.current) {
        return;
      }

      const rect = flowCanvasRef.current.getBoundingClientRect();
      const nextWorldX = (event.clientX - rect.left - flowPan.x) / flowScale;
      const nextWorldY = (event.clientY - rect.top - flowPan.y) / flowScale;
      const deltaX = nextWorldX - draggingGroup.startWorldX;
      const deltaY = nextWorldY - draggingGroup.startWorldY;
      const originMap = new Map(draggingGroup.origins.map((origin) => [origin.nodeId, origin]));
      setFlowNodes((items) =>
        items.map((node) => {
          const origin = originMap.get(node.nodeId);
          return origin ? { ...node, x: origin.x + deltaX, y: origin.y + deltaY } : node;
        })
      );
    };

    const stopGroupDrag = () => setDraggingGroup(null);

    window.addEventListener("pointermove", moveGroup);
    window.addEventListener("pointerup", stopGroupDrag);
    window.addEventListener("pointercancel", stopGroupDrag);

    return () => {
      window.removeEventListener("pointermove", moveGroup);
      window.removeEventListener("pointerup", stopGroupDrag);
      window.removeEventListener("pointercancel", stopGroupDrag);
    };
  }, [draggingGroup, flowPan.x, flowPan.y, flowScale]);

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

      if (inputNodeId && inputPortId) {
        connectFlowPorts(
          connectionDrag.fromNodeId,
          connectionDrag.fromPortId,
          inputNodeId,
          inputPortId
        );
      }

      setConnectionDrag(null);
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
    rememberFlowState();
    setFlowNodes((items) => [
      ...items,
      { ...nextTool, nodeId, ...(position ?? defaultFlowNodePosition(items.length)) }
    ]);
    setExpandedNodeId(nodeId);
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
  };

  const handleFlowDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
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
    const nextScale = Math.min(1.8, Math.max(0.55, Number((flowScale + zoomStep).toFixed(2))));

    setFlowScale(nextScale);
    setFlowPan({
      x: pointerX - worldX * nextScale,
      y: pointerY - worldY * nextScale
    });
  };

  const handleFlowCanvasPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (event.button === 1) {
      event.preventDefault();
      const now = Date.now();
      if (now - lastMiddleClickAtRef.current < 320) {
        lastMiddleClickAtRef.current = 0;
        setPanningCanvas(null);
        fitFlowToNodes();
        return;
      }

      lastMiddleClickAtRef.current = now;
      setFlowNodeMenu(null);
      setPanningCanvas({
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: flowPan.x,
        startY: flowPan.y
      });
      return;
    }

    if (event.button !== 0 || target?.closest(".flowNode")) {
      return;
    }

    event.preventDefault();
    setFlowNodeMenu(null);
    const point = canvasPointFromPointer(event.clientX, event.clientY);
    setSelectionBox({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y
    });
  };

  const handleFlowNodePointerDown = (event: PointerEvent<HTMLDivElement>, nodeId: string) => {
    event.stopPropagation();
    if (event.button !== 0) {
      return;
    }

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
    const uniqueSelection = Array.from(new Set(nextSelection));
    const origins = flowNodes
      .filter((node) => uniqueSelection.includes(node.nodeId))
      .map((node) => ({ nodeId: node.nodeId, x: node.x, y: node.y }));
    if (origins.length === 0) {
      return;
    }

    rememberFlowState();
    setSelectedNodeId(nodeId);
    setSelectedNodeIds(uniqueSelection);
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
    setFlowNodes((items) => items.filter((node) => node.nodeId !== nodeId));
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
    setExpandedNodeId((current) => (current === nodeId ? "" : current));
    setFlowNodeMenu(null);
  };

  const openFlowNodeMenu = (event: MouseEvent<HTMLDivElement>, nodeId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(nodeId);
    setSelectedNodeIds((ids) => (ids.includes(nodeId) ? ids : [nodeId]));
    setFlowNodeMenu({ nodeId, x: event.clientX, y: event.clientY });
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
  };

  const startGroupDrag = (event: PointerEvent<HTMLElement>, group: FlowGroup) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0 || !flowCanvasRef.current) {
      return;
    }

    const validNodeIds = group.nodeIds.filter((id) => flowNodes.some((node) => node.nodeId === id));
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
    setSelectedNodeId(validNodeIds[0] ?? "");
    setSelectedNodeIds(validNodeIds);
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
  const flowValidationErrorCount = flowValidationIssues.filter(
    (issue) => issue.severity === "error"
  ).length;
  const flowValidationWarningCount = flowValidationIssues.length - flowValidationErrorCount;
  const flowValidationTone =
    flowValidationErrorCount > 0
      ? "error"
      : flowValidationWarningCount > 0
        ? "warning"
        : "ready";

  return (
    <section className="sectionView customFlowView">
      <div
        ref={flowCanvasRef}
        className={["flowCanvas", panningCanvas ? "panning" : ""].filter(Boolean).join(" ")}
        style={flowCanvasStyle}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleFlowDrop}
        onPointerDown={handleFlowCanvasPointerDown}
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
                  className={isWarning ? "warningConnectionPath" : undefined}
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
          {renderedFlowGroups.map(({ group, bounds }) => (
            <div
              className={[
                "flowGroupBox",
                draggingGroup?.groupId === group.id ? "dragging" : ""
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
                  onPointerDown={(event) => event.stopPropagation()}
                  aria-label="그룹 이름"
                />
                <input
                  className="flowGroupColorInput"
                  type="color"
                  value={group.color}
                  onChange={(event) => updateFlowGroupColor(group.id, event.target.value)}
                  onPointerDown={(event) => event.stopPropagation()}
                  aria-label="그룹 배경색"
                />
              </div>
            </div>
          ))}
          {flowNodes.map((node) => {
              const isExpanded = expandedNodeId === node.nodeId;
              const nodePalette = flowPaletteForType(flowTypeForNode(node));
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
                    draggingNode?.nodeIds.includes(node.nodeId) ? "dragging" : ""
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
                    <AppIcon className="flowNodeProgramIcon" name={node.programIcon} />
                    <span className="flowNodeTitleBlock">
                      <strong>{node.name}</strong>
                      <small>{node.description}</small>
                    </span>
                    <button
                      className="flowNodeChevron"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedNodeId(node.nodeId);
                        setExpandedNodeId(isExpanded ? "" : node.nodeId);
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      aria-label={`${node.name} ${isExpanded ? "접기" : "펼치기"}`}
                    >
                      {isExpanded ? "▴" : "▾"}
                    </button>
                  </div>
                  <div className={["flowNodeBody", isExpanded ? "expanded" : "compact"].join(" ")}>
                    <div className="flowPortColumns">
                      <div className="flowPorts left">
                        <strong>Input</strong>
                        {node.inputs.map((port) => (
                          (() => {
                            const portPalette = flowPaletteForType(port.type);
                            return (
                          <div
                            className={[
                              "flowPortRow",
                              "inputPortRow",
                              incomingPortIds.has(port.id) ? "connected" : ""
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={port.id}
                            data-flow-input-node={node.nodeId}
                            data-flow-input-port={port.id}
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
                          </div>
                            );
                          })()
                        ))}
                      </div>
                      <div className="flowPorts right">
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
                              pendingConnection?.nodeId === node.nodeId &&
                              pendingConnection.portId === port.id
                                ? "pending"
                                : ""
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={port.id}
                            onPointerDown={(event) => startConnectionDrag(event, node.nodeId, port.id)}
                            title={`출력 포트: ${port.label}`}
                            aria-label={`${node.name} ${port.label} 출력 포트`}
                            style={{
                              "--flow-port-color": portPalette.accent,
                              "--flow-port-ring": portPalette.border
                            } as CSSProperties}
                          >
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
                    </div>
                    {isExpanded ? (
                      <div className="flowNodeDetails">
                        <strong>작동 원리</strong>
                        <p>{node.description}</p>
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
              그룹 만들기
            </button>
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
              복제
            </button>
            <button
              className="danger"
              type="button"
              onClick={() => deleteFlowNode(flowNodeMenu.nodeId)}
            >
              삭제
            </button>
          </div>
        ) : null}
        <aside className={`flowValidationPanel ${flowValidationTone}`} aria-label="Custom Flow 실행 전 검증">
          <div className="flowValidationHeader">
            <strong>실행 전 검증</strong>
            <span>
              오류 {flowValidationErrorCount} / 경고 {flowValidationWarningCount}
            </span>
          </div>
          <div className="flowValidationList">
            {flowValidationIssues.length > 0 ? (
              flowValidationIssues.slice(0, 5).map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  className={`flowValidationItem ${issue.severity}`}
                  onClick={() => {
                    if (!issue.nodeId) {
                      return;
                    }
                    setSelectedNodeId(issue.nodeId);
                    setSelectedNodeIds([issue.nodeId]);
                    setExpandedNodeId(issue.nodeId);
                  }}
                >
                  <strong>{issue.title}</strong>
                  <span>{issue.message}</span>
                </button>
              ))
            ) : (
              <p className="flowValidationReady">실행 전 검증을 통과했습니다.</p>
            )}
          </div>
        </aside>
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
    workflow: "Custom Flow"
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
    workflow: "여러 프로그램의 MCP 툴을 연결하는 플로우를 정리합니다."
  };
  return subtitles[tabId];
}

function toolPanelTitle(tabId: WorkspaceTabId) {
  const titles: Record<WorkspaceTabId, string> = {
    registry: "Registry MCP 툴",
    cad: "CAD MCP 툴",
    revit: "Revit MCP 툴",
    workflow: "Custom Flow MCP 툴"
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
    other: "Other"
  };
  return labels[target];
}
