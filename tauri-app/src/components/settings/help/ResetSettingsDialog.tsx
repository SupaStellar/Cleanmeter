import * as React from "react";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Button } from "@/app/components/Button";
import { CloseIcon } from "../settings/FeedbackDialog";

// Warning icon — Figma 3041:6969 (Material "warning", 20×20), exported path.
// Inline so it can take currentColor: Figma binds it to #61646c in light and
// #85888e in dark, which is --iconSubtler.
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M2.27066 17.5C2.11788 17.5 1.97899 17.4618 1.85399 17.3854C1.72899 17.309 1.63177 17.2083 1.56232 17.0833C1.49288 16.9583 1.45469 16.8229 1.44774 16.6771C1.4408 16.5313 1.47899 16.3889 1.56232 16.25L9.27066 2.91667C9.35399 2.77778 9.46163 2.67361 9.59357 2.60417C9.72552 2.53472 9.86094 2.5 9.99982 2.5C10.1387 2.5 10.2741 2.53472 10.4061 2.60417C10.538 2.67361 10.6457 2.77778 10.729 2.91667L18.4373 16.25C18.5207 16.3889 18.5589 16.5313 18.5519 16.6771C18.545 16.8229 18.5068 16.9583 18.4373 17.0833C18.3679 17.2083 18.2707 17.309 18.1457 17.3854C18.0207 17.4618 17.8818 17.5 17.729 17.5H2.27066ZM3.70816 15.8333H16.2915L9.99982 5L3.70816 15.8333ZM10.5936 14.7604C10.7533 14.6007 10.8332 14.4028 10.8332 14.1667C10.8332 13.9306 10.7533 13.7326 10.5936 13.5729C10.4339 13.4132 10.2359 13.3333 9.99982 13.3333C9.76371 13.3333 9.5658 13.4132 9.40607 13.5729C9.24635 13.7326 9.16649 13.9306 9.16649 14.1667C9.16649 14.4028 9.24635 14.6007 9.40607 14.7604C9.5658 14.9201 9.76371 15 9.99982 15C10.2359 15 10.4339 14.9201 10.5936 14.7604ZM10.5936 12.2604C10.7533 12.1007 10.8332 11.9028 10.8332 11.6667V9.16667C10.8332 8.93056 10.7533 8.73264 10.5936 8.57292C10.4339 8.41319 10.2359 8.33333 9.99982 8.33333C9.76371 8.33333 9.5658 8.41319 9.40607 8.57292C9.24635 8.73264 9.16649 8.93056 9.16649 9.16667V11.6667C9.16649 11.9028 9.24635 12.1007 9.40607 12.2604C9.5658 12.4201 9.76371 12.5 9.99982 12.5C10.2359 12.5 10.4339 12.4201 10.5936 12.2604Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface ResetSettingsDialogProps {
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
}

export function ResetSettingsDialog({ pending, error, onConfirm }: ResetSettingsDialogProps) {
  const closeRef = React.useRef<HTMLButtonElement>(null);

  return (
    <DialogPortal>
      <DialogOverlay className="top-[52px]" />
      <DialogContent
        className="top-[calc(50%+26px)] max-h-[calc(100dvh-100px)] w-[calc(100%-48px)] max-w-[603px] gap-[var(--spacingL)] overflow-y-auto rounded-[12px] p-[var(--spacingL)] shadow-[inset_0_-1px_0_var(--borderSubtle)]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          closeRef.current?.focus();
        }}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onInteractOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <div className="flex flex-col gap-[var(--spacingS)]">
          <div className="flex items-start justify-between">
            <div className="flex size-[var(--spacingXxxl)] shrink-0 items-center justify-center rounded-full border border-[var(--borderBold)] bg-[var(--bgSurfaceRaised)]">
              <WarningIcon className="-translate-y-px text-[var(--iconSubtler)]" />
            </div>
            <DialogClose
              ref={closeRef}
              aria-label="Close"
              disabled={pending}
              className="flex size-[var(--spacingL)] items-center justify-center rounded-[4px] text-[var(--iconBolderActive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-wait disabled:opacity-50"
            >
              <CloseIcon className="size-[var(--spacingL)]" />
            </DialogClose>
          </div>
          <div className="flex flex-col gap-[var(--spacingXxs)]">
            <DialogTitle className="leading-[19px]">Reset all settings to defaults</DialogTitle>
            <DialogDescription className="font-normal leading-[21px] text-[var(--textParagraph1)]">
              This clears your shortcuts, temperature unit, pixel-shift tuning, polling rate, and theme, and puts everything back the way it shipped.
            </DialogDescription>
          </div>
        </div>
        {error && <p role="alert" className="text-body-sm-regular text-[var(--iconDanger)]">{error}</p>}
        <Button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          aria-busy={pending}
          className="h-[var(--spacingXxxl)] justify-self-end bg-[var(--bgDanger)] text-[var(--textInverse)] dark:bg-[var(--red400)] hover:bg-[var(--bgDangerHover)] active:bg-[var(--bgDangerActive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-wait disabled:opacity-50"
        >
          {pending ? "Resetting…" : "Confirm"}
        </Button>
      </DialogContent>
    </DialogPortal>
  );
}
