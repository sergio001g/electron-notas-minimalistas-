const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const appDisplayName = "NOTEMA";
const notesFolderName = "NOTEMA";
const legacyNotesFolderName = "MinimalNotePad";

let isQuitting = false;
const dirtyByWebContentsId = new Map();
let mainWindowRef = null;

const ensureNotesDir = () => {
  const documentsDir = app.getPath("documents");
  const notesDir = path.join(documentsDir, notesFolderName);
  const legacyDir = path.join(documentsDir, legacyNotesFolderName);

  if (!fs.existsSync(notesDir) && fs.existsSync(legacyDir)) {
    try {
      fs.renameSync(legacyDir, notesDir);
    } catch {}
  }
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

const resolveNotesPath = (notesDir, fileName) => {
  if (!fileName || fileName.includes("..")) {
    return null;
  }
  const resolved = path.resolve(notesDir, fileName);
  const resolvedDir = path.resolve(notesDir) + path.sep;
  if (!resolved.startsWith(resolvedDir)) {
    return null;
  }
  return resolved;
};

app.disableHardwareAcceleration();

const createSplashWindow = () => {
  const splash = new BrowserWindow({
    width: 420,
    height: 260,
    backgroundColor: "#00000000",
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${appDisplayName}</title>
  <style>
    html,body{height:100%;margin:0;background:transparent;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;overflow:hidden}
    .wrap{height:100%;display:flex;align-items:center;justify-content:center;position:relative}
    .wrap::before{content:"";position:absolute;inset:-40px;background:radial-gradient(closest-side at 50% 50%, rgba(255,255,255,.10), rgba(0,0,0,0) 60%);filter:blur(10px);opacity:.9}
    .mark{position:relative;display:flex;align-items:baseline;gap:6px;letter-spacing:.26em;text-transform:uppercase;text-shadow:0 10px 30px rgba(0,0,0,.6)}
    .n{font-weight:800;font-size:54px;line-height:1;opacity:0;transform:scale(.92);animation:nIn .55s ease-out forwards}
    .rest{font-weight:700;font-size:22px;line-height:1;opacity:0;transform:translateX(-12px);animation:restIn .6s cubic-bezier(.2,.9,.2,1) forwards;animation-delay:.45s}
    .sub{position:absolute;bottom:44px;left:0;right:0;text-align:center;font-size:12px;letter-spacing:.12em;color:rgba(255,255,255,.60);opacity:0;animation:subIn .55s ease-out forwards;animation-delay:.85s}
    @keyframes nIn{to{opacity:1;transform:scale(1)}}
    @keyframes restIn{to{opacity:1;transform:translateX(0)}}
    @keyframes subIn{to{opacity:1}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="mark">
      <div class="n">N</div>
      <div class="rest">OTEMA</div>
    </div>
    <div class="sub">cargando…</div>
  </div>
</body>
</html>`;

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return splash;
};

const createWindow = () => {
  const splashWindow = createSplashWindow();
  const minSplashMs = 1100;
  let splashShownAt = null;
  let mainReady = false;

  const showSplash = () => {
    if (splashWindow.isDestroyed()) return;
    if (splashShownAt !== null) return;
    splashWindow.show();
    splashShownAt = Date.now();
  };

  const showMain = () => {
    if (mainWindow.isDestroyed()) return;
    mainWindow.maximize();
    mainWindow.show();
    mainWindow.focus();
  };

  const finishStartup = () => {
    if (!mainReady) return;
    showSplash();
    const elapsed = splashShownAt ? Date.now() - splashShownAt : 0;
    const waitMs = Math.max(0, minSplashMs - elapsed);
    setTimeout(() => {
      if (!splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      showMain();
    }, waitMs);
  };

  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#050505",
    show: false,
    title: appDisplayName,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindowRef = mainWindow;

  mainWindow.removeMenu();
  splashWindow.once("ready-to-show", () => showSplash());
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainReady = true;
    finishStartup();
  });

  mainWindow.webContents.on("render-process-gone", () => {
    if (!mainWindow.isDestroyed() && !isQuitting) {
      mainWindow.reload();
    }
  });

  mainWindow.on("close", async (e) => {
    if (isQuitting) return;
    const dirty = !!dirtyByWebContentsId.get(mainWindow.webContents.id);
    if (!dirty) return;

    e.preventDefault();
    const result = await dialog.showMessageBox(mainWindow, {
      type: "question",
      title: appDisplayName,
      message: "Tienes cambios sin guardar.",
      detail: "¿Quieres salir de todos modos?",
      buttons: ["Salir", "Cancelar"],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    });

    if (result.response === 0) {
      isQuitting = true;
      app.quit();
    }
  });

  mainWindow.on("closed", () => {
    if (mainWindowRef === mainWindow) {
      mainWindowRef = null;
    }
  });
};

app.whenReady().then(() => {
  app.setName(appDisplayName);
  if (process.platform === "win32") {
    app.setAppUserModelId(appDisplayName);
  }
  try {
    const defaultUserDataDir = app.getPath("userData");
    fs.mkdirSync(defaultUserDataDir, { recursive: true });
    fs.accessSync(defaultUserDataDir, fs.constants.W_OK);
  } catch {
    const fallbackUserDataDir = path.join(app.getPath("documents"), notesFolderName, ".userData");
    try {
      fs.mkdirSync(fallbackUserDataDir, { recursive: true });
      app.setPath("userData", fallbackUserDataDir);
    } catch {}
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.on("app:setDirty", (event, payload) => {
  dirtyByWebContentsId.set(event.sender.id, !!payload?.isDirty);
});

ipcMain.handle("window:minimize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.minimize();
  }
});

ipcMain.handle("window:toggleMaximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return { ok: false };
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
  return { ok: true, maximized: win.isMaximized() };
});

ipcMain.handle("window:isMaximized", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return !!win && !win.isDestroyed() && win.isMaximized();
});

ipcMain.handle("window:close", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.close();
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

ipcMain.handle("notes:openByName", async (_event, payload) => {
  try {
    const notesDir = ensureNotesDir();
    const normalized = normalizeFileName(payload?.fileName);
    if (!normalized) {
      return { ok: false, message: "Nombre inválido" };
    }
    const filePath = resolveNotesPath(notesDir, normalized);
    if (!filePath) {
      return { ok: false, message: "Nombre inválido" };
    }
    const content = await fs.promises.readFile(filePath, "utf-8");
    return { ok: true, fileName: normalized, content };
  } catch (error) {
    return { ok: false, message: "No se pudo abrir" };
  }
});

ipcMain.handle("notes:list", async () => {
  try {
    const notesDir = ensureNotesDir();
    const entries = await fs.promises.readdir(notesDir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".txt"))
      .map((e) => e.name);

    const stats = await Promise.all(
      files.map(async (fileName) => {
        const filePath = resolveNotesPath(notesDir, fileName);
        if (!filePath) return null;
        const stat = await fs.promises.stat(filePath);
        return { fileName, modifiedAt: stat.mtimeMs };
      })
    );

    const sorted = stats
      .filter(Boolean)
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
      .slice(0, 50);

    return { ok: true, notes: sorted };
  } catch (error) {
    return { ok: false, message: "No se pudo listar" };
  }
});
