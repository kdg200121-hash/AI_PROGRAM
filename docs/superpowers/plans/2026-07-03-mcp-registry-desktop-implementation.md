# MCP Registry Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CAD와 Revit 연결 정보를 한 곳에서 등록하고 상태를 확인하는 Electron 데스크톱 앱을 만든다.

**Architecture:** 핵심 저장/검증 로직은 `packages/core`에 두고, 화면은 `packages/desktop`의 Electron + React 앱에서 사용한다. 공통 데이터 모양은 `packages/shared`에 둬서 나중에 웹 대시보드도 같은 구조를 재사용할 수 있게 한다.

**Tech Stack:** TypeScript, Electron, React, Vite, Vitest, JSON file storage, Figma

---

## 파일 구조

- Create: `package.json` - 전체 작업공간 실행 명령을 관리한다.
- Create: `pnpm-workspace.yaml` - `packages/*`를 하나의 작업공간으로 묶는다.
- Create: `tsconfig.base.json` - 공통 TypeScript 설정이다.
- Create: `vitest.config.ts` - 테스트 실행 설정이다.
- Create: `data/registry.json` - 개발 중 사용할 예시 연결 목록이다.
- Create: `packages/shared/package.json` - 공통 타입 패키지 설정이다.
- Create: `packages/shared/src/index.ts` - CAD/Revit 연결 정보의 공통 타입을 정의한다.
- Create: `packages/core/package.json` - 저장/검증 로직 패키지 설정이다.
- Create: `packages/core/src/registryStore.ts` - 연결 목록을 JSON 파일에 저장하고 불러온다.
- Create: `packages/core/src/connectionStatus.ts` - 포트와 URL 상태를 확인한다.
- Create: `packages/core/src/validation.ts` - 입력값이 올바른지 검사한다.
- Create: `packages/core/src/index.ts` - core 기능을 한 곳에서 내보낸다.
- Create: `packages/core/src/__tests__/registryStore.test.ts` - 저장/수정/삭제 테스트다.
- Create: `packages/core/src/__tests__/validation.test.ts` - 입력값 검사 테스트다.
- Create: `packages/core/src/__tests__/connectionStatus.test.ts` - 포트 확인 테스트다.
- Create: `packages/desktop/package.json` - Electron 앱 패키지 설정이다.
- Create: `packages/desktop/electron/main.ts` - Windows 데스크톱 창을 연다.
- Create: `packages/desktop/electron/preload.ts` - 화면에서 안전하게 core 기능을 호출하게 한다.
- Create: `packages/desktop/index.html` - 앱 화면의 HTML 진입점이다.
- Create: `packages/desktop/src/main.tsx` - React 앱 진입점이다.
- Create: `packages/desktop/src/App.tsx` - 메인 화면 구성이다.
- Create: `packages/desktop/src/styles.css` - 화면 스타일이다.
- Create: `packages/desktop/src/types.ts` - 화면 쪽 타입 보조 파일이다.

## Task 1: Figma 화면 초안 만들기

**Files:**
- Create or update: Figma design file
- Reference: `electron-desktop-app-example.html`
- Reference: `docs/superpowers/specs/2026-07-03-mcp-registry-desktop-design.md`

- [ ] **Step 1: Figma 파일 준비**

사용자가 기존 Figma 파일 링크를 주면 그 파일을 사용한다. 기존 파일이 없으면 Figma 앱에서 새 디자인 파일을 만든다.

파일 이름:

```text
MCP Registry Desktop
```

- [ ] **Step 2: 첫 화면에 들어갈 요소 확정**

Figma 화면에는 아래 항목을 배치한다.

```text
왼쪽 메뉴:
- MCP Servers
- CAD to Revit
- Process Monitor
- Settings

상단:
- CAD/Revit MCP 연결 관리자
- 상태 새로고침
- 서버 추가

중앙:
- Revit MCP Bridge
- AutoCAD MCP Bridge
- 대상 프로그램
- 포트 또는 URL
- 상태

오른쪽:
- 선택한 서버 상세
- 실행 명령
- 작업 폴더
- 메모
- 실행
- 중지
```

- [ ] **Step 3: Figma에 메인 대시보드 프레임 생성**

Figma 프레임 크기:

```text
1200 x 760
```

프레임 이름:

```text
Desktop Dashboard - First Version
```

- [ ] **Step 4: 사용자에게 Figma 화면 확인 받기**

확인 질문:

