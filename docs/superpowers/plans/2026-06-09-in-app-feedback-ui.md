# In-App Feedback UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Give feedback" entry row + dialog to the Cleanmeter Settings tab (Figma 1:1) that submits to the feedback portal — without changing any existing app behavior.

**Architecture:** Purely additive. A new `Textarea` primitive, a `FeedbackDialog`, and a `FeedbackPrompt` row are added to the Settings tab. Submission flows through a new `submitFeedback` binding in `lib/tauri.ts` to a new Rust `submit_feedback` command that POSTs to the portal. Attachment files are picked via the Tauri dialog plugin (path → Rust → bytes), keeping file bytes out of the JS layer. In browser dev all Tauri calls no-op, so the UI is previewable.

**Tech Stack:** React 19 + TypeScript, Tailwind v4 + project CSS tokens, shadcn/Radix dialog, Storybook (vitest browser tests), Tauri 2 (Rust), `reqwest`, `tauri-plugin-dialog`.

**Repo / cwd:** `Cleanmeter-supastellar/tauri-app` unless a path says `src-tauri`.

**Spec:** `docs/superpowers/specs/2026-06-09-in-app-feedback-and-portal-design.md`
**Prereq:** The portal is deployed (see `2026-06-09-feedback-portal.md`); `FEEDBACK_PORTAL_URL` + `FEEDBACK_WRITE_KEY` exist as build secrets.

---

## CRITICAL: No regressions

This feature must not alter any existing setting or behavior. Rules for every task:
- Touch only the new files listed, plus the three explicit additive edits: `SettingsTab.tsx` (insert one row), `lib/tauri.ts` (append exports), `src-tauri` (append one command + plugin + deps).
- Never modify existing functions, the settings store, or other commands.
- Task 7 is a mandatory regression gate (typecheck + build + existing Storybook tests + manual smoke of every current setting).

## Exact Figma values (source of truth — node 2488:5946 dialog, 2488:5311 entry row)

