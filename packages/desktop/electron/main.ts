import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { getWindowModeSize } from "../src/windowMode";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const normalSize = getWindowModeSize(false);
  mainWindow = new BrowserWindow({
    width: normalSize.width,
    height: normalSize.height,
    minWidth: 980,
    minHeight: 640,
    webPreferences: {
      preload: join(__dirname, "preload.js")
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
}

ipcMain.handle("window:set-compact-mode", (_event, enabled: boolean) => {
  if (!mainWindow) {
    return;
  }

  const size = getWindowModeSize(enabled);
  mainWindow.setMinimumSize(enabled ? 390 : 980, enabled ? 640 : 640);
  mainWindow.setSize(size.width, size.height, true);
});

void app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
