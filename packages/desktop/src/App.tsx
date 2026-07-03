import { useEffect, useMemo, useState } from "react";
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
  filterServersByWorkspace,
  getAdjacentWorkspaceTab,
  registryWorkspaceTab,
  workspaceTabs,
  type WorkspaceTabId
} from "./workspaceTabs";

const fallbackRegistry: RegistryFile = {
  version: 1,
  servers: [
    {
      id: "revit-default",
      name: "Revit MCP Bridge",
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
      name: "AutoCAD MCP Bridge",
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
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>("cad");
  const [selectedId, setSelectedId] = useState<string>("revit-default");
  const [isCompact, setIsCompact] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRegistryDialogOpen, setIsRegistryDialogOpen] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] =
    useState<SettingsSectionId>("servers");
  const [activeSidebarSection, setActiveSidebarSection] =
    useState<SidebarSectionId>("servers");
  const [colorMode, setColorMode] = useState<ColorMode>("light");

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

  const toggleCompactMode = () => {
    const nextValue = !isCompact;
    setIsCompact(nextValue);
    void window.mcpWindow?.setCompactMode(nextValue);
  };

  const moveCompactTab = (direction: "previous" | "next") => {
    setActiveTab((current) => getAdjacentWorkspaceTab(current, direction));
  };

  const shellClassName = [
    "appShell",
    isCompact ? "compactMode" : "",
    isSidebarCollapsed ? "sidebarCollapsed" : "",
    colorMode === "dark" ? "darkMode" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClassName}>
      <nav className="workspaceTabs" aria-label="작업 영역 선택">
        <button
          className="tabArrow"
          aria-label="이전 탭"
          onClick={() => moveCompactTab("previous")}
        >
          ‹
        </button>
        <div className="workspaceTabsInner">
          {workspaceTabs.map((tab) => (
            <button
              key={tab.id}
              className={tab.id === activeTab ? "workspaceTab active" : "workspaceTab"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button className="tabArrow" aria-label="다음 탭" onClick={() => moveCompactTab("next")}>
          ›
        </button>
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
        <button
          className="sidebarToggle"
          aria-label={isSidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
          onClick={() => setIsSidebarCollapsed((value) => !value)}
        >
          <span className="sidebarToggleMark" aria-hidden="true">
            <span>{isSidebarCollapsed ? ">" : "<"}</span>
            <span>{isSidebarCollapsed ? ">" : "<"}</span>
          </span>
        </button>
        <div className="brand">
          <strong>MCP Registry</strong>
          <span>CAD/Revit 연결 관리자</span>
        </div>
        {sidebarSections.map((section) => (
          <button
            key={section.id}
            className={section.id === activeSidebarSection ? "navItem active" : "navItem"}
            onClick={() => setActiveSidebarSection(section.id)}
          >
            <span className="navShort">{section.shortLabel}</span>
            <span className="navFull">{section.label}</span>
          </button>
        ))}
        <button
          className="sidebarSettingsButton"
          aria-label={`${registryWorkspaceTab.label} 열기`}
          title={`${registryWorkspaceTab.label} 열기`}
          onClick={() => setIsRegistryDialogOpen(true)}
        >
          <span className="navShort" aria-hidden="true">
            ☰
          </span>
          <span className="navFull">
            <span aria-hidden="true">☰</span>
            <span>Settings</span>
          </span>
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{topbarTitle(activeTab, activeSidebarSection)}</h1>
            <p>{topbarSubtitle(activeTab, activeSidebarSection)}</p>
          </div>
          <div className="topActions">
            <button>상태 새로고침</button>
            <button className="primary">서버 추가</button>
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
              <button className="dialogCloseButton" onClick={() => setIsRegistryDialogOpen(false)}>
                닫기
              </button>
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
          <span>CAD Bridge</span>
          <strong>확인 전</strong>
          <p>AutoCAD MCP 포트 5100 상태를 확인합니다.</p>
        </div>
        <div className="panel monitorTile">
          <span>Revit Bridge</span>
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

function topbarTitle(tabId: WorkspaceTabId, sectionId: SidebarSectionId) {
  if (sectionId === "workflow") {
    return "CAD ↔ Revit 작업 흐름";
  }

  if (sectionId === "monitor") {
    return "Process Monitor";
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
    return "MCP Bridge 실행 상태와 작업 로그를 확인합니다.";
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
