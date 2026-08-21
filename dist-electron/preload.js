var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,
  send: (channel, data) => import_electron.ipcRenderer.send(channel, data),
  on: (channel, func) => {
    import_electron.ipcRenderer.on(channel, (event, ...args) => func(...args));
  }
});
