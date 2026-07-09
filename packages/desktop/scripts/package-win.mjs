import { copyFile, cp, mkdir, readdir, rename, rm, utimes, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, "..");
const repoRoot = resolve(desktopDir, "..", "..");
const electronDist = join(desktopDir, "node_modules", "electron", "dist");
const releaseDir = join(repoRoot, "release");
const appName = "AI_PROGRAM";
const packageDir = join(releaseDir, `${appName}-win32-x64`);
const appDir = join(packageDir, "resources", "app");

async function copyToolMarkdownFiles() {
  const toolsDir = join(repoRoot, "tools");
  const packagedToolsDir = join(appDir, "tools");
  await mkdir(packagedToolsDir, { recursive: true });

  const entries = await readdir(toolsDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => copyFile(join(toolsDir, entry.name), join(packagedToolsDir, entry.name)))
  );
}

await rm(packageDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });
await cp(electronDist, packageDir, { recursive: true });
await rename(join(packageDir, "electron.exe"), join(packageDir, `${appName}.exe`));
await utimes(join(packageDir, `${appName}.exe`), new Date(), new Date());

await mkdir(appDir, { recursive: true });
await cp(join(desktopDir, "dist"), join(appDir, "dist"), { recursive: true });
await cp(join(desktopDir, "dist-electron"), join(appDir, "dist-electron"), { recursive: true });
await cp(join(desktopDir, "assets"), join(appDir, "assets"), { recursive: true });
await cp(join(repoRoot, "data"), join(appDir, "data"), { recursive: true });
await copyToolMarkdownFiles();
await cp(join(repoRoot, "tools", "mcp-bridges"), join(appDir, "tools", "mcp-bridges"), {
  recursive: true
});
await writeFile(
  join(appDir, "package.json"),
  `${JSON.stringify(
    {
      name: "ai-program",
      version: "0.1.0",
      type: "module",
      main: "dist-electron/main.cjs"
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(`Created ${join(packageDir, `${appName}.exe`)}`);
