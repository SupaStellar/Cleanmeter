import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import "./preview.css";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/app/components/Select";

/* ------------------------------------------------------------------ */
/*  Select demos                                                       */
/* ------------------------------------------------------------------ */
function SelectPreview() {
  const [value, setValue] = useState("");

  return (
    <section className="preview-section">
      <h2 className="text-heading-h3 text-[var(--textHeading)]">Select</h2>

      <div className="preview-row">
        <div className="preview-cell">
          <span className="preview-label">Default</span>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cpu">CPU Usage</SelectItem>
              <SelectItem value="gpu">GPU Usage</SelectItem>
              <SelectItem value="ram">RAM Usage</SelectItem>
              <SelectItem value="fps">FPS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="preview-cell">
          <span className="preview-label">With label</span>
          <Select defaultValue="gpu">
            <SelectTrigger label="Metric:">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cpu">CPU Usage</SelectItem>
              <SelectItem value="gpu">GPU Usage</SelectItem>
              <SelectItem value="ram">RAM Usage</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="preview-cell">
          <span className="preview-label">Disabled</span>
          <Select disabled>
            <SelectTrigger variant="disabled">
              <SelectValue placeholder="Disabled" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="x">X</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="preview-cell">
          <span className="preview-label">Grouped</span>
          <Select defaultValue="cpu-temp">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>CPU</SelectLabel>
                <SelectItem value="cpu-usage">CPU Usage</SelectItem>
                <SelectItem value="cpu-temp">CPU Temp</SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>GPU</SelectLabel>
                <SelectItem value="gpu-usage">GPU Usage</SelectItem>
                <SelectItem value="gpu-temp">GPU Temp</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  App shell                                                          */
/* ------------------------------------------------------------------ */
function PreviewApp() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  return (
    <div data-theme={theme} className="preview-root">
      <header className="preview-header">
        <h1 className="text-heading-h2 text-[var(--textHeading)]">
          Component Preview
        </h1>
        <button
          className="preview-theme-toggle"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? "Dark" : "Light"}
        </button>
      </header>

      <main className="preview-main">
        <SelectPreview />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PreviewApp />
  </React.StrictMode>
);
