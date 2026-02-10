const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("notesApi", {
  saveNote: (name, content) => ipcRenderer.invoke("notes:save", { name, content }),
  openNote: () => ipcRenderer.invoke("notes:open")
});
