import { getCurrentWindow, availableMonitors } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { listen } from "@tauri-apps/api/event";
import {
  register,
  unregisterAll,
} from "@tauri-apps/plugin-global-shortcut";
import { timer, type TimerState } from "./timer";
import { loadSettings, patchSettings } from "./settings";
import { formatTime } from "./format";

const PANEL_NORMAL = { width: 220, height: 110 };
const PANEL_COMPACT = { width: 168, height: 54 };

let initialized = false;
let tray: TrayIcon | null = null;
let currentHotkey: string | null = null;
let savingPosition = false;

function panel() {
  return getCurrentWindow();
}

async function showPanel(focus = false) {
  const w = panel();
  await applyPanelPrefs();
  await w.show();
  // Always-on-top keeps it visible; only grab focus when explicitly summoned
  // so a normal start doesn't pull the user out of their browser task.
  if (focus) await w.setFocus();
  await ensureOnVisibleDisplay();
}

async function hidePanel() {
  await panel().hide();
}

async function openSettings() {
  const w = await WebviewWindow.getByLabel("settings");
  if (w) {
    await w.show();
    await w.setFocus();
  }
}

function togglePause() {
  const status = timer.getState().status;
  if (status === "PAUSED") timer.resume();
  else timer.pause();
}

/** Hotkey / "Start" behavior: start fresh, or bring the panel forward if active. */
async function handleStartHotkey() {
  const status = timer.getState().status;
  const isActive =
    status === "RUNNING" ||
    status === "WARNING" ||
    status === "PAUSED" ||
    status === "OVERTIME";
  if (!isActive) {
    await timer.start();
    await showPanel(false);
  } else {
    // Already running — user is explicitly summoning it; bring it forward.
    await showPanel(true);
  }
}

async function applyPanelPrefs() {
  const s = await loadSettings();
  const w = panel();
  await w.setAlwaysOnTop(s.alwaysOnTop);
  const size = s.compactMode ? PANEL_COMPACT : PANEL_NORMAL;
  await w.setSize(new LogicalSize(size.width, size.height));
  if (s.rememberWindowPosition && s.panelPosition) {
    savingPosition = true;
    await w.setPosition(
      new PhysicalPosition(s.panelPosition.x, s.panelPosition.y)
    );
    savingPosition = false;
  }
}

/** Edge case: if the panel landed off all monitors, recenter it. */
async function ensureOnVisibleDisplay() {
  try {
    const w = panel();
    const pos = await w.outerPosition();
    const size = await w.outerSize();
    const monitors = await availableMonitors();
    const cx = pos.x + size.width / 2;
    const cy = pos.y + size.height / 2;
    const onScreen = monitors.some((m) => {
      const { position, size: ms } = m;
      return (
        cx >= position.x &&
        cx <= position.x + ms.width &&
        cy >= position.y &&
        cy <= position.y + ms.height
      );
    });
    if (!onScreen) await w.center();
  } catch {
    // Non-fatal — leave the panel where it is.
  }
}

async function registerHotkeyFromSettings(): Promise<boolean> {
  const s = await loadSettings();
  try {
    await unregisterAll();
    await register(s.startHotkey, (event) => {
      if (event.state === "Pressed") void handleStartHotkey();
    });
    currentHotkey = s.startHotkey;
    return true;
  } catch {
    currentHotkey = null;
    // Best-effort heads-up; Settings also validates inline on change.
    try {
      const { sendNotification, isPermissionGranted } = await import(
        "@tauri-apps/plugin-notification"
      );
      if (await isPermissionGranted()) {
        sendNotification({
          title: "QuikTimer",
          body: `Could not register the shortcut ${s.startHotkey}. Open Settings to pick another.`,
        });
      }
    } catch {
      /* ignore */
    }
    return false;
  }
}

async function buildTray() {
  const icon = (await defaultWindowIcon()) ?? undefined;
  const quit = await PredefinedMenuItem.new({ item: "Quit" });
  const menu = await Menu.new({
    items: [
      { id: "start", text: "Start Timer", action: () => void handleStartHotkey() },
      { id: "pause", text: "Pause / Resume", action: () => togglePause() },
      {
        id: "stop",
        text: "Stop",
        action: () => {
          timer.stop();
          void hidePanel();
        },
      },
      {
        id: "reset",
        text: "Reset",
        action: () => {
          timer.reset();
          void showPanel(true);
        },
      },
      { item: "Separator" },
      { id: "settings", text: "Settings…", action: () => void openSettings() },
      { item: "Separator" },
      quit,
    ],
  });

  tray = await TrayIcon.new({
    icon,
    menu,
    tooltip: "QuikTimer",
    showMenuOnLeftClick: true,
  });
}

function updateTrayTitle(state: TimerState) {
  if (!tray) return;
  const active =
    state.status === "RUNNING" ||
    state.status === "WARNING" ||
    state.status === "PAUSED" ||
    state.status === "OVERTIME";
  void tray.setTitle(active ? formatTime(state.remainingSeconds) : "");
}

/** Run once, from the panel window, on first mount. */
export async function initAppControl() {
  if (initialized) return;
  initialized = true;

  await buildTray();
  await applyPanelPrefs();
  await registerHotkeyFromSettings();

  timer.subscribe(updateTrayTitle);

  // Persist panel position as the user drags it.
  void panel().onMoved(({ payload }) => {
    if (savingPosition) return;
    void patchSettings({ panelPosition: { x: payload.x, y: payload.y } });
  });

  // React to settings changes from the settings window.
  void listen("settings-changed", async () => {
    await applyPanelPrefs();
    const s = await loadSettings();
    if (s.startHotkey !== currentHotkey) {
      await registerHotkeyFromSettings();
    }
  });
}

export { hidePanel, showPanel, registerHotkeyFromSettings };
