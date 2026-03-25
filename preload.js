const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("notesApi", {
  saveNote: (name, content) => ipcRenderer.invoke("notes:save", { name, content }),
  openNote: () => ipcRenderer.invoke("notes:open"),
  openNoteByName: (fileName) => ipcRenderer.invoke("notes:openByName", { fileName }),
  listNotes: () => ipcRenderer.invoke("notes:list")
});

contextBridge.exposeInMainWorld("appApi", {
  setDirty: (isDirty) => ipcRenderer.send("app:setDirty", { isDirty: !!isDirty })
});

contextBridge.exposeInMainWorld("windowApi", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggleMaximize"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  close: () => ipcRenderer.invoke("window:close")
});
