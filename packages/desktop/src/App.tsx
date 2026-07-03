import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, DragEvent, MouseEvent, PointerEvent } from "react";
import type { McpServerRecord, RegistryFile } from "@mcp-registry/shared";
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
  workflowSteps,
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
import {
  filterServersByWorkspace,
  registryWorkspaceTab,
  workspaceTabs,
  type WorkspaceTabId
} from "./workspaceTabs";

const pinnedTabsStorageKey = "mcp-registry:pinned-tabs";
const favoriteSectionsStorageKey = "mcp-registry:favorite-sections";
const favoriteSubmenusStorageKey = "mcp-registry:favorite-submenus";
const recentSubmenusStorageKey = "mcp-registry:recent-submenus";
const sidebarOrderStorageKey = "mcp-registry:sidebar-order";
const submenuOrderStorageKey = "mcp-registry:submenu-order";
const sidebarWidthStorageKey = "mcp-registry:sidebar-width";
const minSidebarWidth = 212;
const maxSidebarWidth = 360;
let tabCounter = 0;

type SubmenuId = "tools" | "settings" | "add";
type SubmenuKey = `${SidebarSectionId}:${SubmenuId}`;

const defaultSubmenuItems: Array<{ id: SubmenuId; label: string }> = [
  { id: "tools", label: "도구 목록" },
  { id: "settings", label: "연결 설정" },
  { id: "add", label: "추가" }
];

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
    return pinnedTabs.length > 0 ? pinnedTabs : [createSectionTab("tab-initial", "servers", "cad")];
  } catch {
    return [createSectionTab("tab-initial", "servers", "cad")];
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
  return defaultSubmenuItems.some((item) => item.id === value);
}

function parseSubmenuKey(key: SubmenuKey) {
  const [sectionId, submenuId] = key.split(":") as [SidebarSectionId, SubmenuId];
  return { sectionId, submenuId };
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
    return keys.filter(isValidSubmenuKey).slice(0, 5);
  } catch {
    return [];
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
  if (sectionId === "monitor") {
    return "Process Monitor";
  }

  return sidebarSections.find((section) => section.id === sectionId)?.label ?? "새 탭";
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
      notes: "Revit 연결 자리입니다. 나중에 CAD 정보로 Revit 작업을 실행할 때 사용합니다.",
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
      notes: "CAD 연결 자리입니다. 도면 정보를 읽는 기능을 이후 단계에서 연결합니다.",
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z"
    }
  ]
};