```text
이 화면 구조로 실제 앱을 만들겠습니다. 왼쪽 메뉴, 중앙 목록, 오른쪽 상세 정보 배치가 괜찮을까요?
```

Expected: 사용자가 화면 구조를 승인하거나 수정 의견을 준다.

- [ ] **Step 5: 승인된 화면 기준으로 커밋**

```bash
git add docs/superpowers/plans/2026-07-03-mcp-registry-desktop-implementation.md
git commit -m "Add MCP registry implementation plan"
```

Expected: 계획 문서가 커밋된다.

## Task 2: TypeScript 작업공간 만들기

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: 루트 패키지 설정 파일 작성**

`package.json`:

```json
{
  "name": "mcp-registry-desktop",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "pnpm --filter @mcp-registry/desktop dev",
    "build": "pnpm -r build",
    "test": "vitest run",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: 작업공간 파일 작성**

`pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: TypeScript 공통 설정 작성**

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 4: 테스트 설정 작성**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts"],
    environment: "node"
  }
});
```

- [ ] **Step 5: 의존성 설치**

Run:

```bash
pnpm install
```

Expected: `node_modules`와 `pnpm-lock.yaml`이 생성된다.

- [ ] **Step 6: 커밋**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json vitest.config.ts pnpm-lock.yaml
git commit -m "Set up TypeScript workspace"
```

Expected: 작업공간 설정이 커밋된다.

## Task 3: 공통 데이터 모양 만들기

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: shared 패키지 설정 작성**

`packages/shared/package.json`:

```json
{
  "name": "@mcp-registry/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: shared TypeScript 설정 작성**

`packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 공통 타입 작성**

`packages/shared/src/index.ts`:

```ts
export type McpTarget = "cad" | "revit";

export type McpConnectionType = "stdio" | "http" | "sse";

export type McpStatus = "unknown" | "running" | "stopped" | "error";

export interface McpServerRecord {
  id: string;
  name: string;
  target: McpTarget;
  connectionType: McpConnectionType;
  url: string;
  port: number | null;
  launchCommand: string;
  workingDirectory: string;
  environment: Record<string, string>;
  status: McpStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegistryFile {
  version: 1;
  servers: McpServerRecord[];
}
```

- [ ] **Step 4: 타입 검사**

Run:

```bash
pnpm --filter @mcp-registry/shared typecheck
```

Expected: 오류 없이 종료된다.

- [ ] **Step 5: 커밋**

```bash
git add packages/shared
git commit -m "Add shared MCP registry types"
```

Expected: 공통 타입이 커밋된다.

## Task 4: 저장소 기능 만들기

**Files:**
- Create: `data/registry.json`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/registryStore.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/__tests__/registryStore.test.ts`

- [ ] **Step 1: 실패하는 저장소 테스트 작성**

`packages/core/src/__tests__/registryStore.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addServer,
  deleteServer,
  loadRegistry,
  updateServer
} from "../registryStore";

