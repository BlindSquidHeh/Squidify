// Preload окна настроек: только узкий набор вызовов, без доступа к Node.js.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("squidifySettings", {
  get: () => ipcRenderer.invoke("settings:get"),
  update: (patch: Record<string, unknown>) => ipcRenderer.invoke("settings:update", patch),
  action: (name: "toggle" | "reload" | "open-site" | "quit") => ipcRenderer.invoke("settings:action", name),
  onChange(callback: (settings: unknown) => void) {
    ipcRenderer.on("settings:changed", (_event: IpcRendererEvent, value: unknown) => callback(value));
  },
});