export function App() {
  const [registry, setRegistry] = useState<RegistryFile>(fallbackRegistry);
  const [openTabs, setOpenTabs] = useState<AppTab[]>(() => loadPinnedTabs());
  const [activeOpenTabId, setActiveOpenTabId] = useState(() => openTabs[0]?.id ?? "tab-initial");
  const [selectedId, setSelectedId] = useState<string>("revit-default");
  const [isCompact, setIsCompact] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRegistryDialogOpen, setIsRegistryDialogOpen] = useState(false);
  const [isMonitorDialogOpen, setIsMonitorDialogOpen] = useState(false);
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
  const [sidebarOrder, setSidebarOrder] = useState<SidebarSectionId[]>(() => loadSidebarOrder());
  const [submenuOrder, setSubmenuOrder] = useState<Partial<Record<SidebarSectionId, SubmenuId[]>>>(
    () => loadSubmenuOrder()
  );
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
  const [dragOverSection, setDragOverSection] = useState<{
    id: SidebarSectionId;
    position: TabDropPosition;
  } | null>(null);

  const activeOpenTab = openTabs.find((tab) => tab.id === activeOpenTabId) ?? openTabs[0];
  const activeTab = activeOpenTab.workspaceTabId;
  const activeSidebarSection = activeOpenTab.sectionId;

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
    window.localStorage.setItem(pinnedTabsStorageKey, JSON.stringify(getPinnedTabs(openTabs)));
  }, [openTabs]);

  useEffect(() => {
    window.localStorage.setItem(favoriteSectionsStorageKey, JSON.stringify(favoriteSectionIds));
  }, [favoriteSectionIds]);

  useEffect(() => {
    window.localStorage.setItem(favoriteSubmenusStorageKey, JSON.stringify(favoriteSubmenuKeys));
  }, [favoriteSubmenuKeys]);

  useEffect(() => {
    window.localStorage.setItem(recentSubmenusStorageKey, JSON.stringify(recentSubmenuKeys));
  }, [recentSubmenuKeys]);

  useEffect(() => {
    window.localStorage.setItem(sidebarOrderStorageKey, JSON.stringify(sidebarOrder));
  }, [sidebarOrder]);

  useEffect(() => {
    window.localStorage.setItem(submenuOrderStorageKey, JSON.stringify(submenuOrder));
  }, [submenuOrder]);

  useEffect(() => {
    window.localStorage.setItem(sidebarWidthStorageKey, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (contextMenu || isRegistryDialogOpen || isMonitorDialogOpen) {
          event.preventDefault();
          setContextMenu(null);
          setIsRegistryDialogOpen(false);
          setIsMonitorDialogOpen(false);
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
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [contextMenu, isMonitorDialogOpen, isRegistryDialogOpen, sidebarOrder, submenuOrder]);

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null);
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

  const visibleServers = useMemo(
    () => filterServersByWorkspace(registry.servers, activeTab),
    [activeTab, registry.servers]
  );

  useEffect(() => {
    if (visibleServers.length === 0) {
      setSelectedId("");
      return;
    }

    if (!visibleServers.some((server) => server.id === selectedId)) {
      setSelectedId(visibleServers[0].id);
    }
  }, [selectedId, visibleServers]);

  const selected = useMemo<McpServerRecord | undefined>(
    () => visibleServers.find((server) => server.id === selectedId),
    [selectedId, visibleServers]
  );
  const selectedRegistryServer = useMemo<McpServerRecord | undefined>(
    () => registry.servers.find((server) => server.id === selectedId) ?? registry.servers[0],
    [registry.servers, selectedId]
  );

  const cadCount = registry.servers.filter((server) => server.target === "cad").length;
  const revitCount = registry.servers.filter((server) => server.target === "revit").length;
  const runningCount = registry.servers.filter((server) => server.status === "running").length;
  const connectionSummary = getConnectionSummary(registry.servers);
  const workspaceTools = getToolsForWorkspace(activeTab);
  const orderedSidebarSections = useMemo(
    () =>
      sidebarOrder
        .map((id) => sidebarSections.find((section) => section.id === id))
        .filter((section): section is (typeof sidebarSections)[number] => Boolean(section)),
    [sidebarOrder]
  );

  const toggleCompactMode = () => {
    const nextValue = !isCompact;
    setIsCompact(nextValue);
    void window.mcpWindow?.setCompactMode(nextValue);
  };

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

  const getSubmenuLabel = (submenuId: SubmenuId) =>
    defaultSubmenuItems.find((item) => item.id === submenuId)?.label ?? "";

  const getOrderedSubmenuItems = (sectionId: SidebarSectionId) => {
    const savedOrder = submenuOrder[sectionId] ?? [];
    const orderedIds = [
      ...savedOrder.filter((id) => id !== "add"),
      ...defaultSubmenuItems
        .map((item) => item.id)
        .filter((id) => id !== "add" && !savedOrder.includes(id)),
      "add" as SubmenuId
    ];

    return orderedIds.map((id) => ({ id, label: getSubmenuLabel(id) }));
  };

  const rememberRecentSubmenu = (sectionId: SidebarSectionId, submenuId: SubmenuId) => {
    if (submenuId === "add") {
      return;
    }

    const key = makeSubmenuKey(sectionId, submenuId);
    setRecentSubmenuKeys((keys) => [key, ...keys.filter((item) => item !== key)].slice(0, 5));
  };

  const openSubmenu = (
    sectionId: SidebarSectionId,
    submenuId: SubmenuId,
    source: "submenu" | "favoriteSubmenu" | "recent" = "submenu"
  ) => {
    if (submenuId === "add") {
      return;
    }

    const key = makeSubmenuKey(sectionId, submenuId);
    rememberRecentSubmenu(sectionId, submenuId);
    navigateInCurrentTab({
      sectionId,
      title: getSubmenuLabel(submenuId),
      source,
      submenuKey: key
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
      title: getSubmenuLabel(submenuId),
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
              className="submenuDragButton"
              aria-label={`${submenu.label} 순서 변경`}
              tabIndex={-1}
              type="button"
            >
              <span />
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
        <div className="openTabs">
          {openTabs.map((tab, index) => (
            <button
              key={tab.id}
              className={[
                "openTab",
                tab.id === activeOpenTabId ? "active" : "",
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
              {tab.isPinned ? <span className="pinMark">●</span> : null}
              <span className="openTabTitle">{tabSubmenuLabel(tab)}</span>
              <span className="openTabMeta">{tabMenuLabel(tab)}</span>
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
            {isCompact ? "기본 보기" : "간소화"}
          </button>
          <div className="connectionBadge" title={connectionSummary.label}>
            <span className={`statusDot ${connectionSummary.tone}`} />
            <span>{connectionSummary.label}</span>
          </div>
        </div>
      </nav>

      <aside className="sidebar">
        <div className="brand">
          <div className="brandHeader">
            <strong>MCP 연결관리자</strong>
            <button
              className="sidebarToggle sidebarToggleInline"
              aria-label={isSidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
              onClick={() => setIsSidebarCollapsed((value) => !value)}
            >
              <span className="sidebarToggleMark" aria-hidden="true">
                {isSidebarCollapsed ? "›" : "‹"}
              </span>
            </button>
          </div>
          <span className="brandVersion">v0.1.0</span>
        </div>
        <button
          className="sidebarToggle sidebarToggleCollapsed"
          aria-label="메뉴 펼치기"
          onClick={() => setIsSidebarCollapsed(false)}
        >
          <span className="sidebarToggleMark" aria-hidden="true">
            ›
          </span>
        </button>
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
                    section.id === activeSidebarSection && activeSidebarSource === "favorite"
                      ? "active"
                      : "",
                    expandedFavoriteSectionIds.includes(section.id) ? "expanded" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button className="navOrderButton" aria-label={`${section.label} 즐겨찾기`}>
                    ☰
                  </button>
                  <button
                    className={
                      section.id === activeSidebarSection && activeSidebarSource === "favorite"
                        ? "navItem favorite active"
                        : "navItem favorite"
                    }
                    onClick={() => openSectionInCurrentTab(section.id, "favorite")}
                    onContextMenu={(event) => showSidebarContextMenu(event, section.id)}
                  >
                    <span className="navShort">{section.shortLabel}</span>
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
                  onClick={() => openSubmenu(sectionId, submenuId, "favoriteSubmenu")}
                  onContextMenu={(event) => showSubmenuContextMenu(event, sectionId, submenuId)}
                >
                  <span className="submenuMiniIcon" aria-hidden="true" />
                  <span className="navFull">
                    {section.label} / {getSubmenuLabel(submenuId)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        <span className="sidebarLabel navFull">메뉴</span>
        {orderedSidebarSections.map((section) => (
          <div
            className={[
              "navRow",
              section.id === activeSidebarSection && activeSidebarSource === "menu" ? "active" : "",
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
              ☰
            </button>
            <button
              className={
                section.id === activeSidebarSection && activeSidebarSource === "menu"
                  ? "navItem active"
                  : "navItem"
              }
              onClick={() => openSectionInCurrentTab(section.id, "menu")}
              onContextMenu={(event) => showSidebarContextMenu(event, section.id)}
            >
              <span className="navShort">{section.shortLabel}</span>
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
        <div className="recentSubmenuGroup">
          <div className="recentSubmenuHeader navFull">
            <span className="sidebarLabel">최근 사용</span>
            <button
              className="recentClearButton"
              type="button"
              aria-label="최근 사용 모두 삭제"
              title="최근 사용 모두 삭제"
              disabled={recentSubmenuKeys.length === 0}
              onClick={() => setRecentSubmenuKeys([])}
            >
              <span aria-hidden="true" />
            </button>
          </div>
          {recentSubmenuKeys.map((key) => {
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
                onClick={() => openSubmenu(sectionId, submenuId, "recent")}
                onContextMenu={(event) =>
                  showSubmenuContextMenu(event, sectionId, submenuId, "recent")
                }
              >
                <span className="navFull">
                  {section.label} / {getSubmenuLabel(submenuId)}
                </span>
              </button>
            );
          })}
        </div>
        <button
          className={activeSidebarSection === "monitor" ? "sidebarMonitorButton active" : "sidebarMonitorButton"}
          onClick={openMonitorSection}
        >
          <span className="navShort" aria-hidden="true">
            ⏱
          </span>
          <span className="navFull">
            <span aria-hidden="true">⏱</span>
            <span>Process Monitor</span>
          </span>
        </button>
        <button
          className="sidebarSettingsButton"
          aria-label={`${registryWorkspaceTab.label} 열기`}
          title={`${registryWorkspaceTab.label} 열기`}
          onClick={() => setIsRegistryDialogOpen(true)}
        >
          <span className="navShort" aria-hidden="true">
            ⚙
          </span>
          <span className="navFull">
            <span aria-hidden="true">⚙</span>
            <span>Settings</span>
          </span>
        </button>
        <div
          className="sidebarResizeHandle"
          role="separator"
          aria-label="메뉴 너비 조절"
          aria-orientation="vertical"
          onPointerDown={startSidebarResize}
        />
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{topbarTitle(activeTab, activeSidebarSection)}</h1>
            <p>{topbarSubtitle(activeTab, activeSidebarSection)}</p>
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

        <section className="metrics">
          <Metric label="등록 서버" value={registry.servers.length} />
          <Metric label="실행 중" value={runningCount} />
          <Metric label="CAD" value={cadCount} />
          <Metric label="Revit" value={revitCount} />
        </section>

        {activeSidebarSection === "servers" ? (
          <ServersView
            activeTab={activeTab}
            selected={selected}
            selectedId={selectedId}
            servers={visibleServers}
            tools={workspaceTools}
            onSelectServer={setSelectedId}
          />
        ) : null}

        {activeSidebarSection === "workflow" ? <WorkflowView /> : null}

        {activeSidebarSection === "monitor" ? (
          <MonitorView runningCount={runningCount} totalCount={registry.servers.length} />
        ) : null}

        {activeSidebarSection === "excel" ? (
          <IntegrationView
            title="Excel MCP 도구"
            items={["시트 데이터 읽기", "표 범위 정리", "CAD/Revit 작업표 내보내기"]}
          />
        ) : null}

        {activeSidebarSection === "tekla" ? (
          <IntegrationView
            title="Tekla MCP 도구"
            items={["모델 객체 읽기", "부재 정보 매핑", "Revit/CAD 연계 준비"]}
          />
        ) : null}
      </main>

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
                <h2 id="registryDialogTitle">MCP Registry 설정</h2>
                <span>전체 창의 연결 관리 기능을 작은 설정 창에서 확인합니다.</span>
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
                      <Metric label="CAD" value={cadCount} />
                      <Metric label="Revit" value={revitCount} />
                    </div>
                    <div className="dialogServerGrid">
                      <section className="dialogPanel">
                        <div className="panelHeader">
                          <h2>서버 목록</h2>
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
                                className={server.id === selectedRegistryServer?.id ? "selectedRow" : ""}
                                onClick={() => setSelectedId(server.id)}
                              >
                                <td>{server.name}</td>
                                <td>{server.target === "cad" ? "CAD" : "Revit"}</td>
                                <td>{statusLabel(server.status)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </section>
                      <aside className="dialogPanel">
                        <div className="panelHeader">
                          <h2>선택 서버 상세</h2>
                        </div>
                        {selectedRegistryServer ? (
                          <div className="details">
                            <Field label="서버 이름" value={selectedRegistryServer.name} />
                            <Field label="연결 URL" value={selectedRegistryServer.url} />
                            <Field label="실행 명령" value={selectedRegistryServer.launchCommand} />
                            <Field label="작업 폴더" value={selectedRegistryServer.workingDirectory} />
                            <Field label="메모" value={selectedRegistryServer.notes} multiline />
                          </div>
                        ) : (
                          <p className="emptyState">서버를 선택하세요.</p>
                        )}
                      </aside>
                    </div>
                  </>
                ) : (
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
                <h2 id="monitorDialogTitle">Process Monitor</h2>
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
              <MonitorView runningCount={runningCount} totalCount={registry.servers.length} />
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

function ServersView({
  activeTab,
  selected,
  selectedId,
  servers,
  tools,
  onSelectServer
}: {
  activeTab: WorkspaceTabId;
  selected: McpServerRecord | undefined;
  selectedId: string;
  servers: McpServerRecord[];
  tools: ReturnType<typeof getToolsForWorkspace>;
  onSelectServer: (serverId: string) => void;
}) {
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
                <td>{server.target === "cad" ? "CAD" : "Revit"}</td>
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
            <div className="buttonStack">
              <button className="primary">실행</button>
              <button>중지</button>
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
  return (
    <section className="sectionView">
      <div className="workflowRail">
        {workflowSteps.map((step, index) => (
          <div className="workflowStep" key={step.title}>
            <span>{index + 1}</span>
            <strong>{step.title}</strong>
            <p>{step.body}</p>
          </div>
        ))}
      </div>
      <div className="panel workflowBoard">
        <div className="panelHeader">
          <h2>CAD ↔ Revit 작업 보드</h2>
        </div>
        <div className="workflowBoardGrid">
          <div>
            <strong>입력 대기</strong>
            <span>CAD 레이어/블록 정보를 읽으면 여기에 표시됩니다.</span>
          </div>
          <div>
            <strong>검토 필요</strong>
            <span>Revit 패밀리와 매핑이 필요한 항목을 모읍니다.</span>
          </div>
          <div>
            <strong>실행 준비</strong>
            <span>검토가 끝난 작업을 Revit 실행 큐로 넘깁니다.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function MonitorView({ runningCount, totalCount }: { runningCount: number; totalCount: number }) {
  return (
    <section className="sectionView monitorView">
      <div className="monitorStatus">
        <div className="panel monitorTile">
          <span>연결 상태</span>
          <strong>{runningCount > 0 ? "일부 실행 중" : "대기 중"}</strong>
          <p>
            실행 중 {runningCount}개 / 전체 {totalCount}개
          </p>
        </div>
        <div className="panel monitorTile">
          <span>CAD 브리지</span>
          <strong>확인 전</strong>
          <p>AutoCAD MCP 포트 5100 상태를 확인합니다.</p>
        </div>
        <div className="panel monitorTile">
          <span>Revit 브리지</span>
          <strong>확인 전</strong>
          <p>Revit MCP 포트 5001 상태를 확인합니다.</p>
        </div>
      </div>
      <div className="panel logPanel">
        <div className="panelHeader">
          <h2>실행 로그</h2>
        </div>
        <div className="logList">
          <p>[대기] MCP 서버 상태 확인 준비</p>
          <p>[대기] CAD 도면 정보 수집 준비</p>
          <p>[대기] Revit 작업 큐 실행 준비</p>
        </div>
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
    return "CAD ↔ Revit 작업 흐름";
  }

  if (sectionId === "monitor") {
    return "Process Monitor";
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
    revit: "REVIT MCP 서버",
    workflow: "CAD ↔ REVIT MCP 서버"
  };
  return titles[tabId];
}

function topbarSubtitle(tabId: WorkspaceTabId, sectionId: SidebarSectionId) {
  if (sectionId === "workflow") {
    return "CAD에서 읽은 정보를 Revit 작업으로 넘기는 과정을 관리합니다.";
  }

  if (sectionId === "monitor") {
    return "MCP 브리지 실행 상태와 작업 로그를 확인합니다.";
  }

  if (sectionId === "excel") {
    return "Excel 표와 시트 데이터를 CAD/Revit 작업에 연결할 준비 영역입니다.";
  }

  if (sectionId === "tekla") {
    return "Tekla 모델 정보를 CAD/Revit 작업 흐름과 연결할 준비 영역입니다.";
  }

  const subtitles: Record<WorkspaceTabId, string> = {
    registry: "전체 MCP 서버 등록 정보를 관리합니다.",
    cad: "CAD에서 도면 정보를 읽는 MCP 연결을 관리합니다.",
    revit: "Revit에서 모델 작업을 실행하는 MCP 연결을 관리합니다.",
    workflow: "CAD와 Revit 사이의 연결 서버를 함께 확인합니다."
  };
  return subtitles[tabId];
}

function toolPanelTitle(tabId: WorkspaceTabId) {
  const titles: Record<WorkspaceTabId, string> = {
    registry: "Registry MCP 툴",
    cad: "CAD MCP 툴",
    revit: "REVIT MCP 툴",
    workflow: "CAD ↔ REVIT MCP 툴"
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