let testDir = "";
let registryPath = "";

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "mcp-registry-"));
  registryPath = join(testDir, "registry.json");
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("registryStore", () => {
  it("creates an empty registry when the file does not exist", async () => {
    const registry = await loadRegistry(registryPath);

    expect(registry).toEqual({ version: 1, servers: [] });
  });

  it("adds, updates, and deletes a server", async () => {
    const added = await addServer(registryPath, {
      name: "Revit MCP Bridge",
      target: "revit",
      connectionType: "http",
      url: "http://localhost:5001/mcp",
      port: 5001,
      launchCommand: "revit-mcp-bridge.exe",
      workingDirectory: "C:\\Tools\\RevitMcpBridge",
      environment: {},
      notes: "Revit 2025 bridge"
    });

    expect(added.servers).toHaveLength(1);
    expect(added.servers[0].id).toBeTruthy();
    expect(added.servers[0].status).toBe("unknown");

    const updated = await updateServer(registryPath, added.servers[0].id, {
      notes: "Updated note"
    });

    expect(updated.servers[0].notes).toBe("Updated note");

    const deleted = await deleteServer(registryPath, added.servers[0].id);

    expect(deleted.servers).toHaveLength(0);

    const fileContent = JSON.parse(await readFile(registryPath, "utf8"));
    expect(fileContent).toEqual({ version: 1, servers: [] });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run:

```bash
pnpm test packages/core/src/__tests__/registryStore.test.ts
```

Expected: `Cannot find module '../registryStore'` 오류로 실패한다.

- [ ] **Step 3: core 패키지 설정 작성**

`packages/core/package.json`:

```json
{
  "name": "@mcp-registry/core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@mcp-registry/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

`packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: 저장소 기능 구현**

`packages/core/src/registryStore.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { McpServerRecord, RegistryFile } from "@mcp-registry/shared";

export type NewMcpServerInput = Omit<
  McpServerRecord,
  "id" | "status" | "createdAt" | "updatedAt"
>;

export type UpdateMcpServerInput = Partial<NewMcpServerInput> & {
  status?: McpServerRecord["status"];
};

const emptyRegistry = (): RegistryFile => ({ version: 1, servers: [] });

export async function loadRegistry(path: string): Promise<RegistryFile> {
  try {
    const content = await readFile(path, "utf8");
    const parsed = JSON.parse(content) as RegistryFile;
    return {
      version: 1,
      servers: Array.isArray(parsed.servers) ? parsed.servers : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyRegistry();
    }
    throw error;
  }
}

export async function saveRegistry(path: string, registry: RegistryFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

export async function addServer(
  path: string,
  input: NewMcpServerInput
): Promise<RegistryFile> {
  const registry = await loadRegistry(path);
  const now = new Date().toISOString();
  const server: McpServerRecord = {
    ...input,
    id: crypto.randomUUID(),
    status: "unknown",
    createdAt: now,
    updatedAt: now
  };
  const next = { ...registry, servers: [...registry.servers, server] };
  await saveRegistry(path, next);
  return next;
}

export async function updateServer(
  path: string,
  id: string,
  input: UpdateMcpServerInput
): Promise<RegistryFile> {
  const registry = await loadRegistry(path);
  const next = {
    ...registry,
    servers: registry.servers.map((server) =>
      server.id === id
        ? { ...server, ...input, id: server.id, updatedAt: new Date().toISOString() }
        : server
    )
  };
  await saveRegistry(path, next);
  return next;
}

export async function deleteServer(path: string, id: string): Promise<RegistryFile> {
  const registry = await loadRegistry(path);
  const next = {
    ...registry,
    servers: registry.servers.filter((server) => server.id !== id)
  };
  await saveRegistry(path, next);
  return next;
}
```

`packages/core/src/index.ts`:

```ts
export * from "./registryStore";
```

- [ ] **Step 5: 개발용 예시 데이터 작성**

`data/registry.json`:

```json
{
  "version": 1,
  "servers": [
    {
      "id": "revit-default",
      "name": "Revit MCP Bridge",
      "target": "revit",
      "connectionType": "http",
      "url": "http://localhost:5001/mcp",
      "port": 5001,
      "launchCommand": "revit-mcp-bridge.exe",
      "workingDirectory": "C:\\Tools\\RevitMcpBridge",
      "environment": {},
      "status": "unknown",
      "notes": "Revit connection placeholder for the first version",
      "createdAt": "2026-07-03T00:00:00.000Z",
      "updatedAt": "2026-07-03T00:00:00.000Z"
    },
    {
      "id": "cad-default",
      "name": "AutoCAD MCP Bridge",
      "target": "cad",
      "connectionType": "http",
      "url": "http://localhost:5100/mcp",
      "port": 5100,
      "launchCommand": "acad-mcp-server.exe",
      "workingDirectory": "C:\\Tools\\AutoCadMcpBridge",
      "environment": {},
      "status": "unknown",
      "notes": "CAD connection placeholder for the first version",
      "createdAt": "2026-07-03T00:00:00.000Z",
      "updatedAt": "2026-07-03T00:00:00.000Z"
    }
  ]
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run:

```bash
pnpm test packages/core/src/__tests__/registryStore.test.ts
```

Expected: `2 passed`

- [ ] **Step 7: 커밋**

```bash
git add data packages/core
git commit -m "Add MCP registry storage"
```

Expected: 저장소 기능이 커밋된다.

## Task 5: 입력값 검사 만들기

**Files:**
- Create: `packages/core/src/validation.ts`
- Create: `packages/core/src/__tests__/validation.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: 실패하는 검사 테스트 작성**

`packages/core/src/__tests__/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateServerInput } from "../validation";

describe("validateServerInput", () => {
  it("accepts a valid Revit HTTP connection", () => {
    const result = validateServerInput({
      name: "Revit MCP Bridge",
      target: "revit",
      connectionType: "http",
      url: "http://localhost:5001/mcp",
      port: 5001,
      launchCommand: "revit-mcp-bridge.exe",
      workingDirectory: "C:\\Tools\\RevitMcpBridge",
      environment: {},
      notes: ""
    });

    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("returns simple Korean messages for invalid input", () => {
    const result = validateServerInput({
      name: "",
      target: "cad",
      connectionType: "http",
      url: "not-a-url",
      port: 70000,
      launchCommand: "",
      workingDirectory: "",
      environment: {},
      notes: ""
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("서버 이름을 입력해야 합니다.");
    expect(result.errors).toContain("URL 형식이 올바르지 않습니다.");
    expect(result.errors).toContain("포트는 1부터 65535 사이여야 합니다.");
    expect(result.errors).toContain("실행 명령을 입력해야 합니다.");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run:

```bash
pnpm test packages/core/src/__tests__/validation.test.ts
```

Expected: `Cannot find module '../validation'` 오류로 실패한다.

- [ ] **Step 3: 검사 기능 구현**

`packages/core/src/validation.ts`:

```ts
import type { NewMcpServerInput } from "./registryStore";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateServerInput(input: NewMcpServerInput): ValidationResult {
  const errors: string[] = [];

  if (!input.name.trim()) {
    errors.push("서버 이름을 입력해야 합니다.");
  }

  if (input.connectionType !== "stdio") {
    try {
      new URL(input.url);
    } catch {
      errors.push("URL 형식이 올바르지 않습니다.");
    }
  }

  if (input.port !== null && (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535)) {
    errors.push("포트는 1부터 65535 사이여야 합니다.");
  }

  if (!input.launchCommand.trim()) {
    errors.push("실행 명령을 입력해야 합니다.");
  }

  return { ok: errors.length === 0, errors };
}
```

`packages/core/src/index.ts`:

```ts
export * from "./connectionStatus";
export * from "./registryStore";
export * from "./validation";
```

- [ ] **Step 4: 테스트 통과 확인**

Run:

```bash
pnpm test packages/core/src/__tests__/validation.test.ts
```

Expected: `2 passed`

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/validation.ts packages/core/src/index.ts packages/core/src/__tests__/validation.test.ts
git commit -m "Add MCP server validation"
```

Expected: 입력값 검사 기능이 커밋된다.

## Task 6: 연결 상태 확인 만들기

**Files:**
- Create: `packages/core/src/connectionStatus.ts`
- Create: `packages/core/src/__tests__/connectionStatus.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: 실패하는 포트 상태 테스트 작성**

`packages/core/src/__tests__/connectionStatus.test.ts`:

```ts
import { createServer, type Server } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { checkPortStatus } from "../connectionStatus";

let server: Server | null = null;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
  }
});

describe("checkPortStatus", () => {
  it("reports running when a port is open", async () => {
    server = createServer();
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    await expect(checkPortStatus(port)).resolves.toBe("running");
  });

  it("reports stopped when a port is closed", async () => {
    await expect(checkPortStatus(9)).resolves.toBe("stopped");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run:

```bash
pnpm test packages/core/src/__tests__/connectionStatus.test.ts
```

Expected: `Cannot find module '../connectionStatus'` 오류로 실패한다.

- [ ] **Step 3: 포트 상태 확인 구현**

`packages/core/src/connectionStatus.ts`:

```ts
import { Socket } from "node:net";
import type { McpStatus } from "@mcp-registry/shared";

export function checkPortStatus(port: number, host = "127.0.0.1", timeoutMs = 600): Promise<McpStatus> {
  return new Promise((resolve) => {
    const socket = new Socket();
    let settled = false;

    const finish = (status: McpStatus) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(status);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish("running"));
    socket.once("timeout", () => finish("stopped"));
    socket.once("error", () => finish("stopped"));
    socket.connect(port, host);
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:

```bash
pnpm test packages/core/src/__tests__/connectionStatus.test.ts
```

Expected: `2 passed`

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/connectionStatus.ts packages/core/src/index.ts packages/core/src/__tests__/connectionStatus.test.ts
git commit -m "Add MCP connection status checks"
```

Expected: 상태 확인 기능이 커밋된다.

## Task 7: Electron 데스크톱 앱 만들기

**Files:**
- Create: `packages/desktop/package.json`
- Create: `packages/desktop/tsconfig.json`
- Create: `packages/desktop/vite.config.ts`
- Create: `packages/desktop/index.html`
- Create: `packages/desktop/electron/main.ts`
- Create: `packages/desktop/electron/preload.ts`
- Create: `packages/desktop/src/types.ts`
- Create: `packages/desktop/src/main.tsx`
- Create: `packages/desktop/src/App.tsx`
- Create: `packages/desktop/src/styles.css`

- [ ] **Step 1: desktop 패키지 설정 작성**

`packages/desktop/package.json`:

```json
{
  "name": "@mcp-registry/desktop",
  "version": "0.1.0",
  "type": "module",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -p tsconfig.json && vite build",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@mcp-registry/core": "workspace:*",
    "@mcp-registry/shared": "workspace:*",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^33.0.0",
    "vite": "^5.4.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: desktop TypeScript와 Vite 설정 작성**

`packages/desktop/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src", "electron", "vite.config.ts"]
}
```

`packages/desktop/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});
```

- [ ] **Step 3: Electron 창 파일 작성**

`packages/desktop/electron/main.ts`:

```ts
import { app, BrowserWindow } from "electron";
import { join } from "node:path";

function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    webPreferences: {
      preload: join(__dirname, "preload.js")
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(join(__dirname, "../dist/index.html"));
  }
}

void app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
```

`packages/desktop/electron/preload.ts`:

```ts
import { contextBridge } from "electron";
import type { RegistryFile } from "@mcp-registry/shared";

const initialRegistry: RegistryFile = {
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
      notes: "Revit 연결 자리",
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
      notes: "CAD 연결 자리",
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z"
    }
  ]
};

