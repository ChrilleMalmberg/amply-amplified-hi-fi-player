const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("amplyDesktop", {
  info: () => ipcRenderer.invoke("amply:info"),
  control: (action, value) => ipcRenderer.send("amply:control", { action, value }),
  gesture: (action, axis) => ipcRenderer.send("amply:gesture", { action, axis }),
  homeAssistant: (action, options) => ipcRenderer.invoke('amply:ha-settings', action, options),
  publishHomeAssistantState: state => ipcRenderer.send('amply:ha-state', state),
  completeHomeAssistantCommand: (id, ok) => ipcRenderer.send('amply:ha-result', { id, ok }),
  onHomeAssistantCommand: callback => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('amply:ha-command', listener);
    return () => ipcRenderer.removeListener('amply:ha-command', listener);
  },
  onWindowState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("amply:window-state", listener);
    return () => ipcRenderer.removeListener("amply:window-state", listener);
  },
});
