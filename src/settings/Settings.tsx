import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import {
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  type Settings as SettingsType,
} from "../settings";
import { applyTheme } from "../theme";
import HotkeyInput from "./HotkeyInput";
import "./settings.css";

function Row({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="row">
      <div className="row-label">
        <span>{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="track" />
    </label>
  );
}

export default function Settings() {
  const [s, setS] = useState<SettingsType>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void loadSettings().then(async (loaded) => {
      // Reflect the OS's actual autostart state, which is the source of truth.
      try {
        loaded.launchAtLogin = await isAutostartEnabled();
      } catch {
        /* keep stored value */
      }
      setS(loaded);
      setReady(true);
      applyTheme(loaded.theme);
    });

    // Hide (don't destroy) on close so the tray can reopen this window.
    const unlistenClose = getCurrentWindow().onCloseRequested((e) => {
      e.preventDefault();
      void getCurrentWindow().hide();
    });
    return () => {
      void unlistenClose.then((un) => un());
    };
  }, []);

  if (!ready) return null;

  const durationSeconds = s.defaultDurationSeconds;
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  const warningTooLong = s.warningBeforeEndSeconds >= durationSeconds;

  // Persist a patch, update local state, and notify the panel window.
  async function update(patch: Partial<SettingsType>) {
    const next = { ...(s as SettingsType), ...patch };
    setS(next);
    await saveSettings(next);
    await emit("settings-changed");
  }

  async function setDuration(nextMins: number, nextSecs: number) {
    const total = Math.max(1, nextMins * 60 + nextSecs);
    await update({ defaultDurationSeconds: total });
  }

  async function toggleLaunchAtLogin(v: boolean) {
    try {
      if (v) await enableAutostart();
      else await disableAutostart();
      await update({ launchAtLogin: v });
    } catch {
      // Revert UI if the OS call fails.
      setS({ ...s, launchAtLogin: !v });
    }
  }

  return (
    <div className="settings">
      <h1>QuikTimer Settings</h1>

      <section>
        <h2>Timer</h2>
        <Row label="Default duration">
          <div className="duration">
            <input
              type="number"
              min={0}
              max={180}
              value={mins}
              onChange={(e) =>
                void setDuration(Number(e.target.value) || 0, secs)
              }
            />
            <span>min</span>
            <input
              type="number"
              min={0}
              max={59}
              value={secs}
              onChange={(e) =>
                void setDuration(mins, Number(e.target.value) || 0)
              }
            />
            <span>sec</span>
          </div>
        </Row>
        <Row
          label="Warn me before end"
          hint={warningTooLong ? "Must be less than the duration" : undefined}
        >
          <div className={`duration ${warningTooLong ? "invalid" : ""}`}>
            <input
              type="number"
              min={0}
              max={Math.max(0, durationSeconds - 1)}
              value={s.warningBeforeEndSeconds}
              onChange={(e) =>
                void update({
                  warningBeforeEndSeconds: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
            <span>sec</span>
          </div>
        </Row>
        <Row label="Overtime mode">
          <Toggle
            checked={s.overtimeMode}
            onChange={(v) => void update({ overtimeMode: v })}
          />
        </Row>
      </section>

      <section>
        <h2>Shortcut</h2>
        <Row label="Start timer" hint="Click, then press a key combo">
          <HotkeyInput
            value={s.startHotkey}
            onChange={(accel) => void update({ startHotkey: accel })}
          />
        </Row>
      </section>

      <section>
        <h2>Alerts</h2>
        <Row label="Desktop notifications">
          <Toggle
            checked={s.showNotifications}
            onChange={(v) => void update({ showNotifications: v })}
          />
        </Row>
        <Row label="Sound alerts">
          <Toggle
            checked={s.playSounds}
            onChange={(v) => void update({ playSounds: v })}
          />
        </Row>
      </section>

      <section>
        <h2>Panel</h2>
        <Row label="Always on top">
          <Toggle
            checked={s.alwaysOnTop}
            onChange={(v) => void update({ alwaysOnTop: v })}
          />
        </Row>
        <Row label="Remember position">
          <Toggle
            checked={s.rememberWindowPosition}
            onChange={(v) => void update({ rememberWindowPosition: v })}
          />
        </Row>
        <Row label="Compact mode">
          <Toggle
            checked={s.compactMode}
            onChange={(v) => void update({ compactMode: v })}
          />
        </Row>
      </section>

      <section>
        <h2>App</h2>
        <Row label="Launch at login">
          <Toggle
            checked={s.launchAtLogin}
            onChange={(v) => void toggleLaunchAtLogin(v)}
          />
        </Row>
        <Row label="Theme">
          <select
            value={s.theme}
            onChange={(e) => {
              const theme = e.target.value as SettingsType["theme"];
              applyTheme(theme);
              void update({ theme });
            }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Row>
      </section>

      <footer className="reset-row">
        <button
          onClick={() =>
            void update({ ...DEFAULT_SETTINGS, launchAtLogin: s.launchAtLogin })
          }
        >
          Reset to defaults
        </button>
      </footer>
    </div>
  );
}
