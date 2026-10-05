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
import warningIcon from "@/assets/reset/warning.svg";

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
              <img src={warningIcon} alt="" className="-translate-y-px" />
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