| Element | Value |
| --- | --- |
| Card surface | `bg-[var(--bgSurfaceRaised)]` (#FFF), `rounded-[12px]`, `p-5` (20px) |
| Heading text | 14px / 500 → `text-body-sm-medium`, `text-[var(--textHeading)]` (#0C111D) |
| Secondary text + placeholders | 14px / 400 → `text-body-sm-regular`, `text-[var(--textParagraph2)]` (#61646C) |
| Input/textarea box | `rounded-[var(--cornerL)]` (8px), `border-[var(--borderBolder)]` (#CECFD2), shadow `0 1px 2px rgba(0,0,0,0.05)`, padding 12px |
| Message textarea height | 200px |
| Dialog width | `max-w-[603px]` |
| Dialog title | "Give feedback" 16px / 500 → existing `DialogTitle` defaults (no override) |
| Header divider | `border-b border-[var(--borderSubtle)]` (#ECECED) |
| Submit button | dark pill: `filled-dark`, `rounded-[var(--cornerRound)]` (100), px 20 / py 12, "Submit" `text-body-sm-medium` `text-[var(--textInverse)]` |
| Entry-row button | white pill: `border border-[var(--borderBolder)]/50`, `rounded-[var(--cornerRound)]`, px 20 / py 12, "Give feedback" `text-body-sm-medium` `text-[var(--textHeading)]` |
| Entry-row lines | "Encountered an issue or have suggestions?" (heading) + "We'd love to hear from you!" (secondary), `gap-[6px]` |

---

## Task 1: `Textarea` primitive + story

**Files:**
- Create: `src/components/shadcn/textarea.tsx`
- Create: `src/app/components/stories/Textarea.stories.tsx`

- [ ] **Step 1: Create the Textarea primitive**

`src/components/shadcn/textarea.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

// Matches the DS Input box (Figma 2488:5967): white surface, 8px radius,
// borderBolder, 12px padding, 0 1px 2px rgba(0,0,0,0.05) shadow, brand focus.
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[200px] w-full resize-none rounded-[var(--cornerL)] bg-[var(--bgSurfaceRaised)]",
        "border border-[var(--borderBolder)] px-[var(--spacingS)] py-[var(--spacingS)]",
        "text-body-sm-regular text-[var(--textHeading)] outline-none",
        "shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]",
        "placeholder:text-[var(--textParagraph2)]",
        "[&:not(:placeholder-shown)]:font-[var(--textFontWeightMedium)]",
        "transition-shadow",
        "focus:border-[var(--borderBrand)] focus:shadow-[0px_0px_0px_3px_var(--gray300),0px_1px_2px_0px_rgba(0,0,0,0.05)]",
        "disabled:cursor-not-allowed disabled:text-[var(--textDisabled)]",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
```

- [ ] **Step 2: Create the Storybook story**

`src/app/components/stories/Textarea.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "../../../components/shadcn/textarea";

const meta: Meta<typeof Textarea> = {
  title: "Components/Textarea",
  component: Textarea,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Textarea>;

export const Empty: Story = {
  render: () => (
    <div style={{ width: 563 }}>
      <Textarea placeholder="Your feedback here..." />
    </div>
  ),
};

export const Filled: Story = {
  render: () => (
    <div style={{ width: 563 }}>
      <Textarea defaultValue={"Line one\nLine two"} />
    </div>
  ),
};
```

- [ ] **Step 3: Verify types + Storybook render**

Run: `npx tsc --noEmit`
Expected: exits 0.
Run: `npm run storybook` then open `Components/Textarea`.
Expected: box renders with 8px radius, gray border, placeholder text; 200px min height.

- [ ] **Step 4: Commit**

```bash
git add src/components/shadcn/textarea.tsx src/app/components/stories/Textarea.stories.tsx
git commit -m "feat(ds): add Textarea primitive matching Input box"
```

---

## Task 2: `FeedbackDialog` component + stories

**Files:**
- Create: `src/components/settings/settings/FeedbackDialog.tsx`
- Create: `src/app/components/stories/FeedbackDialog.stories.tsx`

- [ ] **Step 1: Create the dialog component**

`src/components/settings/settings/FeedbackDialog.tsx`:

```tsx
import * as React from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Label } from "@/components/shadcn/label";
import { Input } from "@/app/components/Input";
import { Textarea } from "@/components/shadcn/textarea";
import { Button } from "@/app/components/Button";
import { cn } from "@/lib/utils";
import { submitFeedback, pickImageAttachment } from "@/lib/tauri";

// Close icon — Figma 2488:5953 (20×20, #61646C → iconBolderActive).
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M10.0007 11.1673L5.91732 15.2507C5.76454 15.4034 5.5701 15.4798 5.33398 15.4798C5.09787 15.4798 4.90343 15.4034 4.75065 15.2507C4.59787 15.0979 4.52148 14.9034 4.52148 14.6673C4.52148 14.4312 4.59787 14.2368 4.75065 14.084L8.83398 10.0007L4.75065 5.91732C4.59787 5.76454 4.52148 5.5701 4.52148 5.33398C4.52148 5.09787 4.59787 4.90343 4.75065 4.75065C4.90343 4.59787 5.09787 4.52148 5.33398 4.52148C5.5701 4.52148 5.76454 4.59787 5.91732 4.75065L10.0007 8.83398L14.084 4.75065C14.2368 4.59787 14.4312 4.52148 14.6673 4.52148C14.9034 4.52148 15.0979 4.59787 15.2507 4.75065C15.4034 4.90343 15.4798 5.09787 15.4798 5.33398C15.4798 5.5701 15.4034 5.76454 15.2507 5.91732L11.1673 10.0007L15.2507 14.084C15.4034 14.2368 15.4798 14.4312 15.4798 14.6673C15.4798 14.9034 15.4034 15.0979 15.2507 15.2507C15.0979 15.4034 14.9034 15.4798 14.6673 15.4798C14.4312 15.4798 14.2368 15.4034 14.084 15.2507L10.0007 11.1673Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Add icon — Figma 2488:6010 (Material "add", 20×20).
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M9.16667 10.8333H4.16667C3.93056 10.8333 3.73264 10.7535 3.57292 10.5937C3.41319 10.434 3.33333 10.2361 3.33333 10C3.33333 9.76389 3.41319 9.56597 3.57292 9.40625C3.73264 9.24653 3.93056 9.16667 4.16667 9.16667H9.16667V4.16667C9.16667 3.93056 9.24653 3.73264 9.40625 3.57292C9.56597 3.41319 9.76389 3.33333 10 3.33333C10.2361 3.33333 10.434 3.41319 10.5938 3.57292C10.7535 3.73264 10.8333 3.93056 10.8333 4.16667V9.16667H15.8333C16.0694 9.16667 16.2674 9.24653 16.4271 9.40625C16.5868 9.56597 16.6667 9.76389 16.6667 10C16.6667 10.2361 16.5868 10.434 16.4271 10.5937C16.2674 10.7535 16.0694 10.8333 15.8333 10.8333H10.8333V15.8333C10.8333 16.0694 10.7535 16.2674 10.5938 16.4271C10.434 16.5868 10.2361 16.6667 10 16.6667C9.76389 16.6667 9.56597 16.5868 9.40625 16.4271C9.24653 16.2674 9.16667 16.0694 9.16667 15.8333V10.8333Z"
        fill="currentColor"
      />
    </svg>
  );
}

type Attachment = { path: string; name: string };
type Status = "idle" | "submitting" | "error";

export interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Injected so Storybook/tests can simulate the OS file picker.
  pickAttachment?: () => Promise<Attachment | null>;
}

export function FeedbackDialog({
  open,
  onOpenChange,
  pickAttachment = pickImageAttachment,
}: FeedbackDialogProps) {
  const [name, setName] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [attachment, setAttachment] = React.useState<Attachment | null>(null);
  const [status, setStatus] = React.useState<Status>("idle");

  // Reset everything whenever the dialog closes.
  React.useEffect(() => {
    if (!open) {
      setName("");
      setMessage("");
      setAttachment(null);
      setStatus("idle");
    }
  }, [open]);

  const canSubmit = message.trim() !== "" && status !== "submitting";

  const handlePick = async () => {
    const picked = await pickAttachment();
    if (picked) setAttachment(picked);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStatus("submitting");
    try {
      await submitFeedback({
        name: name.trim(),
        message: message.trim(),
        attachmentPath: attachment?.path,
      });
      onOpenChange(false);
    } catch {
      setStatus("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="top-[52px]" />
        <DialogContent
          aria-describedby={undefined}
          className={cn(
            "left-1/2 top-[77px] -translate-x-1/2 translate-y-0",
            "grid w-[calc(100%-48px)] max-w-[603px] grid-rows-[auto_1fr] gap-0 overflow-hidden",
            "rounded-[12px] bg-[var(--bgSurfaceRaised)] shadow-lg",
            "data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--borderSubtle)] p-5">
            <DialogTitle>Give feedback</DialogTitle>
            <DialogClose
              aria-label="Close"
              className={cn(
                "relative flex size-5 items-center justify-center text-[var(--iconBolderActive)]",
                "transition-transform duration-100 active:scale-[0.92] motion-reduce:transition-none",
                "rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "before:absolute before:inset-[-12px] before:content-['']",
                "[touch-action:manipulation]",
              )}
            >
              <CloseIcon className="size-5" />
            </DialogClose>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-5 p-5">
            <div className="flex flex-col gap-2">
              <Label className="text-body-sm-medium text-[var(--textHeading)]" htmlFor="fb-name">
                Name
              </Label>
              <Input
                id="fb-name"
                placeholder="Ex: Leon Kennedy"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-body-sm-medium text-[var(--textHeading)]" htmlFor="fb-message">
                Message
              </Label>
              <Textarea
                id="fb-message"
                placeholder="Your feedback here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {/* Attachment chip (shown once a file is picked) */}
            {attachment && (
              <div className="flex items-center justify-between gap-2 rounded-[var(--cornerL)] border border-[var(--borderBolder)] px-3 py-2">
                <span className="truncate text-body-sm-medium text-[var(--textHeading)]">
                  {attachment.name}
                </span>
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick={() => setAttachment(null)}
                  className="flex size-5 shrink-0 items-center justify-center rounded-[4px] text-[var(--iconBolderActive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CloseIcon className="size-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handlePick}
              className="flex w-fit items-center gap-2 rounded-[4px] text-[var(--textHeading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PlusIcon className="size-5" />
              <span className="text-body-sm-medium">Add attachment</span>
            </button>

            {status === "error" && (
              <p className="text-body-sm-regular text-[var(--iconDanger)]">
                Couldn’t send feedback. Please try again.
              </p>
            )}

            <Button
              type="button"
              variant="filled-dark"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="ml-auto h-10 rounded-[var(--cornerRound)] px-5 py-3 text-body-sm-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "submitting" ? "Sending…" : "Submit"}
            </Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create the stories (empty + attached)**

`src/app/components/stories/FeedbackDialog.stories.tsx`:

```tsx
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FeedbackDialog } from "../../../components/settings/settings/FeedbackDialog";

const meta: Meta<typeof FeedbackDialog> = {
  title: "Settings/FeedbackDialog",
  component: FeedbackDialog,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof FeedbackDialog>;

// Stubbed picker so the story can show the attachment chip without an OS dialog.
const fakePicker = async () => ({ path: "/tmp/Screenshot245.jpeg", name: "Screenshot245.jpeg" });

export const Empty: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return <FeedbackDialog open={open} onOpenChange={setOpen} pickAttachment={fakePicker} />;
  },
};

export const WithAttachment: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    // Click "Add attachment" in the rendered story to show the chip.
    return <FeedbackDialog open={open} onOpenChange={setOpen} pickAttachment={fakePicker} />;
  },
};
```

- [ ] **Step 3: Verify types + Storybook**

Run: `npx tsc --noEmit`
Expected: exits 0.
Run: `npm run storybook`, open `Settings/FeedbackDialog → Empty`.
Expected: dialog matches Figma — title + X, Name input, Message textarea, "+ Add attachment", right-aligned dark "Submit". Click "Add attachment" → chip with "Screenshot245.jpeg" + remove X appears.

- [ ] **Step 4: Figma parity check**

Capture the dialog in the browser/Storybook and compare against Figma node `2488:5946` (empty) and `2488:6012` (attached). Adjust spacing/colors only if they deviate. Confirm: title 16/medium, labels 14/medium #0C111D, placeholders #61646C, input radius 8 + border #CECFD2, submit dark pill radius 100.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/settings/FeedbackDialog.tsx src/app/components/stories/FeedbackDialog.stories.tsx
git commit -m "feat(settings): add FeedbackDialog matching Figma"
```

---

## Task 3: `FeedbackPrompt` entry row + wire into SettingsTab

**Files:**
- Modify: `src/components/settings/settings/SettingsTab.tsx`

- [ ] **Step 1: Add the FeedbackPrompt component + state to SettingsTab**

In `SettingsTab.tsx`, add imports at the top (after the existing imports):

```tsx
import { FeedbackDialog } from "./FeedbackDialog";
```

Add this component above `export function SettingsTab()`:

```tsx
function FeedbackPrompt() {
  const [open, setOpen] = React.useState(false);
  return (
    <section className="flex w-full items-center justify-between gap-3 rounded-[12px] bg-[var(--bgSurfaceRaised)] p-5">
      <div className="flex flex-col gap-[6px]">
        <span className="text-body-sm-medium text-[var(--textHeading)]">
          Encountered an issue or have suggestions?
        </span>
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">
          We&apos;d love to hear from you!
        </span>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "shrink-0 rounded-[var(--cornerRound)] border border-[var(--borderBolder)]/50 bg-[var(--bgSurfaceRaised)] px-5 py-3",
          "text-body-sm-medium text-[var(--textHeading)] transition-colors",
          "hover:border-[var(--borderBolder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      >
        Give feedback
      </button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </section>
  );
}
```

- [ ] **Step 2: Insert the row into the layout**

In `SettingsTab`'s returned JSX, the second column group currently is:

```tsx
      <div className="flex w-full flex-col gap-6">
        <div className="flex gap-3">
          <FooterLinkButton
```

Insert `<FeedbackPrompt />` as the first child of that `flex w-full flex-col gap-6` div, before the `<div className="flex gap-3">`:

```tsx
      <div className="flex w-full flex-col gap-6">
        <FeedbackPrompt />
        <div className="flex gap-3">
          <FooterLinkButton
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Verify in browser dev against Figma**

Run: `npm run dev` (already running on http://localhost:1420). Navigate to the Settings tab.
Expected: the "Encountered an issue…" row appears between Appearance and the "Check for updates / Discord" row; "Give feedback" opens the dialog. Compare the row against Figma node `2488:5311`.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/settings/SettingsTab.tsx
git commit -m "feat(settings): add Give feedback entry row"
```

---

## Task 4: `submitFeedback` + `pickImageAttachment` bindings

**Files:**
- Modify: `src/lib/tauri.ts`
- Modify: `package.json` (add `@tauri-apps/plugin-dialog`)

- [ ] **Step 1: Add the dialog plugin npm package**

Run: `npm install @tauri-apps/plugin-dialog`
Expected: added to dependencies.

- [ ] **Step 2: Append the bindings to `lib/tauri.ts`**

Add at the end of `src/lib/tauri.ts` (after the System Commands section):

```ts
// ─── Feedback Commands ──────────────────────────────────────────

export const submitFeedback = (input: {
  name: string;
  message: string;
  attachmentPath?: string;
}) => safeInvoke("submit_feedback", { input });

// Opens the OS image picker and returns the absolute path + display name.
// Browser preview has no Tauri runtime, so it returns null (no-op).
export const pickImageAttachment = async (): Promise<
  { path: string; name: string } | null
> => {
  if (isBrowser) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
  });
  if (typeof selected !== "string") return null;
  const name = selected.split(/[/\\]/).pop() ?? "attachment";
  return { path: selected, name };
};
```

- [ ] **Step 3: Verify types + build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/tauri.ts package.json package-lock.json
git commit -m "feat(settings): add submitFeedback + image picker bindings"
```

---

## Task 5: Rust `submit_feedback` command

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Create: `src-tauri/.env.example`

- [ ] **Step 1: Add Cargo dependencies**

In `src-tauri/Cargo.toml`, under `[dependencies]`, add:

```toml
tauri-plugin-dialog = "2"
reqwest = { version = "0.12", default-features = false, features = ["multipart", "rustls-tls"] }
```

- [ ] **Step 2: Register the dialog plugin**

In `src-tauri/src/lib.rs`, next to the other `.plugin(...)` lines (around line 74), add:

```rust
        .plugin(tauri_plugin_dialog::init())
```

- [ ] **Step 3: Add the `submit_feedback` command to `commands.rs`**

Append to `src-tauri/src/commands.rs`:

```rust
use serde::Deserialize;

#[derive(Deserialize)]
pub struct FeedbackInput {
    pub name: String,
    pub message: String,
    #[serde(rename = "attachmentPath")]
    pub attachment_path: Option<String>,
}

// POSTs feedback to the portal. URL + write key are injected at build time;
// if either is missing (e.g. local dev builds), the command returns an error
// instead of attempting a request. Does not touch any app state.
#[tauri::command]
pub async fn submit_feedback(input: FeedbackInput) -> Result<(), String> {
    let portal = option_env!("FEEDBACK_PORTAL_URL")
        .ok_or("feedback portal not configured")?;
    let key = option_env!("FEEDBACK_WRITE_KEY")
        .ok_or("feedback key not configured")?;

    let mut form = reqwest::multipart::Form::new()
        .text("name", input.name)
        .text("message", input.message)
        .text("app_version", env!("CARGO_PKG_VERSION"))
        .text("os", std::env::consts::OS);

    if let Some(path) = input.attachment_path.as_deref() {
        let bytes = std::fs::read(path).map_err(|e| format!("read attachment: {e}"))?;
        let filename = std::path::Path::new(path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("attachment")
            .to_string();
        let part = reqwest::multipart::Part::bytes(bytes).file_name(filename);
        form = form.part("attachment", part);
    }

    let resp = reqwest::Client::new()
        .post(format!("{portal}/api/feedback"))
        .header("x-feedback-key", key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("portal returned {}", resp.status()))
    }
}
```

- [ ] **Step 4: Register the command in the invoke handler**

In `src-tauri/src/lib.rs`, inside `tauri::generate_handler![ ... ]` (ends at line ~437), add a line after `commands::ui_debug_log,`:

```rust
            commands::submit_feedback,
```

- [ ] **Step 5: Add the dialog capability**

In `src-tauri/capabilities/default.json`, add to the `permissions` array:

```json
    "dialog:default",
    "dialog:allow-open"
```

- [ ] **Step 6: Document the build secrets**

Create `src-tauri/.env.example`:

```
# Injected at build time (CI secrets). NOT committed with real values.
# The Rust command reads these via option_env! at compile time.
FEEDBACK_PORTAL_URL=https://your-portal.up.railway.app
FEEDBACK_WRITE_KEY=replace-with-the-same-key-as-the-portal
```

- [ ] **Step 7: Verify the Rust build**

Run: `cd src-tauri && cargo check`
Expected: compiles (warnings about unused `option_env!` when unset are acceptable; no errors).

- [ ] **Step 8: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/commands.rs src-tauri/src/lib.rs src-tauri/capabilities/default.json src-tauri/.env.example
git commit -m "feat(tauri): add submit_feedback command and dialog plugin"
```

---

## Task 6: End-to-end submission

**Files:** none (verification)

- [ ] **Step 1: Build with the portal secrets set**

Run (PowerShell):
```powershell
$env:FEEDBACK_PORTAL_URL = "<deployed portal url>"
$env:FEEDBACK_WRITE_KEY  = "<same key as portal>"
npm run tauri:dev
```
Expected: app launches (requires .NET 8 runtime + admin for monitoring; feedback works regardless).

- [ ] **Step 2: Submit without an attachment**

In the running app: Settings → Give feedback → enter a message → Submit.
Expected: dialog closes; the row appears in the portal viewer (`$FEEDBACK_PORTAL_URL/`) with the right app version + `windows` OS.

- [ ] **Step 3: Submit with an attachment**

Reopen → add an image via "Add attachment" (chip shows filename) → Submit.
Expected: portal shows the submission with a working image thumbnail.

- [ ] **Step 4: Verify the empty-message guard**

Open the dialog, leave Message empty.
Expected: Submit is disabled (greyed). Type a character → enabled.

---

## Task 7: Regression gate (no existing functionality harmed)

**Files:** none (verification)

- [ ] **Step 1: Type + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass with no new errors.

- [ ] **Step 2: Run the existing Storybook test suite**

Run: `npm test`
Expected: all existing storybook tests pass (plus the new Textarea/FeedbackDialog stories render).

- [ ] **Step 3: Manual smoke of every existing setting** (browser dev, http://localhost:1420, Settings tab)

Confirm each still works exactly as before:
- General: "Start with windows" + "Start minimized" toggle.
- Temperature units: Celsius/Fahrenheit radio switches.
- Polling rate: dropdown changes value.
- Appearance: Light/Dark/System selection updates theme.
- Footer: "Join the discord server!" link opens; "Check for latest updates" stays disabled.
- Stats tab: sensor sections + the Sensor Picker modal still open/close normally (shares the dialog primitive).
Expected: identical behavior to pre-change. The only visible difference is the new feedback row.

- [ ] **Step 4: Rust regression**

Run: `cd src-tauri && cargo check`
Expected: compiles; no changes to existing commands.

- [ ] **Step 5: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "test: verify no regressions for feedback feature"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** entry row (Task 3), dialog with Name/Message/attachment/submit (Task 2), Textarea primitive (Task 1), transport binding (Task 4), Rust command + metadata + build secrets (Task 5), e2e (Task 6), regression safety (Task 7). All spec section A items mapped.
- **Placeholder scan:** none — all code/values concrete from Figma nodes 2488:5946, 2488:5954, 2488:5311 and real component APIs (`Button` `filled-dark`, `Input`, `dialog`, `Label`).
- **Type consistency:** `FeedbackDialogProps`, `Attachment {path,name}`, `submitFeedback({name,message,attachmentPath?})`, `pickImageAttachment(): {path,name}|null`, and the Rust `FeedbackInput { name, message, attachmentPath }` all line up across JS ↔ Rust (the `#[serde(rename = "attachmentPath")]` matches the camelCase sent from `lib/tauri.ts`).
- **Regression guard:** every task lists exact files; only 3 existing files get additive edits; Task 7 verifies the rest.
```
