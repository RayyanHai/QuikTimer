import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Panel from "./panel/Panel";
import Settings from "./settings/Settings";
import "./styles.css";

const label = getCurrentWindow().label;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {label === "settings" ? <Settings /> : <Panel />}
  </React.StrictMode>
);
