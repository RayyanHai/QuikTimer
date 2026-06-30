/** Format seconds as M:SS (or MM:SS). Negative values get a leading "+". */
export function formatTime(totalSeconds: number): string {
  const overtime = totalSeconds < 0;
  const secs = Math.abs(totalSeconds);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const body = `${m}:${s.toString().padStart(2, "0")}`;
  return overtime ? `+${body}` : body;
}

/** Convert an Electron/Tauri accelerator to Mac symbol notation for display. */
export function acceleratorToSymbols(accel: string): string {
  return accel
    .split("+")
    .map((part) => {
      switch (part) {
        case "CommandOrControl":
        case "Command":
        case "Cmd":
        case "Super":
          return "⌘";
        case "Shift":
          return "⇧";
        case "Alt":
        case "Option":
          return "⌥";
        case "Control":
        case "Ctrl":
          return "⌃";
        case "Space":
          return "Space";
        default:
          return part;
      }
    })
    .join(" ");
}
