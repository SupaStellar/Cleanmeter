import React from "react";
import ReactDOM from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import App from "./App";
import { useFluentTheme } from "./hooks/useFluentTheme";
import "./index.css";

function Root() {
  const theme = useFluentTheme();

  return (
    <FluentProvider theme={theme} style={{ height: "100vh", width: "100vw" }}>
      <App />
    </FluentProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
