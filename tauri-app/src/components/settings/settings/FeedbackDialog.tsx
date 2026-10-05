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
import { Textarea } from "@/app/components/Textarea";
import { Button } from "@/app/components/Button";
import { Checkbox } from "@/app/components/Checkbox";
import { cn } from "@/lib/utils";
import { submitFeedback, pickFeedbackAttachment } from "@/lib/tauri";

// Close icon — Figma 2488:5953 (20×20, #61646C → iconBolderActive), exported path.
export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M10 11.1673L5.91671 15.2507C5.76393 15.4034 5.56949 15.4798 5.33337 15.4798C5.09726 15.4798 4.90282 15.4034 4.75004 15.2507C4.59726 15.0979 4.52087 14.9034 4.52087 14.6673C4.52087 14.4312 4.59726 14.2368 4.75004 14.084L8.83337 10.0007L4.75004 5.91732C4.59726 5.76454 4.52087 5.5701 4.52087 5.33398C4.52087 5.09787 4.59726 4.90343 4.75004 4.75065C4.90282 4.59787 5.09726 4.52148 5.33337 4.52148C5.56949 4.52148 5.76393 4.59787 5.91671 4.75065L10 8.83398L14.0834 4.75065C14.2362 4.59787 14.4306 4.52148 14.6667 4.52148C14.9028 4.52148 15.0973 4.59787 15.25 4.75065C15.4028 4.90343 15.4792 5.09787 15.4792 5.33398C15.4792 5.5701 15.4028 5.76454 15.25 5.91732L11.1667 10.0007L15.25 14.084C15.4028 14.2368 15.4792 14.4312 15.4792 14.6673C15.4792 14.9034 15.4028 15.0979 15.25 15.2507C15.0973 15.4034 14.9028 15.4798 14.6667 15.4798C14.4306 15.4798 14.2362 15.4034 14.0834 15.2507L10 11.1673Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Add icon — Figma 2488:6010 (Material "add", 20×20), exported path. Its #1C1B1F
// has no token, so it renders in textHeading to follow the dark theme.
function AddIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M9.40625 17.2604C9.24653 17.1007 9.16667 16.9028 9.16667 16.6667V10.8333H3.33333C3.09722 10.8333 2.89931 10.7535 2.73958 10.5938C2.57986 10.434 2.5 10.2361 2.5 10C2.5 9.76389 2.57986 9.56597 2.73958 9.40625C2.89931 9.24653 3.09722 9.16667 3.33333 9.16667H9.16667V3.33333C9.16667 3.09722 9.24653 2.89931 9.40625 2.73958C9.56597 2.57986 9.76389 2.5 10 2.5C10.2361 2.5 10.434 2.57986 10.5938 2.73958C10.7535 2.89931 10.8333 3.09722 10.8333 3.33333V9.16667H16.6667C16.9028 9.16667 17.1007 9.24653 17.2604 9.40625C17.4201 9.56597 17.5 9.76389 17.5 10C17.5 10.2361 17.4201 10.434 17.2604 10.5938C17.1007 10.7535 16.9028 10.8333 16.6667 10.8333H10.8333V16.6667C10.8333 16.9028 10.7535 17.1007 10.5938 17.2604C10.434 17.4201 10.2361 17.5 10 17.5C9.76389 17.5 9.56597 17.4201 9.40625 17.2604Z"
        fill="currentColor"
      />
    </svg>
  );
}

