const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("amplyDesktop", {
  info: () => ipcRenderer.invoke("amply:info"),
  control: (action, value) => ipcRenderer.send("amply:control", { action, value }),
  gesture: (action, axis) => ipcRenderer.send("amply:gesture", { action, axis }),
  onWindowState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("amply:window-state", listener);
    return () => ipcRenderer.removeListener("amply:window-state", listener);
  },
});