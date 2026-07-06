import type { McpTarget } from "@mcp-registry/shared";
import type { ProcessLogEntry, ProcessState } from "./processMonitor";
import { processStatusLabel } from "./processMonitor";

interface MonitorViewProps {
  runningCount: number;
  totalCount: number;
  processes: ProcessState[];
  logs: ProcessLogEntry[];
}

function bridgeState(processes: ProcessState[], target: McpTarget) {
  return processes.find((process) => process.target === target);
}

function newestLogs(logs: ProcessLogEntry[]) {
  return [...logs].slice(-60).reverse();
}

export function MonitorView({ runningCount, totalCount, processes, logs }: MonitorViewProps) {
  const cadState = bridgeState(processes, "cad");
  const revitState = bridgeState(processes, "revit");
  const displayedLogs = newestLogs(logs);
  const errorLogs = displayedLogs.filter((log) => log.level === "stderr" || log.level === "error");

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
          <strong>{processStatusLabel(cadState?.status ?? "unknown")}</strong>
          <p>{cadState?.lastMessage ?? "AutoCAD MCP 포트 5100 상태를 확인합니다."}</p>
        </div>
        <div className="panel monitorTile">
          <span>Revit 브리지</span>
          <strong>{processStatusLabel(revitState?.status ?? "unknown")}</strong>
          <p>{revitState?.lastMessage ?? "Revit MCP 포트 5001 상태를 확인합니다."}</p>
        </div>
      </div>
      <div className="panel logPanel">
        <div className="panelHeader">
          <h2>실행 로그</h2>
        </div>
        <div className="logList">
          {displayedLogs.length > 0 ? (
            displayedLogs.map((log) => (
              <p className={`processLogItem ${log.level}`} key={log.id}>
                <strong>[{log.serverName}]</strong>
                <span>{log.message}</span>
                <small>{new Date(log.createdAt).toLocaleString()}</small>
              </p>
            ))
          ) : (
            <>
              <p>[대기] MCP 서버 상태 확인 준비</p>
              <p>[대기] CAD 화면 정보 수집 준비</p>
              <p>[대기] Revit 작업 큐 실행 준비</p>
            </>
          )}
        </div>
      </div>
      <div className="panel logPanel errorReportPanel">
        <div className="panelHeader">
          <h2>오류 리포트</h2>
        </div>
        <div className="logList">
          {errorLogs.length > 0 ? (
            errorLogs.slice(0, 8).map((log) => (
              <p className={`processLogItem ${log.level}`} key={log.id}>
                <strong>{log.serverName}</strong>
                <span>{log.message}</span>
              </p>
            ))
          ) : (
            <p>
              <strong>접수된 오류 없음</strong>
              <span>실제 MCP 실행/로그 수집 중 확인이 필요한 오류 항목이 여기에 표시됩니다.</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
