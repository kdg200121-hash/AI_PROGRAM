import { useEffect, useMemo, useState } from "react";
import type { McpServerRecord, RegistryFile } from "@mcp-registry/shared";
import { getConnectionSummary } from "./connectionSummary";
import { getToolsForWorkspace } from "./mcpToolCatalog";
import { settingsSections, type SettingsSectionId } from "./settingsDialog";
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
    isSidebarCollapsed ? "sidebarCollapsed" : ""
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
          <button
            className="registryIconButton"
            aria-label={`${registryWorkspaceTab.label} 열기`}
            title={`${registryWorkspaceTab.label} 열기`}
            onClick={() => setIsRegistryDialogOpen(true)}
          >
            ☰
          </button>
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
        <button className="navItem active">
          <span className="navShort">M</span>
          <span className="navFull">MCP Servers</span>
        </button>
        <button className="navItem">
          <span className="navShort">C</span>
          <span className="navFull">CAD ↔ Revit</span>
        </button>
        <button className="navItem">
          <span className="navShort">P</span>
          <span className="navFull">Process Monitor</span>
        </button>
        <button className="navItem">
          <span className="navShort">S</span>
          <span className="navFull">Settings</span>
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>{topbarTitle(activeTab)}</h1>
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

        <section className="contentGrid">
          <section className="panel">
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
                {visibleServers.map((server) => (
                  <tr
                    key={server.id}
                    className={server.id === selectedId ? "selectedRow" : ""}
                    onClick={() => setSelectedId(server.id)}
                  >
                    <td>{server.name}</td>
                    <td>{server.target === "cad" ? "CAD" : "Revit"}</td>
                    <td>{server.port ?? server.url}</td>
                    <td>{statusLabel(server.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="workflowHint">
              <h3>다음 단계 자리: CAD ↔ Revit 작업</h3>
              <p>
                CAD에서 레이어, 블록, 위치 정보를 읽고 Revit에서 벽, 장비, 패밀리 생성
                작업을 실행하는 기능을 이 영역에 추가합니다.
              </p>
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
              {workspaceTools.map((tool) => (
                <div className="toolItem" key={tool.name}>
                  <strong>{tool.name}</strong>
                  <span>{tool.description}</span>
                </div>
              ))}
            </div>
          </section>
        </section>
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
                      <button className={!isCompact ? "displayModeOption active" : "displayModeOption"}>
                        <strong>기본 보기</strong>
                        <span>전체 작업 화면으로 CAD, REVIT, 연결 작업을 넓게 봅니다.</span>
                      </button>
                      <button className={isCompact ? "displayModeOption active" : "displayModeOption"}>
                        <strong>간소화</strong>
                        <span>다이나모 플레이어처럼 작은 세로 창으로 줄여서 사용합니다.</span>
                      </button>
                      <button className="primary" onClick={toggleCompactMode}>
                        {isCompact ? "기본 보기로 전환" : "간소화로 전환"}
                      </button>
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

function topbarTitle(tabId: WorkspaceTabId) {
  const titles: Record<WorkspaceTabId, string> = {
    registry: "CAD/Revit MCP 연결 관리자",
    cad: "CAD MCP 연결",
    revit: "REVIT MCP 연결",
    workflow: "CAD ↔ REVIT 작업 흐름"
  };
  return titles[tabId];
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