contextBridge.exposeInMainWorld("mcpRegistry", {
  loadRegistry: async () => initialRegistry
});
```

- [ ] **Step 4: 화면 진입 파일 작성**

`packages/desktop/index.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MCP Registry</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`packages/desktop/src/types.ts`:

```ts
import type { RegistryFile } from "@mcp-registry/shared";

declare global {
  interface Window {
    mcpRegistry: {
      loadRegistry: () => Promise<RegistryFile>;
    };
  }
}
```

`packages/desktop/src/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./types";
import { App } from "./App";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: 메인 화면 작성**

`packages/desktop/src/App.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import type { McpServerRecord, RegistryFile } from "@mcp-registry/shared";

const emptyRegistry: RegistryFile = { version: 1, servers: [] };

export function App() {
  const [registry, setRegistry] = useState<RegistryFile>(emptyRegistry);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    void window.mcpRegistry.loadRegistry().then((next) => {
      setRegistry(next);
      setSelectedId(next.servers[0]?.id ?? "");
    });
  }, []);

  const selected = useMemo<McpServerRecord | undefined>(
    () => registry.servers.find((server) => server.id === selectedId),
    [registry.servers, selectedId]
  );

  const cadCount = registry.servers.filter((server) => server.target === "cad").length;
  const revitCount = registry.servers.filter((server) => server.target === "revit").length;
  const runningCount = registry.servers.filter((server) => server.status === "running").length;

  return (
    <div className="appShell">
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
          <h1>CAD/Revit MCP 연결 관리자</h1>
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
                {registry.servers.map((server) => (
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
                <Field label="메모" value={selected.notes} />
                <div className="buttonStack">
                  <button className="primary">실행</button>
                  <button>중지</button>
                </div>
              </div>
            ) : (
              <p className="emptyState">서버를 선택하세요.</p>
            )}
          </aside>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div>{value}</div>
    </label>
  );
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
```

- [ ] **Step 6: 스타일 작성**

`packages/desktop/src/styles.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 980px;
  min-height: 640px;
  font-family: "Segoe UI", Arial, sans-serif;
  color: #172033;
  background: #eef2f7;
}

