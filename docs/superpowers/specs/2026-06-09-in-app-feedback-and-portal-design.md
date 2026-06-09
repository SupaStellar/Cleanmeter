# In-App Feedback + Feedback Portal — Design Spec

**Date:** 2026-06-09
**Author:** Saad (Crispy Studio)
**Status:** Approved design, pending implementation plan

## Summary

Add a "Give feedback" capability to the Cleanmeter desktop app's Settings page,
matching the Figma design 1:1, and stand up a private web portal (deployed on
Railway) where the team can read incoming submissions. Submissions travel
directly from the app to the portal's ingest API. Nothing in the existing app
changes apart from the additive feedback feature in the Settings tab.

Figma source of truth: `Cleanmeter` file, node `2488-5109` (Settings v1.2 section),
which contains the settings layout + both feedback-dialog states.

## Scope & Constraints

- **Match Figma 1:1** for the in-app UI (entry row + dialog, both empty and
  with-attachment states). Pull exact tokens/spacing/radii per-node from Figma
  during the build pass — do not eyeball.
- **Use DS components** wherever one exists; build a new primitive only where the
  DS lacks it (a `Textarea`).
- **Zero behavioral change** to any existing setting or app functionality. The
  feedback feature is purely additive — new components + one new Rust command,
  alongside existing code paths, never modifying them.
- **Open-source ready (going public later, not now).** Cleanmeter will be open
  sourced at a future date, so the app repo must contain no secrets and no portal
  internals. Building for that now costs nothing extra and avoids rework later.

## Two Deliverables (separate repos)

| Repo | Visibility | Contents |
| --- | --- | --- |
| `Cleanmeter` (this repo) | Public / open source | Additive in-app feedback UI + Rust `submit_feedback` command. No secrets committed. |
| `cleanmeter-feedback-portal` (new) | Private | Next.js portal: ingest API + viewer. Railway Postgres + volume. |

**Why separate + private portal:** open-sourcing the app would otherwise publish
the feedback viewer (an unlisted, no-auth page showing all submissions +
attachments), the DB schema, and ingest internals. Separate repos also guarantee
portal work cannot touch app code, eliminating any risk to existing settings
behavior.

---

## A. In-App Feedback UI (Cleanmeter repo)

### A1. Entry row in `SettingsTab`

A new row inserted between the Appearance `SectionCard` and the
"Check for latest updates / Join the discord server" footer-link row
(`src/components/settings/settings/SettingsTab.tsx`):

- Left: bold heading "Encountered an issue or have suggestions?" + subtle line
  "We'd love to hear from you!"
- Right: a **Give feedback** text button that opens `FeedbackDialog`.

Implemented as a small local component (e.g. `FeedbackPrompt`) in the settings
folder, consistent with the existing `FooterLinkButton` / `SectionCard` pattern.

### A2. `FeedbackDialog`

Location: `src/components/settings/settings/FeedbackDialog.tsx` (co-located with
the settings tab, consistent with the existing settings component layout).

Built from existing DS / primitive components:

- **`@/components/shadcn/dialog`** — dialog shell, overlay, X close button.
- **`@/components/shadcn/label`** — field labels ("Name", "Message").
- **`@/app/components/Input`** (DS) — Name field, placeholder `Ex. Liam Kennedy`.
- **`@/components/shadcn/textarea`** — Message field, placeholder
  `Your feedback here…`. **New primitive** (see A3).
- **`@/app/components/Button`** (DS) — dark **Submit** button.
- **Add-attachment trigger** — a "+ Add attachment" text/icon button.
- **Attachment chip** — when a file is picked, render a removable chip
  (file icon + filename, e.g. `Screenshot.05.jpeg`, + ✕ to remove). Matches the
  Figma "with attachment" state.

**Local state:** `name`, `message`, `attachment` (`{ path, name } | null`),
`status` (`idle | submitting | success | error`).

**Behavior:**

- "Add attachment" opens the Tauri file dialog (images), stores the returned
  path + display name, renders the chip. Removing clears it.
- "Submit" → calls `submitFeedback(...)` (see A4). On success: show success state
  then close + reset. On error: show an inline error, keep the form populated.
- Submit disabled while `submitting` or when Message is empty.
- In plain `vite` browser dev, submit/attachment are no-ops (graceful) so the UI
  is fully previewable while building.

### A3. New `Textarea` primitive

`src/components/shadcn/textarea.tsx`. No textarea exists in the codebase yet.
Style it to match the existing `Input` (`@/app/components/Input` / shadcn input):
same border, radius, padding, focus ring (`shadow-focus-default`), and tokens.
Props via `React.ComponentProps<"textarea">`, `cn()` for class merge — per project
component rules.

### A4. Transport binding (`lib/tauri.ts`)

Add to `src/lib/tauri.ts`, following the existing `safeInvoke` pattern:

```ts
export const submitFeedback = (input: {
  name: string;
  message: string;
  attachmentPath?: string; // file path picked via the Tauri dialog
}) => safeInvoke("submit_feedback", { input });
```

`isBrowser` → no-op (returns undefined), so the dialog renders and "submits"
harmlessly in browser dev.

### A5. Rust `submit_feedback` command (src-tauri)

A new Tauri command in `src-tauri`:

