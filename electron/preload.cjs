const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("amplyDesktop", {
  info: () => ipcRenderer.invoke("amply:info"),
  control: (action, value) => ipcRenderer.send("amply:control", { action, value }),
  gesture: (action, axis) => ipcRenderer.send("amply:gesture", { action, axis }),
  homeAssistant: (action) => ipcRenderer.invoke("amply:home-assistant", action),
  publishPlayer: (state) => ipcRenderer.send("amply:player-state", state),
  controllerResult: (result) => ipcRenderer.send("amply:player-result", result),
  onControllerCommand: (callback) => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on("amply:player-command", listener);
    return () => ipcRenderer.removeListener("amply:player-command", listener);
  },
  onWindowState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("amply:window-state", listener);
    return () => ipcRenderer.removeListener("amply:window-state", listener);
  },
});