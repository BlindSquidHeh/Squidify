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
}

/** Строка вида `2|0,1040,1920,1080;1920,1040,3840,1080`. Всё остальное считается мусором. */
export function parseSnapshot(line: string): ShellSnapshot | null {
  const match = /^(\d)\|([-\d,;]*)$/.exec(line.trim());
  if (!match) return null;
  const state = Number(match[1]);
  const taskbars: Rect[] = [];
  for (const part of match[2].split(";")) {
    if (!part) continue;
    const n = part.split(",").map(Number);
    if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) continue;
    const [l, t, r, b] = n;
    if (r > l && b > t) taskbars.push({ x: l, y: t, width: r - l, height: b - t });
  }
  // 2 — полноэкранная программа, 3 — полноэкранная Direct3D-игра, 4 — режим презентации.
  return { fullscreen: state === 2 || state === 3 || state === 4, taskbars };
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

/** Скрипт PowerShell: раз в 400 мс печатает по строке состояния. */
export const WATCH_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class SqW {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
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
  [Console]::Out.WriteLine(('{0}|{1}' -f $state, ($list -join ';')))
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 400
}
`;
