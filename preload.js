const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("notesApi", {
  saveNote: (name, content) => ipcRenderer.invoke("notes:save", { name, content }),
  openNote: () => ipcRenderer.invoke("notes:open"),
  openNoteByName: (fileName) => ipcRenderer.invoke("notes:openByName", { fileName }),
  listNotes: () => ipcRenderer.invoke("notes:list")
});
