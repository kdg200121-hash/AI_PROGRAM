import type { ProcessLogEntry, ProcessState } from "./processMonitor";

interface MonitorViewProps {
  runningCount: number;
  totalCount: number;
  processes: ProcessState[];
  logs: ProcessLogEntry[];
}

function newestLogs(logs: ProcessLogEntry[]) {
  return [...logs].slice(-60).reverse();
}

export function MonitorView({ runningCount, totalCount, processes, logs }: MonitorViewProps) {
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
          <span>등록 서버</span>
          <strong>{processes.length}</strong>
          <p>Settings의 서버 목록에서 선택한 MCP 서버를 실행하거나 중지할 수 있습니다.</p>
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
            <p>
              <strong>수집된 로그 없음</strong>
              <span>MCP 서버를 실행하면 이 영역에 실행 로그가 표시됩니다.</span>
            </p>
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
