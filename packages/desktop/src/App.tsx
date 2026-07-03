import { useEffect, useMemo, useState } from "react";
import type { McpServerRecord, RegistryFile } from "@mcp-registry/shared";
import { getConnectionSummary } from "./connectionSummary";
import { getToolsForWorkspace } from "./mcpToolCatalog";
import {
  filterServersByWorkspace,
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
      notes: "CAD 연결 자리입니다. 도면 정보를 읽는 기능이 이후 단계에 연결됩니다.",
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z"
    }
  ]
};

export function App() {
  const [registry, setRegistry] = useState<RegistryFile>(fallbackRegistry);
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>("registry");
  const [selectedId, setSelectedId] = useState<string>("revit-default");
  const [isCompact, setIsCompact] = useState(false);

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

  return (
    <div className={isCompact ? "appShell compactMode" : "appShell"}>
      <nav className="workspaceTabs" aria-label="작업 영역 선택">
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
        <div className="topUtility">
          <button className="compactButton" onClick={toggleCompactMode}>
            {isCompact ? "기본 보기" : "간소화"}
          </button>
          <div className="connectionBadge">
            <span className={`statusDot ${connectionSummary.tone}`} />
            <span>{connectionSummary.label}</span>
          </div>
        </div>
      </nav>

      <aside className="sidebar">
        <div className="brand">
          <strong>MCP Registry</strong>
          <span>CAD/Revit 연결 관리자</span>
        </div>
        <button className="navItem active">MCP Servers</button>
        <button className="navItem">CAD to Revit</button>
        <button className="navItem">Process Monitor</button>
        <button className="navItem">Settings</button>
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
              <h3>다음 단계 자리: CAD &lt;-&gt; Revit 작업</h3>
              <p>
                CAD에서 레이어, 블록, 위치 정보를 읽고 Revit에서 벽, 장비, 패밀리 생성 작업을
                실행하는 기능을 이 영역에 추가합니다.
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
    workflow: "CAD <-> REVIT 작업 흐름"
  };
  return titles[tabId];
}

function toolPanelTitle(tabId: WorkspaceTabId) {
  const titles: Record<WorkspaceTabId, string> = {
    registry: "Registry MCP 툴",
    cad: "CAD MCP 툴",
    revit: "REVIT MCP 툴",
    workflow: "CAD <-> REVIT MCP 툴"
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