button {
  min-height: 36px;
  border: 1px solid #c9d3e1;
  border-radius: 6px;
  background: #fff;
  color: #26364d;
  font: inherit;
}

button.primary {
  border-color: #2d5f9f;
  background: #2d5f9f;
  color: #fff;
}

.appShell {
  height: 100vh;
  display: grid;
  grid-template-columns: 248px 1fr;
}

.sidebar {
  background: #172033;
  color: #e8edf5;
  padding: 18px 14px;
}

.brand {
  padding: 8px 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  margin-bottom: 14px;
}

.brand strong,
.brand span {
  display: block;
}

.brand span {
  margin-top: 4px;
  color: #aeb9ca;
  font-size: 12px;
}

.navItem {
  width: 100%;
  margin-bottom: 6px;
  border: 0;
  text-align: left;
  background: transparent;
  color: #c8d1df;
}

.navItem.active {
  background: #2d5f9f;
  color: #fff;
}

.main {
  display: grid;
  grid-template-rows: 64px auto 1fr;
  min-width: 0;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px;
  background: #fff;
  border-bottom: 1px solid #dde4ee;
}

.topbar h1 {
  margin: 0;
  font-size: 20px;
}

.topActions {
  display: flex;
  gap: 8px;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px 22px;
}

.metric,
.panel {
  border: 1px solid #dde4ee;
  border-radius: 8px;
  background: #fff;
}

