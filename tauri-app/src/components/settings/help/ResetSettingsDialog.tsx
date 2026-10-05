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
import closeIcon from "@/assets/reset/close.svg";
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
        className="top-[calc(50%+26px)] max-h-[calc(100dvh-100px)] w-[calc(100%-48px)] max-w-[603px] gap-5 overflow-y-auto rounded-[12px] border-b border-[var(--borderSubtle)] p-5"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          closeRef.current?.focus();
        }}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onInteractOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--borderBold)] bg-[var(--bgSurfaceRaised)]">
              <img src={warningIcon} alt="" />
            </div>
            <DialogClose
              ref={closeRef}
              aria-label="Close"
              disabled={pending}
              className="flex size-5 items-center justify-center rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-wait disabled:opacity-50"
            >
              <img src={closeIcon} alt="" />
            </DialogClose>
          </div>
          <div className="flex flex-col gap-[6px]">
            <DialogTitle className="leading-[19px]">Reset all settings to defaults</DialogTitle>
            <DialogDescription className="text-body-sm-regular leading-[1.5] text-[var(--textParagraph1)]">
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
          className="h-10 justify-self-end bg-[var(--bgDanger)] text-[var(--textInverse)] hover:bg-[var(--bgDangerHover)] active:bg-[var(--bgDangerActive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-wait disabled:opacity-50"
        >
          {pending ? "Resetting…" : "Confirm"}
        </Button>
      </DialogContent>
    </DialogPortal>
  );
}