// File icon — Figma 2488:6236 (Material "description", 20×20). Its #1C1B1F has
// no token, so it renders in textHeading to follow the dark theme.
function DescriptionIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M7.5 15H12.5C12.7361 15 12.934 14.9201 13.0938 14.7604C13.2535 14.6007 13.3333 14.4028 13.3333 14.1667C13.3333 13.9306 13.2535 13.7326 13.0938 13.5729C12.934 13.4132 12.7361 13.3333 12.5 13.3333H7.5C7.26389 13.3333 7.06597 13.4132 6.90625 13.5729C6.74653 13.7326 6.66667 13.9306 6.66667 14.1667C6.66667 14.4028 6.74653 14.6007 6.90625 14.7604C7.06597 14.9201 7.26389 15 7.5 15ZM7.5 11.6667H12.5C12.7361 11.6667 12.934 11.5868 13.0938 11.4271C13.2535 11.2674 13.3333 11.0694 13.3333 10.8333C13.3333 10.5972 13.2535 10.3993 13.0938 10.2396C12.934 10.0799 12.7361 10 12.5 10H7.5C7.26389 10 7.06597 10.0799 6.90625 10.2396C6.74653 10.3993 6.66667 10.5972 6.66667 10.8333C6.66667 11.0694 6.74653 11.2674 6.90625 11.4271C7.06597 11.5868 7.26389 11.6667 7.5 11.6667ZM5 18.3333C4.54167 18.3333 4.14931 18.1701 3.82292 17.8437C3.49653 17.5174 3.33333 17.125 3.33333 16.6667V3.33333C3.33333 2.875 3.49653 2.48264 3.82292 2.15625C4.14931 1.82986 4.54167 1.66667 5 1.66667H10.9792C11.2014 1.66667 11.4132 1.70833 11.6146 1.79167C11.816 1.875 11.9931 1.99306 12.1458 2.14583L16.1875 6.1875C16.3403 6.34028 16.4583 6.51736 16.5417 6.71875C16.625 6.92014 16.6667 7.13194 16.6667 7.35417V16.6667C16.6667 17.125 16.5035 17.5174 16.1771 17.8437C15.8507 18.1701 15.4583 18.3333 15 18.3333H5ZM10.8333 6.66667V3.33333H5V16.6667H15V7.5H11.6667C11.4306 7.5 11.2326 7.42014 11.0729 7.26042C10.9132 7.10069 10.8333 6.90278 10.8333 6.66667Z"
        fill="currentColor"
      />
    </svg>
  );
}

type Attachment = { path: string; name: string };

