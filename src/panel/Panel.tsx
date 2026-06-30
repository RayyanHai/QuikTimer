import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { timer, type TimerState } from "../timer";
import { loadSettings } from "../settings";
import { initAppControl, hidePanel } from "../appcontrol";
import { applyTheme } from "../theme";
import { formatTime } from "../format";
import "./panel.css";

export default function Panel() {
  const [state, setState] = useState<TimerState>(timer.getState());
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    void initAppControl();
    const unsub = timer.subscribe(setState);

    const refreshPrefs = async () => {
      const s = await loadSettings();
      setCompact(s.compactMode);
      applyTheme(s.theme);
    };
    void refreshPrefs();
    const unlistenPromise = listen("settings-changed", refreshPrefs);

    return () => {
      unsub();
      void unlistenPromise.then((un) => un());
    };
  }, []);

  const status = state.status;
  const isPaused = status === "PAUSED";
  const stateClass =
    status === "WARNING"
      ? "warn"
      : status === "OVERTIME" || status === "COMPLETED"
      ? "over"
      : "normal";

  const label =
    status === "WARNING"
      ? "Wrap up"
      : status === "OVERTIME"
      ? "Over time"
      : status === "PAUSED"
      ? "Paused"
      : "QuikTimer";

  if (compact) {
    return (
      <div className={`panel compact ${stateClass}`} data-tauri-drag-region>
        <span className="clock" aria-hidden>
          ⏱
        </span>
        <span className="time" role="timer" aria-label={`${label} ${formatTime(state.remainingSeconds)}`}>
          {formatTime(state.remainingSeconds)}
        </span>
      </div>
    );
  }

  return (
    <div className={`panel ${stateClass}`}>
      <header className="bar" data-tauri-drag-region>
        <span className="title" data-tauri-drag-region>
          {label}
        </span>
        <button
          className="hide"
          title="Hide (timer keeps running)"
          aria-label="Hide panel"
          onClick={() => void hidePanel()}
        >
          ✕
        </button>
      </header>

      <div className="time" role="timer" aria-live="polite">
        {formatTime(state.remainingSeconds)}
      </div>

      <footer className="controls">
        <button
          onClick={() => (isPaused ? timer.resume() : timer.pause())}
          disabled={status === "OVERTIME" || status === "COMPLETED"}
          title={isPaused ? "Resume" : "Pause"}
        >
          {isPaused ? "Resume" : "Pause"}
        </button>
        <button onClick={() => timer.reset()} title="Restart from full duration">
          Reset
        </button>
        <button
          className="stop"
          onClick={() => {
            timer.stop();
            void hidePanel();
          }}
          title="Stop"
        >
          Stop
        </button>
      </footer>
    </div>
  );
}
