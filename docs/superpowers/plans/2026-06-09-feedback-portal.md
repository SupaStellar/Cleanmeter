# Feedback Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a private Next.js web app on Railway that ingests feedback submissions from the Cleanmeter desktop app and shows them to the team.

**Architecture:** Next.js (App Router) on Railway. A single `POST /api/feedback` ingest endpoint (write-key header + per-IP rate limit) writes a row to Railway Postgres and saves any attachment to a mounted volume. An unlisted server-rendered page lists submissions; `GET /api/attachment/[id]` streams files back. No auth on the viewer (per decision); ingest is the only guarded surface.

**Tech Stack:** Next.js 15 (App Router, TypeScript), `pg` (node-postgres), Railway Postgres plugin, Railway volume, `vitest` for unit tests.

**Repo:** New **private** repo `cleanmeter-feedback-portal` (separate from the open-source app). All code/paths below are relative to that repo's root unless stated otherwise.

**Spec:** `Cleanmeter/docs/superpowers/specs/2026-06-09-in-app-feedback-and-portal-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `package.json`, `tsconfig.json`, `next.config.ts` | Next.js app scaffold |
| `vitest.config.ts` | Unit test runner config |
| `src/lib/env.ts` | Reads + validates required env vars once |
| `src/lib/db.ts` | Postgres pool + `getFeedback()` / `insertFeedback()` |
| `src/lib/ingest.ts` | Pure helpers: key check, mime allow-list, filename sanitize |
| `src/lib/rateLimit.ts` | In-memory per-IP fixed-window limiter |
| `src/lib/storage.ts` | Save/read attachment files on the volume |
| `migrations/0001_feedback.sql` | `feedback` table DDL |
| `scripts/migrate.ts` | Applies SQL migrations on deploy |
| `src/app/api/feedback/route.ts` | `POST` ingest handler |
| `src/app/api/attachment/[id]/route.ts` | `GET` attachment stream |
| `src/app/page.tsx` | Server-rendered submissions list (unlisted) |
| `src/app/feedback-list.module.css` | Minimal styling for the list |
| `src/lib/*.test.ts` | Unit tests for pure helpers |
| `railway.json` | Railway deploy + volume config |
| `.env.example` | Documents env var names |
| `README.md` | Setup + deploy notes |

---

## Task 1: Scaffold the Next.js app

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `.env.example`

- [ ] **Step 1: Create the project scaffold**

Create `package.json`:

```json
{
  "name": "cleanmeter-feedback-portal",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "migrate": "tsx scripts/migrate.ts",
    "postbuild": "echo 'run migrate on deploy via railway start command'",
    "test": "vitest run",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "pg": "^8.13.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/pg": "^8.11.10",
    "@types/react": "^19.0.0",
    "typescript": "^5.7.0",
    "tsx": "^4.19.2",
    "vitest": "^2.1.8"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Attachment files live on a mounted volume outside .next; served via a route.
  output: "standalone",
};

export default nextConfig;
```

Create `.gitignore`:

```
node_modules
.next
.env
.env.local
*.tsbuildinfo
next-env.d.ts
```

Create `.env.example`:

```
# Postgres connection string (Railway Postgres plugin provides DATABASE_URL)
DATABASE_URL=postgres://user:pass@host:5432/railway
# Shared write key the desktop app sends in the x-feedback-key header.
# Generate a long random value; set the SAME value as the app's build secret.
FEEDBACK_WRITE_KEY=replace-with-long-random-string
# Directory on the mounted Railway volume where attachment files are stored.
ATTACHMENT_DIR=/data/attachments
```

- [ ] **Step 2: Install and verify the scaffold builds**

Run: `npm install`
Run: `npx tsc --noEmit`
Expected: no type errors (no app files yet, exits 0).

- [ ] **Step 3: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold next.js feedback portal"
```

---

## Task 2: Env loader + Postgres pool

**Files:**
- Create: `src/lib/env.ts`, `src/lib/db.ts`

- [ ] **Step 1: Create the env loader**

`src/lib/env.ts`:

```ts
function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const env = {
  databaseUrl: () => required("DATABASE_URL"),
  writeKey: () => required("FEEDBACK_WRITE_KEY"),
  attachmentDir: () => process.env.ATTACHMENT_DIR ?? "/data/attachments",
};
```

- [ ] **Step 2: Create the Postgres pool + queries**

`src/lib/db.ts`:

```ts
import { Pool } from "pg";
import { env } from "./env";

// Reuse one pool across hot-reloads / serverless invocations.
const globalForPg = globalThis as unknown as { _pgPool?: Pool };
export const pool =
  globalForPg._pgPool ?? new Pool({ connectionString: env.databaseUrl() });
if (process.env.NODE_ENV !== "production") globalForPg._pgPool = pool;

export interface FeedbackRow {
  id: string;
  created_at: string;
  name: string;
  message: string;
  app_version: string;
  os: string;
  attachment_name: string | null;
  attachment_path: string | null;
  attachment_mime: string | null;
}

export async function insertFeedback(input: {
  name: string;
  message: string;
  appVersion: string;
  os: string;
  attachmentName: string | null;
  attachmentPath: string | null;
  attachmentMime: string | null;
}): Promise<string> {
  const res = await pool.query<{ id: string }>(
    `INSERT INTO feedback
       (name, message, app_version, os, attachment_name, attachment_path, attachment_mime)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.name,
      input.message,
      input.appVersion,
      input.os,
      input.attachmentName,
      input.attachmentPath,
      input.attachmentMime,
    ],
  );
  return res.rows[0].id;
}

export async function getFeedback(limit = 200): Promise<FeedbackRow[]> {
  const res = await pool.query<FeedbackRow>(
    `SELECT id, created_at, name, message, app_version, os,
            attachment_name, attachment_path, attachment_mime
     FROM feedback ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return res.rows;
}

export async function getFeedbackById(id: string): Promise<FeedbackRow | null> {
  const res = await pool.query<FeedbackRow>(
    `SELECT id, created_at, name, message, app_version, os,
            attachment_name, attachment_path, attachment_mime
     FROM feedback WHERE id = $1`,
    [id],
  );
  return res.rows[0] ?? null;
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/env.ts src/lib/db.ts
git commit -m "feat: postgres pool and feedback queries"
```

---

## Task 3: DB migration + migrate script

**Files:**
- Create: `migrations/0001_feedback.sql`, `scripts/migrate.ts`

- [ ] **Step 1: Write the migration SQL**

`migrations/0001_feedback.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  name            text NOT NULL DEFAULT '',
  message         text NOT NULL,
  app_version     text NOT NULL DEFAULT '',
  os              text NOT NULL DEFAULT '',
  attachment_name text,
  attachment_path text,
  attachment_mime text
);

CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback (created_at DESC);
```

- [ ] **Step 2: Write the migrate runner**

`scripts/migrate.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const pool = new Pool({ connectionString: url });
  const dir = join(process.cwd(), "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    process.stdout.write(`applying ${f}... `);
    await pool.query(sql);
    process.stdout.write("ok\n");
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add migrations scripts
git commit -m "feat: feedback table migration and runner"
```

---

## Task 4: Ingest pure helpers (TDD)

**Files:**
- Create: `src/lib/ingest.ts`, `src/lib/ingest.test.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Add vitest config**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 2: Write the failing tests**

`src/lib/ingest.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isWriteKeyValid, isAllowedMime, sanitizeFilename, extForMime } from "./ingest";

describe("isWriteKeyValid", () => {
  it("accepts the exact key", () => {
    expect(isWriteKeyValid("abc123", "abc123")).toBe(true);
  });
  it("rejects a wrong key", () => {
    expect(isWriteKeyValid("nope", "abc123")).toBe(false);
  });
  it("rejects an empty provided key", () => {
    expect(isWriteKeyValid("", "abc123")).toBe(false);
  });
  it("rejects null", () => {
    expect(isWriteKeyValid(null, "abc123")).toBe(false);
  });
});

describe("isAllowedMime", () => {
  it("allows png/jpeg/webp/gif", () => {
    for (const m of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
      expect(isAllowedMime(m)).toBe(true);
    }
  });
  it("rejects non-images", () => {
    expect(isAllowedMime("application/pdf")).toBe(false);
    expect(isAllowedMime("text/html")).toBe(false);
  });
});

describe("sanitizeFilename", () => {
  it("strips path separators and keeps a safe name", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("My Shot.jpeg")).toBe("My_Shot.jpeg");
  });
  it("falls back when empty", () => {
    expect(sanitizeFilename("")).toBe("attachment");
  });
});

describe("extForMime", () => {
  it("maps known mimes", () => {
    expect(extForMime("image/jpeg")).toBe("jpg");
    expect(extForMime("image/png")).toBe("png");
  });
  it("defaults to bin for unknown", () => {
    expect(extForMime("application/octet-stream")).toBe("bin");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./ingest"` / functions undefined.

- [ ] **Step 4: Implement the helpers**

`src/lib/ingest.ts`:

```ts
import { timingSafeEqual } from "node:crypto";

const ALLOWED_MIMES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isWriteKeyValid(
  provided: string | null,
  expected: string,
): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isAllowedMime(mime: string): boolean {
  return mime in ALLOWED_MIMES;
}

export function extForMime(mime: string): string {
  return ALLOWED_MIMES[mime] ?? "bin";
}

export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "");
  return cleaned === "" ? "attachment" : cleaned;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 4 describe blocks green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ingest.ts src/lib/ingest.test.ts vitest.config.ts
git commit -m "feat: ingest validation helpers with tests"
```

---

## Task 5: Per-IP rate limiter (TDD)

**Files:**
- Create: `src/lib/rateLimit.ts`, `src/lib/rateLimit.test.ts`

> Note: in-memory fixed-window limiter. Resets on redeploy and is per-instance — acceptable for a low-traffic internal tool. The write key is the primary gate; this caps accidental/abusive bursts.

- [ ] **Step 1: Write the failing tests**

`src/lib/rateLimit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createRateLimiter } from "./rateLimit";

describe("createRateLimiter", () => {
  it("allows up to the limit within the window", () => {
    let now = 1000;
    const rl = createRateLimiter({ limit: 3, windowMs: 60000, now: () => now });
    expect(rl.check("1.1.1.1")).toBe(true);
    expect(rl.check("1.1.1.1")).toBe(true);
    expect(rl.check("1.1.1.1")).toBe(true);
    expect(rl.check("1.1.1.1")).toBe(false);
  });

  it("tracks ips independently", () => {
    let now = 1000;
    const rl = createRateLimiter({ limit: 1, windowMs: 60000, now: () => now });
    expect(rl.check("a")).toBe(true);
    expect(rl.check("a")).toBe(false);
    expect(rl.check("b")).toBe(true);
  });

  it("resets after the window elapses", () => {
    let now = 1000;
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => now });
    expect(rl.check("a")).toBe(true);
    expect(rl.check("a")).toBe(false);
    now += 1001;
    expect(rl.check("a")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./rateLimit`.

- [ ] **Step 3: Implement the limiter**

`src/lib/rateLimit.ts`:

```ts
interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

export function createRateLimiter(opts: RateLimiterOptions) {
  const now = opts.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  return {
    check(key: string): boolean {
      const t = now();
      const b = buckets.get(key);
      if (!b || t >= b.resetAt) {
        buckets.set(key, { count: 1, resetAt: t + opts.windowMs });
        return true;
      }
      if (b.count >= opts.limit) return false;
      b.count += 1;
      return true;
    },
  };
}

// Shared singleton for the ingest route: 20 submissions / 10 min / IP.
const globalForRl = globalThis as unknown as {
  _feedbackRl?: ReturnType<typeof createRateLimiter>;
};
export const feedbackRateLimiter =
  globalForRl._feedbackRl ??
  createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });
globalForRl._feedbackRl = feedbackRateLimiter;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rateLimit.ts src/lib/rateLimit.test.ts
git commit -m "feat: per-ip rate limiter with tests"
```

---

## Task 6: Attachment storage helper

**Files:**
- Create: `src/lib/storage.ts`

- [ ] **Step 1: Implement the storage helper**

`src/lib/storage.ts`:

```ts
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "./env";
import { extForMime } from "./ingest";

// Saves bytes under ATTACHMENT_DIR using the feedback id as the filename.
// Returns the absolute path stored in the DB row.
export async function saveAttachment(
  id: string,
  mime: string,
  bytes: Buffer,
): Promise<string> {
  const dir = env.attachmentDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${id}.${extForMime(mime)}`);
  await writeFile(path, bytes);
  return path;
}

export async function readAttachment(path: string): Promise<Buffer> {
  return readFile(path);
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat: attachment storage helper"
```

---

## Task 7: Ingest route `POST /api/feedback`

**Files:**
- Create: `src/app/api/feedback/route.ts`

- [ ] **Step 1: Implement the route handler**

`src/app/api/feedback/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isWriteKeyValid, isAllowedMime } from "@/lib/ingest";
import { feedbackRateLimiter } from "@/lib/rateLimit";
import { insertFeedback } from "@/lib/db";
import { saveAttachment } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_MESSAGE_LEN = 5000;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0].trim() || "unknown";
}

export async function POST(req: NextRequest) {
  if (!isWriteKeyValid(req.headers.get("x-feedback-key"), env.writeKey())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!feedbackRateLimiter.check(clientIp(req))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const message = String(form.get("message") ?? "").trim();
  if (message === "") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: "message too long" }, { status: 400 });
  }

  const name = String(form.get("name") ?? "").trim().slice(0, 200);
  const appVersion = String(form.get("app_version") ?? "").trim().slice(0, 50);
  const os = String(form.get("os") ?? "").trim().slice(0, 50);

  // Insert first to get the id, then save the file named by that id.
  let attachmentName: string | null = null;
  let attachmentMime: string | null = null;
  const file = form.get("attachment");
  let fileBytes: Buffer | null = null;
  if (file instanceof File && file.size > 0) {
    if (!isAllowedMime(file.type)) {
      return NextResponse.json({ error: "attachment must be an image" }, { status: 400 });
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: "attachment too large" }, { status: 400 });
    }
    fileBytes = Buffer.from(await file.arrayBuffer());
    attachmentName = file.name;
    attachmentMime = file.type;
  }

  const id = await insertFeedback({
    name,
    message,
    appVersion,
    os,
    attachmentName,
    attachmentPath: null,
    attachmentMime,
  });

  if (fileBytes && attachmentMime) {
    const path = await saveAttachment(id, attachmentMime, fileBytes);
    await import("@/lib/db").then(({ pool }) =>
      pool.query("UPDATE feedback SET attachment_path = $1 WHERE id = $2", [path, id]),
    );
  }

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
```

- [ ] **Step 2: Verify types + build**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/feedback/route.ts
git commit -m "feat: feedback ingest endpoint"
```

---

## Task 8: Viewer page + attachment route

**Files:**
- Create: `src/app/page.tsx`, `src/app/feedback-list.module.css`, `src/app/api/attachment/[id]/route.ts`, `src/app/layout.tsx`

- [ ] **Step 1: Create the root layout**

`src/app/layout.tsx`:

```tsx
export const metadata = { title: "Cleanmeter Feedback", robots: "noindex, nofollow" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0c111d", color: "#e5e7eb" }}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create the list styles**

`src/app/feedback-list.module.css`:

```css
.wrap { max-width: 880px; margin: 0 auto; padding: 32px 20px; }
.h1 { font-size: 20px; font-weight: 600; margin-bottom: 24px; }
.empty { opacity: 0.6; }
.card { background: #1a2231; border: 1px solid #2a3344; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.meta { display: flex; gap: 12px; font-size: 12px; opacity: 0.7; margin-bottom: 8px; flex-wrap: wrap; }
.name { font-weight: 600; }
.message { white-space: pre-wrap; line-height: 1.5; }
.thumb { margin-top: 12px; max-width: 320px; border-radius: 8px; display: block; }
```

- [ ] **Step 3: Create the viewer page**

`src/app/page.tsx`:

```tsx
import { getFeedback } from "@/lib/db";
import styles from "./feedback-list.module.css";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await getFeedback();
  return (
    <main className={styles.wrap}>
      <h1 className={styles.h1}>Cleanmeter Feedback ({rows.length})</h1>
      {rows.length === 0 ? (
        <p className={styles.empty}>No feedback yet.</p>
      ) : (
        rows.map((r) => (
          <article key={r.id} className={styles.card}>
            <div className={styles.meta}>
              <span className={styles.name}>{r.name || "Anonymous"}</span>
              <span>{new Date(r.created_at).toLocaleString()}</span>
              <span>v{r.app_version || "?"}</span>
              <span>{r.os || "?"}</span>
            </div>
            <div className={styles.message}>{r.message}</div>
            {r.attachment_path && (
              <a href={`/api/attachment/${r.id}`} target="_blank" rel="noreferrer">
                <img className={styles.thumb} src={`/api/attachment/${r.id}`} alt={r.attachment_name ?? "attachment"} />
              </a>
            )}
          </article>
        ))
      )}
    </main>
  );
}
```

- [ ] **Step 4: Create the attachment stream route**

`src/app/api/attachment/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getFeedbackById } from "@/lib/db";
import { readAttachment } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await getFeedbackById(id);
  if (!row || !row.attachment_path || !row.attachment_mime) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const bytes = await readAttachment(row.attachment_path);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": row.attachment_mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "file missing" }, { status: 404 });
  }
}
```

- [ ] **Step 5: Verify types + build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds (Next compiles all routes).

- [ ] **Step 6: Commit**

```bash
git add src/app
git commit -m "feat: feedback viewer and attachment route"
```

---

## Task 9: Railway deploy config + README

**Files:**
- Create: `railway.json`, `README.md`

- [ ] **Step 1: Create the Railway config**

`railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "npm run migrate && npm run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

- [ ] **Step 2: Write the README**

`README.md`:

```md
# Cleanmeter Feedback Portal (private)

Internal portal that ingests feedback from the Cleanmeter desktop app.

## Railway setup
1. New Railway project from this repo.
2. Add the **Postgres** plugin (provides `DATABASE_URL`).
3. Add a **Volume** mounted at `/data`.
4. Set env vars:
   - `FEEDBACK_WRITE_KEY` — long random string (also set as the app build secret).
   - `ATTACHMENT_DIR=/data/attachments`
5. Deploy. `startCommand` runs migrations then starts Next.

## Endpoints
- `POST /api/feedback` — multipart, header `x-feedback-key`. Fields: name, message (required), app_version, os, attachment (image, optional).
- `GET /` — unlisted submissions list.
- `GET /api/attachment/[id]` — streams an attachment.

## Note
The viewer is unlisted (no auth). Treat the URL as sensitive.
```

- [ ] **Step 3: Commit + push to the new private repo**

```bash
git add railway.json README.md
git commit -m "chore: railway deploy config and readme"
gh repo create SupaStellar/cleanmeter-feedback-portal --private --source=. --remote=origin --push
```

---

## Task 10: Deploy + end-to-end smoke

- [ ] **Step 1: Deploy to Railway** (Postgres plugin + volume at `/data` + env vars per README). Note the public URL as `FEEDBACK_PORTAL_URL` and the `FEEDBACK_WRITE_KEY` value — both feed into the in-app plan.

- [ ] **Step 2: Smoke the ingest endpoint (no attachment)**

Run:
```bash
curl -i -X POST "$FEEDBACK_PORTAL_URL/api/feedback" \
  -H "x-feedback-key: $FEEDBACK_WRITE_KEY" \
  -F "message=hello from curl" -F "name=Tester" \
  -F "app_version=2.2.2" -F "os=windows"
```
Expected: `HTTP/1.1 201` with `{"ok":true,"id":"..."}`.

- [ ] **Step 3: Smoke the auth gate**

Run:
```bash
curl -i -X POST "$FEEDBACK_PORTAL_URL/api/feedback" -F "message=x"
```
Expected: `HTTP/1.1 401`.

- [ ] **Step 4: Smoke with an attachment**

Run:
```bash
curl -i -X POST "$FEEDBACK_PORTAL_URL/api/feedback" \
  -H "x-feedback-key: $FEEDBACK_WRITE_KEY" \
  -F "message=with image" -F "app_version=2.2.2" -F "os=windows" \
  -F "attachment=@./some-screenshot.png;type=image/png"
```
Expected: `201`. Then open `$FEEDBACK_PORTAL_URL/` in a browser — the two submissions appear newest-first, the image thumbnail renders.

- [ ] **Step 5: Record the URL + key** in the team password manager (1Password) for the in-app build secrets. Do not commit them.

---

## Self-Review (completed during planning)

- **Spec coverage:** stack (Task 1), Postgres + schema (Tasks 2–3), ingest with key + rate limit + storage + validation (Tasks 4–7), unlisted viewer + attachment streaming (Task 8), Railway deploy + volume (Task 9), e2e smoke (Task 10). All spec section B + transport-contract items mapped.
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `FeedbackRow`, `insertFeedback`, `getFeedback`, `getFeedbackById`, `saveAttachment`, `readAttachment`, `isWriteKeyValid`, `isAllowedMime`, `extForMime`, `sanitizeFilename`, `feedbackRateLimiter.check` used consistently across tasks.
