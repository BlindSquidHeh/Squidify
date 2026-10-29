// Preload окна настроек: только узкий набор вызовов, без доступа к Node.js.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

type ActionName = "toggle" | "reload" | "open-site" | "quit" | "fit-window";

contextBridge.exposeInMainWorld("squidifySettings", {
  get: () => ipcRenderer.invoke("settings:get"),
  update: (patch: Record<string, unknown>) => ipcRenderer.invoke("settings:update", patch),
  action: (name: ActionName, id?: string) => ipcRenderer.invoke("settings:action", name, id),
  addWidget: () => ipcRenderer.invoke("widgets:add"),
  removeWidget: (id: string) => ipcRenderer.invoke("widgets:remove", id),
  updateWidget: (id: string, patch: Record<string, unknown>) => ipcRenderer.invoke("widgets:update", id, patch),
  onChange(callback: (settings: unknown) => void) {
    ipcRenderer.on("settings:changed", (_event: IpcRendererEvent, value: unknown) => callback(value));
  },
});
