import React from "react";
import ReactDOM from "react-dom/client";
import OverlayApp from "./OverlayApp";
import "./index.css";
import "./disable-context-menu";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OverlayApp />
  </React.StrictMode>
);
