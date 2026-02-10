const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const notesFolderName = "MinimalNotePad";

const ensureNotesDir = () => {
  const notesDir = path.join(app.getPath("documents"), notesFolderName);
  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir, { recursive: true });
  }
  return notesDir;
};

const normalizeFileName = (name) => {
  const base = (name || "").trim().replace(/[\\/:*?"<>|]/g, "");
  if (!base) {
    return null;
  }
  return base.endsWith(".txt") ? base : `${base}.txt`;
};

app.disableHardwareAcceleration();

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#050505",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.maximize();
  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.webContents.on("render-process-gone", () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("notes:save", async (_event, payload) => {
  try {
    const notesDir = ensureNotesDir();
    const fileName = normalizeFileName(payload?.name);
    if (!fileName) {
      return { ok: false, message: "Nombre inválido" };
    }
    const filePath = path.join(notesDir, fileName);
    await fs.promises.writeFile(filePath, payload?.content ?? "", "utf-8");
    return { ok: true, fileName };
  } catch (error) {
    return { ok: false, message: "No se pudo guardar" };
  }
});

ipcMain.handle("notes:open", async () => {
  try {
    const notesDir = ensureNotesDir();
    const result = await dialog.showOpenDialog({
      title: "Abrir nota",
      defaultPath: notesDir,
      filters: [{ name: "Notas", extensions: ["txt"] }],
      properties: ["openFile"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const content = await fs.promises.readFile(filePath, "utf-8");
    return { ok: true, fileName: path.basename(filePath), content };
  } catch (error) {
    return { ok: false, message: "No se pudo abrir" };
  }
});
