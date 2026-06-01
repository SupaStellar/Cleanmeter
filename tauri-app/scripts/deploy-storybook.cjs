#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const staticDir = path.join(repoRoot, "storybook-static");
const hostDir = path.join(repoRoot, "storybook-host");

if (!fs.existsSync(staticDir)) {
  console.error(
    "[deploy-storybook] storybook-static/ not found. Run `storybook build` first."
  );
  process.exit(1);
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`[deploy-storybook] missing required file: ${src}`);
    process.exit(1);
  }
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

copyFile(
  path.join(hostDir, "package.json"),
  path.join(staticDir, "package.json")
);
copyFile(
  path.join(hostDir, "railway.json"),
  path.join(staticDir, "railway.json")
);

const railwayTemplate = path.join(hostDir, ".railway");
if (fs.existsSync(railwayTemplate)) {
  copyDir(railwayTemplate, path.join(staticDir, ".railway"));
} else {
  console.warn(
    "[deploy-storybook] storybook-host/.railway/ not found — first-time setup required."
  );
  console.warn(
    "  Run `railway link` (or follow the setup checklist in the README) once,"
  );
  console.warn(
    "  then copy the generated storybook-static/.railway/ into storybook-host/.railway/."
  );
}

const result = spawnSync("railway", ["up", "--detach"], {
  cwd: staticDir,
  stdio: "inherit",
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
