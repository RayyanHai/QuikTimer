# QuikTimer

A lightweight macOS menu bar timer that starts instantly with a global hotkey,
shows a tiny floating countdown, and warns you before a short task goes over time.

Built with **Tauri 2 + React + TypeScript**.

## Features

- 🕒 Menu bar (status bar) app — no Dock icon, always available
- ⌨️ Global hotkey to start the timer from any app (default **⌘⇧Space**)
- 🪟 Small, draggable, always-on-top floating countdown panel
- ⚠️ Warning notification + sound before the timer ends (default 15s)
- ✅ Completion notification, with **overtime** mode (`+0:08`)
- ⏸ Pause / resume / stop / reset
- ⚙️ Settings window: duration, warning offset, hotkey, alerts, panel, theme
- 💾 Settings persisted locally; panel remembers its position
- 🌗 Light / dark / system theme; launch-at-login toggle
- 🔒 No network, no accounts, no website access

The countdown is **timestamp-based**, so it stays accurate through app lag and
Mac sleep/wake — the next tick recomputes from `endsAt`.

## Development

```bash
npm install
npm run tauri dev      # run the app with hot reload
```

## Build

```bash
npm run tauri build    # produces a .app and .dmg under src-tauri/target/release/bundle/
```

The build is **unsigned** (no Apple Developer account assumed). On first launch
macOS Gatekeeper will block it — right-click the app → **Open**, or run:

```bash
xattr -dr com.apple.quarantine "/Applications/QuikTimer.app"
```

## Architecture

| Layer | Responsibility |
| --- | --- |
| `src-tauri` (Rust) | App lifecycle, plugins, menu-bar (Accessory) activation policy |
| `src/timer.ts` | Timestamp-based timer state machine + notifications/sounds |
| `src/appcontrol.ts` | Tray menu, global hotkey, window show/hide, panel prefs |
| `src/panel` | Floating countdown UI (normal / warning / overtime / compact) |
| `src/settings` | Settings window, persisted via `@tauri-apps/plugin-store` |

Two webview windows (`panel`, `settings`) share one Vite app and route by
`getCurrentWindow().label`. The panel window stays alive (hidden) so the timer
keeps running and the global hotkey stays registered when the panel is closed.

## Icon

The app icon is a generated placeholder. To change it, replace
`src-tauri/icon-src.png` (1024×1024) and run:

```bash
npx tauri icon src-tauri/icon-src.png
```

`src-tauri/gen-icon.py` regenerates the default placeholder.