.metric {
  padding: 14px;
}

.metric span {
  display: block;
  color: #617086;
  font-size: 12px;
}

.metric strong {
  display: block;
  margin-top: 8px;
  font-size: 24px;
}

.contentGrid {
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 330px;
  gap: 16px;
  padding: 0 22px 22px;
}

.panel {
  overflow: hidden;
}

.panelHeader {
  min-height: 48px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-bottom: 1px solid #edf1f6;
}

.panelHeader h2 {
  margin: 0;
  font-size: 15px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 12px 14px;
  border-bottom: 1px solid #edf1f6;
  text-align: left;
  white-space: nowrap;
}

th {
  color: #617086;
  font-weight: 600;
  background: #fbfcfe;
}

.selectedRow {
  background: #eef5ff;
}

.details {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.field {
  display: grid;
  gap: 5px;
}

.field span {
  color: #617086;
  font-size: 12px;
}

.field div {
  min-height: 34px;
  padding: 8px 10px;
  border: 1px solid #d9e1ec;
  border-radius: 6px;
  background: #f9fbfe;
  overflow-wrap: anywhere;
}

.buttonStack {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.emptyState {
  margin: 16px;
  color: #617086;
}
```

- [ ] **Step 7: 타입 검사**

Run:

```bash
pnpm --filter @mcp-registry/desktop typecheck
```

Expected: 오류 없이 종료된다.

- [ ] **Step 8: 커밋**

```bash
git add packages/desktop
git commit -m "Add Electron desktop dashboard"
```

Expected: 데스크톱 앱 화면이 커밋된다.

## Task 8: 전체 검증과 실행 안내

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 작성**

`README.md`:

```md
# MCP Registry Desktop

CAD와 Revit의 MCP 연결 정보를 한 곳에서 관리하는 Windows 데스크톱 앱입니다.

## 첫 버전에서 되는 일

- CAD 연결 등록 구조 확인
- Revit 연결 등록 구조 확인
- 연결 목록 보기
- 선택한 연결 상세 보기
- 나중에 CAD에서 정보를 읽어 Revit에서 실행하는 흐름을 붙일 수 있는 자리 제공

## 실행

```bash
pnpm install
pnpm dev
```

## 테스트

```bash
pnpm test
pnpm typecheck
```

## 저장 위치

개발 중에는 `data/registry.json`을 사용합니다.
실사용 버전에서는 Windows 사용자 앱 데이터 폴더로 옮깁니다.
```

- [ ] **Step 2: 전체 테스트 실행**

Run:

```bash
pnpm test
```

Expected: 모든 테스트가 통과한다.

- [ ] **Step 3: 전체 타입 검사 실행**

Run:

```bash
pnpm typecheck
```

Expected: 타입 오류 없이 종료된다.

- [ ] **Step 4: 개발 서버 실행**

Run:

```bash
pnpm dev
```

Expected: Vite 개발 서버가 `http://127.0.0.1:5173`에서 열린다. Electron 창 실행은 별도 스크립트 보강이 필요하면 다음 작업으로 분리한다.

- [ ] **Step 5: 커밋**

```bash
git add README.md
git commit -m "Document MCP registry desktop app"
```

Expected: 실행 안내가 커밋된다.

## Self-Review

- Spec coverage: CAD 연결, Revit 연결, 동시 관리, Electron 데스크톱 앱, Figma 디자인 단계, JSON 저장, 상태 확인, 향후 CAD-to-Revit 작업 공간을 모두 작업에 포함했다.
- Placeholder scan: 구현 지시에서 빈 자리로 남긴 코드 블록은 없다. 실제 CAD 객체 추출과 Revit 모델 생성은 1차 범위가 아니므로 작업에 넣지 않았다.
- Type consistency: `McpServerRecord`, `RegistryFile`, `McpStatus`, `NewMcpServerInput` 이름은 작업 전체에서 같은 의미로 사용한다.
