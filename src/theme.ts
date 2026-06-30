export type Theme = "system" | "light" | "dark";

/** Apply a theme by toggling a data attribute on <html>. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "dark" : "light";
  } else {
    root.dataset.theme = theme;
  }
}
