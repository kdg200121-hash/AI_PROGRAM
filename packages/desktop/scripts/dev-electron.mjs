import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const pnpm = isWindows ? "pnpm.cmd" : "pnpm";
const electron = isWindows ? "electron.cmd" : "electron";

const childProcesses = [];

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...options.env },
    shell: false,
    stdio: options.stdio ?? "inherit"
  });

  childProcesses.push(child);
  child.on("exit", (code) => {
    if (!options.allowExit && code !== 0) {
      shutdown(code ?? 1);
    }
  });
  return child;
}

function runAndWait(command, args) {
  return new Promise((resolve, reject) => {
    const child = run(command, args);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}.`));
    });
  });
}

function shutdown(code = 0) {
  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(code);
}

function waitForViteReady(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("Vite dev server did not start in time.")), 15000);

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
      if (output.includes("Local:")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    child.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Vite dev server exited with code ${code}.`));
    });
  });
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

try {
  await runAndWait(pnpm, ["run", "build:electron"]);
  const vite = run(
    pnpm,
    ["run", "dev:web", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
    {
      stdio: ["ignore", "pipe", "pipe"],
      allowExit: true
    }
  );
  await waitForViteReady(vite);
  run(electron, ["."], {
    env: {
      VITE_DEV_SERVER_URL: "http://127.0.0.1:5173/"
    }
  });
} catch (error) {
  console.error(error);
  shutdown(1);
}
