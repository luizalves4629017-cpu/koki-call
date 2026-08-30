const { contextBridge, ipcRenderer } = require("electron");

// Expõe APIs seguras para o Frontend React
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  getScreenSources: () => ipcRenderer.invoke("get-screen-sources"),
  checkMasterStatus: () => ipcRenderer.invoke("check-master-status"),
  copyToClipboard: (text) => ipcRenderer.invoke("copy-to-clipboard", text),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  getServerUrl: () => ipcRenderer.invoke("get-server-url"),
});