// Tauri rejects with the Rust error string, the browser preview with an Error.
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));
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
  pickAttachment = pickFeedbackAttachment,
}: FeedbackDialogProps) {
  const [name, setName] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [attachment, setAttachment] = React.useState<Attachment | null>(null);
  const [includeDiagnostics, setIncludeDiagnostics] = React.useState(false);
  const [error, setError] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const submitting = status === "submitting";

  // Picking a file swaps "Add attachment" for the chip and Remove swaps it
  // back, so focus moves to whichever control replaced the one just pressed.
  const addRef = React.useRef<HTMLButtonElement>(null);
  const removeRef = React.useRef<HTMLButtonElement>(null);
  const focusAfterSwap = React.useRef(false);

  // Reset everything whenever the dialog closes.
  React.useEffect(() => {
    if (!open) {
      setName("");
      setMessage("");
      setAttachment(null);
      setIncludeDiagnostics(false);
      setStatus("idle");
      setError("");
    }
  }, [open]);

  React.useEffect(() => {
    if (!focusAfterSwap.current) return;
    focusAfterSwap.current = false;
    (attachment ? removeRef : addRef).current?.focus();
  }, [attachment]);

  const canSubmit = message.trim() !== "" && !submitting;

  // Editing the report retires the previous failure message.
  const edit = (set: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    set(e.target.value);
    if (status === "error") {
      setStatus("idle");
      setError("");
    }
  };

  const handlePick = async () => {
    try {
      const picked = await pickAttachment();
      if (picked) {
        focusAfterSwap.current = true;
        setAttachment(picked);
        setStatus("idle");
        setError("");
      }
    } catch (err) {
      setError(`Couldn’t select an attachment: ${errorText(err)}`);
      setStatus("error");
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStatus("submitting");
    try {
      await submitFeedback({
        name: name.trim(),
        message: message.trim(),
        attachmentPath: attachment?.path,
        includeDiagnostics,
      });
      onOpenChange(false);
    } catch (err) {
      // Surface the underlying Rust error (e.g. "request failed", "portal
      // returned 401") so failures are diagnosable instead of opaque.
      console.error("submit_feedback failed:", err);
      setError(`Couldn’t send feedback: ${errorText(err)}`);
      setStatus("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="top-[52px]" />
        <DialogContent
          aria-describedby={undefined}
          // A send in flight can't be abandoned: the form would reset while
          // the request still resolves into it.
          onEscapeKeyDown={(e) => { if (submitting) e.preventDefault(); }}
          onInteractOutside={(e) => { if (submitting) e.preventDefault(); }}
          className={cn(
            "left-1/2 top-[76px] -translate-x-1/2 translate-y-0",
            "grid max-h-[calc(100dvh-100px)] w-[calc(100%-48px)] max-w-[603px] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden",
            "rounded-[12px] bg-[var(--bgSurfaceRaised)] shadow-lg",
            "data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2",
          )}
        >
          {/* Header */}
          <div className="flex h-[60px] items-center justify-between border-b border-[var(--borderSubtle)] p-5">
            <DialogTitle>Give feedback</DialogTitle>
            <DialogClose
              aria-label="Close"
              disabled={submitting}
              className={cn(
                "relative flex size-5 items-center justify-center text-[var(--iconBolderActive)]",
                "transition-transform duration-100 active:scale-[0.92] motion-reduce:transition-none",
                "rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "before:absolute before:inset-[-12px] before:content-['']",
                "[touch-action:manipulation]",
                "disabled:cursor-wait disabled:opacity-50",
              )}
            >
              <CloseIcon className="size-5" />
            </DialogClose>
          </div>

          {/* Body */}
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto p-5 [&>*]:shrink-0">
            <div className="flex flex-col gap-2">
              <Label className="text-body-sm-medium text-[var(--textHeading)]" htmlFor="fb-name">
                Name
              </Label>
              <Input
                id="fb-name"
                className="h-10"
                disabled={submitting}
                placeholder="Ex: Leon Kennedy"
                value={name}
                onChange={edit(setName)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-body-sm-medium text-[var(--textHeading)]" htmlFor="fb-message">
                Message
              </Label>
              <Textarea
                id="fb-message"
                className="h-[198px] min-h-0"
                disabled={submitting}
                placeholder="Your feedback here..."
                value={message}
                onChange={edit(setMessage)}
              />
            </div>

            {attachment ? (
              <div className="flex h-10 items-center gap-[var(--spacingXxs)] rounded-[var(--cornerL)] border border-[var(--borderBolder)] bg-[var(--bgSurfaceRaised)] p-[var(--spacingS)]">
                <div className="flex min-w-0 flex-1 items-center gap-[var(--spacingXs)]">
                  <DescriptionIcon className="size-5 shrink-0 text-[var(--textHeading)]" />
                  <span className="truncate text-body-sm-medium text-[var(--textHeading)]">
                    {attachment.name}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Remove attachment"
                  disabled={submitting}
                  ref={removeRef}
                  onClick={() => {
                    focusAfterSwap.current = true;
                    setAttachment(null);
                  }}
                  className="flex size-5 shrink-0 items-center justify-center rounded-[4px] text-[var(--iconBolderActive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  <CloseIcon className="size-5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                ref={addRef}
                disabled={submitting}
                onClick={handlePick}
                className={cn(
                  "flex h-10 w-full items-center justify-center gap-2 rounded-[var(--cornerL)] border border-dashed border-[var(--borderBolder)]",
                  "text-body-sm-medium text-[var(--textHeading)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <AddIcon className="size-5" />
                <span>Add attachment</span>
              </button>
            )}

            <Checkbox
              checked={includeDiagnostics}
              onCheckedChange={setIncludeDiagnostics}
              disabled={submitting}
              label="Include system specs and app logs"
              className="w-full rounded-[4px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            />
            {status === "error" && (
              <p role="alert" className="text-body-sm-regular text-[var(--iconDanger)]">
                {error || "Couldn’t send feedback. Please try again."}
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
