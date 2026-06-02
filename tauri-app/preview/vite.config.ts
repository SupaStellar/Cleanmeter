import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { readFileSync } from "node:fs";

// Mirror the root vite.config.ts injection so getAppVersion()'s browser
// fallback (lib/tauri.ts) still resolves if a previewed component ever
// imports it transitively.
const appVersion = JSON.parse(
  readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"),
).version;

export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../src"),
    },
  },
  server: {
    port: 3333,
    open: true,
  },
});
