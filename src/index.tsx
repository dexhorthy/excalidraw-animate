import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import Editor from "./Editor";
import "./index.css";

// Lightweight path-based routing (no router dep):
//   /edit  -> full Excalidraw editor (create + save .excalidraw offline)
//   /      -> the existing animator / WebM generator
const isEditor = window.location.pathname.replace(/\/+$/, "").endsWith("/edit");
const Root = isEditor ? Editor : App;

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
