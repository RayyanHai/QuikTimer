import { useState } from "react";
import { acceleratorToSymbols } from "../format";

const MODIFIERS = new Set(["Control", "Alt", "Shift", "Meta"]);

/** Map a KeyboardEvent into a Tauri/Electron accelerator string. */
function eventToAccelerator(e: React.KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.metaKey) mods.push("CommandOrControl");
  if (e.ctrlKey && !e.metaKey) mods.push("Control");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");

  let key = e.key;
  if (MODIFIERS.has(key)) return null; // modifier alone — keep waiting
  if (key === " ") key = "Space";
  else if (key.length === 1) key = key.toUpperCase();
  // Otherwise use the named key as-is (e.g. "F5", "ArrowUp").

  if (mods.length === 0) return null; // require at least one modifier
  return [...mods, key].join("+");
}

export default function HotkeyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (accel: string) => void;
}) {
  const [recording, setRecording] = useState(false);

  return (
    <button
      type="button"
      className={`hotkey ${recording ? "recording" : ""}`}
      onClick={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={(e) => {
        if (!recording) return;
        e.preventDefault();
        if (e.key === "Escape") {
          setRecording(false);
          return;
        }
        const accel = eventToAccelerator(e);
        if (accel) {
          onChange(accel);
          setRecording(false);
        }
      }}
    >
      {recording ? "Press keys…" : acceleratorToSymbols(value)}
    </button>
  );
}
