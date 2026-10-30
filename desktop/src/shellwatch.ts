// Наблюдение за панелью задач и полноэкранными программами (только Windows).
// Нужен для виджетов, закреплённых на панели задач: они видны, только пока видна сама панель.
// Чистые функции без Electron; процесс PowerShell запускается из main.ts.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShellSnapshot {
  /** Полноэкранная программа, игра или презентация (SHQueryUserNotificationState). */
  fullscreen: boolean;
  /** Окна панелей задач на всех мониторах в физических пикселях. */
  taskbars: Rect[];
  /** Мониторы, на которых активное окно закрывает весь экран (видео, игра, F11). */
  fullscreenAreas: Rect[];
}

function parseRects(text: string): Rect[] {
  const rects: Rect[] = [];
  for (const part of text.split(";")) {
    if (!part) continue;
    const n = part.split(",").map(Number);
    if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) continue;
    const [l, t, r, b] = n;
    if (r > l && b > t) rects.push({ x: l, y: t, width: r - l, height: b - t });
  }
  return rects;
}

/** Строка вида `2|панели|полноэкранные мониторы`, прямоугольники `l,t,r,b` через `;`. Всё остальное мусор. */
export function parseSnapshot(line: string): ShellSnapshot | null {
  const match = /^(\d)\|([-\d,;]*)(?:\|([-\d,;]*))?$/.exec(line.trim());
  if (!match) return null;
  const state = Number(match[1]);
  // 2 — полноэкранная программа, 3 — полноэкранная Direct3D-игра, 4 — режим презентации.
  return {
    fullscreen: state === 2 || state === 3 || state === 4,
    taskbars: parseRects(match[2]),
    fullscreenAreas: parseRects(match[3] ?? ""),
  };
}

/** На этом мониторе активное окно закрывает весь экран. */
export function isFullscreenOn(display: Rect, areas: Rect[]): boolean {
  return areas.some((a) => {
    const cx = a.x + a.width / 2;
    const cy = a.y + a.height / 2;
    return cx >= display.x && cx <= display.x + display.width && cy >= display.y && cy <= display.y + display.height;
  });
}

/** Панель, у которой скрыта (автоскрытие) почти вся площадь, остаётся тонкой полоской. */
export const MIN_TASKBAR_THICKNESS = 24;

/** Центр окна должен лежать на видимой панели задач. Все координаты в одних единицах. */
export function isOnVisibleTaskbar(window: Rect, taskbars: Rect[]): boolean {
  const cx = window.x + window.width / 2;
  const cy = window.y + window.height / 2;
  return taskbars.some(
    (t) =>
      Math.min(t.width, t.height) >= MIN_TASKBAR_THICKNESS &&
      cx >= t.x &&
      cx <= t.x + t.width &&
      cy >= t.y &&
      cy <= t.y + t.height,
  );
}

/** Панель задач, лежащая на данном мониторе (по центру панели), если она не спрятана автоскрытием. */
export function taskbarOnDisplay(display: Rect, taskbars: Rect[]): Rect | null {
  return (
    taskbars.find((t) => {
      const cx = t.x + t.width / 2;
      const cy = t.y + t.height / 2;
      return (
        Math.min(t.width, t.height) >= MIN_TASKBAR_THICKNESS &&
        cx >= display.x &&
        cx <= display.x + display.width &&
        cy >= display.y &&
        cy <= display.y + display.height
      );
    }) ?? null
  );
}

/** Скрипт PowerShell: раз в секунду печатает по строке состояния. */
export const WATCH_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class SqW {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
  [DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO info);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder text, int max);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr c, string cls, string title);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int s);
}
"@
[void][SqW]::SetProcessDPIAware()
while ($true) {
  $state = 0
  [void][SqW]::SHQueryUserNotificationState([ref]$state)
  $list = @()
  foreach ($cls in 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd') {
    $h = [IntPtr]::Zero
    while ($true) {
      $h = [SqW]::FindWindowEx([IntPtr]::Zero, $h, $cls, $null)
      if ($h -eq [IntPtr]::Zero) { break }
      $r = New-Object SqW+RECT
      if ([SqW]::GetWindowRect($h, [ref]$r) -and [SqW]::IsWindowVisible($h)) {
        $list += ('{0},{1},{2},{3}' -f $r.L, $r.T, $r.R, $r.B)
      }
    }
  }
  # Активное окно, которое закрывает весь монитор (видео на весь экран, игра, F11), кроме рабочего стола и панели.
  $full = @()
  $fg = [SqW]::GetForegroundWindow()
  if ($fg -ne [IntPtr]::Zero -and [SqW]::IsWindowVisible($fg)) {
    $cls = New-Object System.Text.StringBuilder 256
    [void][SqW]::GetClassName($fg, $cls, 256)
    if (@('Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd') -notcontains $cls.ToString()) {
      $wr = New-Object SqW+RECT
      $mon = [SqW]::MonitorFromWindow($fg, 2)
      $mi = New-Object SqW+MONITORINFO
      $mi.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf([type][SqW+MONITORINFO])
      if ([SqW]::GetWindowRect($fg, [ref]$wr) -and [SqW]::GetMonitorInfo($mon, [ref]$mi)) {
        $m = $mi.rcMonitor
        if ($wr.L -le $m.L -and $wr.T -le $m.T -and $wr.R -ge $m.R -and $wr.B -ge $m.B) {
          $full += ('{0},{1},{2},{3}' -f $m.L, $m.T, $m.R, $m.B)
        }
      }
    }
  }
  [Console]::Out.WriteLine(('{0}|{1}|{2}' -f $state, ($list -join ';'), ($full -join ';')))
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 1000
}
`;
