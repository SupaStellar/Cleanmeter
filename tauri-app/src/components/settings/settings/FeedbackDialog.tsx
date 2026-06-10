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

// File icon — Figma 2488:6236 (Material "description", 20×20, #1C1B1F — no token).
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

            {/* Attachment chip (shown once a file is picked) — Figma 2488:6214:
                Input shell (40px height, 12px padding, 8px radius, borderBolder)
                with description icon + filename + remove ✕. */}
            {attachment && (
              <div className="flex h-10 items-center gap-[var(--spacingXxs)] rounded-[var(--cornerL)] border border-[var(--borderBolder)] bg-[var(--bgSurfaceRaised)] p-[var(--spacingS)]">
                <div className="flex min-w-0 flex-1 items-center gap-[var(--spacingXs)]">
                  {/* #1C1B1F has no token (Figma literal) and won't adapt —
                      follow the adjacent filename color in dark mode. */}
                  <DescriptionIcon className="size-5 shrink-0 text-[#1C1B1F] dark:text-[var(--textHeading)]" />
                  <span className="truncate text-body-sm-medium text-[var(--textHeading)]">
                    {attachment.name}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick={() => setAttachment(null)}
                  className="flex size-5 shrink-0 items-center justify-center rounded-[4px] text-[var(--iconBolderActive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CloseIcon className="size-5" />
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
