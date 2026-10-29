// Preload локальной страницы-оболочки окна виджета. Удалённая страница
// виджета загружается во вложенный iframe и этого API не получает
// (preload выполняется только в главном фрейме).

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

interface ShellState {
  url: string | null;
  locked: boolean;
  autoSize: boolean;
}

contextBridge.exposeInMainWorld("squidifyShell", {
  onState(callback: (state: ShellState) => void) {
    ipcRenderer.on("shell:state", (_event: IpcRendererEvent, state: ShellState) => callback(state));
  },
  onReload(callback: () => void) {
    ipcRenderer.on("shell:reload", () => callback());
  },
  resize(width: number, height: number) {
    ipcRenderer.send("shell:resize", { width: Number(width), height: Number(height) });
  },
  autoSize(width: number, height: number) {
    ipcRenderer.send("shell:auto-size", { width: Number(width), height: Number(height) });
  },
  ready() {
    ipcRenderer.send("shell:ready");
  },
});
