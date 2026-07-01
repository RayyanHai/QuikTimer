import { load, type Store } from "@tauri-apps/plugin-store";

/** Persisted user settings. Mirrors PRD §14.5. */
export interface Settings {
  defaultDurationSeconds: number;
  warningBeforeEndSeconds: number;
  startHotkey: string;
  resetHotkey: string;
  alwaysOnTop: boolean;
  showPanelOnStart: boolean;
  rememberWindowPosition: boolean;
  panelPosition: { x: number; y: number } | null;
  playSounds: boolean;
  showNotifications: boolean;
  overtimeMode: boolean;
  compactMode: boolean;
  launchAtLogin: boolean;
  theme: "system" | "light" | "dark";
}

export const DEFAULT_SETTINGS: Settings = {
  defaultDurationSeconds: 360,
  warningBeforeEndSeconds: 15,
  startHotkey: "CommandOrControl+Shift+Space",
  resetHotkey: "CommandOrControl+Shift+Space",
  alwaysOnTop: true,
  showPanelOnStart: true,
  rememberWindowPosition: true,
  panelPosition: null,
  playSounds: true,
  showNotifications: true,
  overtimeMode: true,
  compactMode: false,
  launchAtLogin: false,
  theme: "system",
};

const STORE_FILE = "settings.json";
const SETTINGS_KEY = "settings";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: false, defaults: {} });
  }
  return storePromise;
}

export async function loadSettings(): Promise<Settings> {
  const store = await getStore();
  const saved = await store.get<Partial<Settings>>(SETTINGS_KEY);
  // Merge so new fields added in updates fall back to defaults.
  return { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  const store = await getStore();
  await store.set(SETTINGS_KEY, settings);
  await store.save();
}

/** Persist a partial change and return the merged result. */
export async function patchSettings(
  patch: Partial<Settings>
): Promise<Settings> {
  const current = await loadSettings();
  const next = { ...current, ...patch };
  await saveSettings(next);
  return next;
}