- Inputs: `name`, `message`, `attachment_path?`.
- Gathers metadata server-side-of-the-app: `app_version` (existing
  `CARGO_PKG_VERSION` / app version command), `os` (`std::env::consts::OS`).
- Reads the attachment bytes from `attachment_path` if present (keeps file bytes
  out of the JS layer).
- POSTs `multipart/form-data` to `{FEEDBACK_PORTAL_URL}/api/feedback` with header
  `x-feedback-key: {FEEDBACK_WRITE_KEY}` using an HTTP client (reqwest or the
  Tauri http plugin — confirm what's already a dependency during implementation).
- `FEEDBACK_PORTAL_URL` and `FEEDBACK_WRITE_KEY` are supplied at **build time** via
  env (CI secrets) — never committed to the public repo. A local `.env.example`
  documents the names with placeholder values.
- Returns `Ok(())` on 2xx; surfaces a typed error otherwise for the dialog to show.

Dependencies to confirm/add: Tauri **dialog** plugin (file picker), **fs** read
(or read in Rust), and an HTTP client. These are additive to `Cargo.toml` /
capabilities and touch no existing command.

---

## B. Feedback Portal (`cleanmeter-feedback-portal`, new private repo)

### B1. Stack

- **Next.js (App Router)**, deployed on **Railway**.
- **Railway Postgres** plugin for submissions.
- **Railway volume** mounted at `/data` for attachment files
  (`ATTACHMENT_DIR=/data/attachments`).

### B2. Database — `feedback` table

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (default gen) | primary key |
| `created_at` | timestamptz | default now() |
| `name` | text | may be empty |
| `message` | text | required |
| `app_version` | text | from app |
| `os` | text | from app |
| `attachment_name` | text \| null | original filename |
| `attachment_path` | text \| null | path on the volume |
| `attachment_mime` | text \| null | content type |

Created via a SQL migration committed to the portal repo.

### B3. Routes

- **`POST /api/feedback`** (`multipart/form-data`)
  - Validates `x-feedback-key` header == `FEEDBACK_WRITE_KEY` (401 otherwise).
  - **Rate-limited by client IP** (the real anti-abuse defense — see Security).
  - Fields: `name`, `message` (required), `app_version`, `os`,
    `attachment` (file, optional).
  - Validates attachment type (images) + size cap; rejects oversize/non-allowed.
  - Saves the file under `ATTACHMENT_DIR/{id}.{ext}`, inserts the row, returns
    `201`.
- **`GET /`**
  - Server-rendered list, newest first: name, message, relative timestamp,
    app version, OS, attachment thumbnail (if any).
  - **Unlisted, no auth** (per decision). Designed so a password gate can be
    added in front later with zero schema/UI rework.
- **`GET /api/attachment/[id]`**
  - Streams the file from the volume with its stored mime type.

### B4. Environment

| Var | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Railway | Postgres connection |
| `FEEDBACK_WRITE_KEY` | Railway + app build secret | Shared write key for ingest |
| `ATTACHMENT_DIR` | Railway | `/data/attachments` |

---

## Transport Contract (the seam between A and B)

```
POST {FEEDBACK_PORTAL_URL}/api/feedback
Content-Type: multipart/form-data
Header: x-feedback-key: {FEEDBACK_WRITE_KEY}

fields:
  name         string   (optional)
  message      string   (required)
  app_version  string
  os           string
  attachment   file     (optional, image)

→ 201 Created on success
→ 401 if key invalid
→ 429 if rate-limited
→ 4xx on validation failure (oversize / disallowed type / empty message)
```

The Rust command owns `FEEDBACK_PORTAL_URL` and the write key; the portal owns everything
behind the endpoint.

## Security / Honesty Notes

- A write key shipped in a desktop app is **extractable from the released binary** —
  inherent to any client-side secret, independent of repo layout. The key is
  best-effort anti-spam, not authentication. **Rate limiting on `/api/feedback`
  is the actual defense.**
- Keeping the portal repo private avoids publishing the key, the endpoint, and the
  no-auth viewer location.
- The viewer is intentionally no-auth per decision; attachments may contain
  user-desktop screenshots, so the URL should be treated as sensitive. A password
  gate can be added later without rework.

## Build Order

1. **Portal** (`cleanmeter-feedback-portal`): schema/migration → `POST /api/feedback`
   (key check + rate limit + storage) → `GET /` viewer → `GET /api/attachment/[id]`
   → deploy to Railway → obtain live `FEEDBACK_PORTAL_URL` + `FEEDBACK_WRITE_KEY`.
2. **In-app UI** (Cleanmeter): `Textarea` primitive → `FeedbackDialog` →
   `FeedbackPrompt` entry row → wire into `SettingsTab`. Verify against Figma in
   browser dev (`npm run dev`, localhost:1420).
3. **Rust `submit_feedback`** command + `lib/tauri.ts` binding + attachment picker.
4. **End-to-end verify** via `tauri:dev`: submit (with and without attachment) →
   confirm the row + attachment appear in the deployed portal.

## Out of Scope (YAGNI)

- Portal user accounts / per-user auth (decision: unlisted, no auth).
- Editing/responding to feedback from the portal (read-only list for now).
- Notifications (email/Slack/Discord on new feedback).
- Discord-webhook transport (rejected in favor of a real portal).
