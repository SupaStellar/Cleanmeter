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
