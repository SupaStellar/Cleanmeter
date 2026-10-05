import * as React from "react";
import { cn } from "@/lib/utils";
import { FaqSection } from "./FaqSection";
import { AboutSection } from "./AboutSection";
import { FeedbackDialog } from "../settings/FeedbackDialog";
import { useSettingsStore } from "@/stores/settings-store";
import { useToastStore } from "@/stores/toast-store";

const helpButtonClassName = cn(
  "shrink-0 rounded-[var(--cornerRound)] border border-[var(--borderBolder)]/50 bg-[var(--bgSurfaceRaised)] px-5 py-3",
  "text-body-sm-medium transition-colors",
  "hover:border-[var(--borderBolder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
  "disabled:cursor-wait disabled:opacity-50",
);

function ResetSettingsPrompt() {
  const clearSettings = useSettingsStore((s) => s.clearSettings);
  const [pending, setPending] = React.useState(false);
  const [complete, setComplete] = React.useState(false);

  const reset = async () => {
    if (pending) return;
    setPending(true);
    setComplete(false);
    try {
      await clearSettings();
      setComplete(true);
    } catch (error) {
      console.error("Reset settings failed:", error);
      useToastStore.getState().showToast("Couldn't reset all settings. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="flex w-full items-center justify-between gap-5 rounded-[12px] bg-[var(--bgSurfaceRaised)] p-5">
      <span className="text-body-sm-medium text-[var(--textHeading)]">
        Reset all settings to defaults
      </span>
      <button
        type="button"
        onClick={reset}
        disabled={pending}
        aria-busy={pending}
        className={cn(helpButtonClassName, "flex h-10 items-center text-[var(--borderDanger)]")}
      >
        Reset
      </button>
      <span role="status" className="sr-only">
        {complete ? "All settings reset to defaults." : ""}
      </span>
    </section>
  );
}

function FeedbackPrompt() {
  const [open, setOpen] = React.useState(false);
  return (
    <section className="flex w-full items-center justify-between gap-3 rounded-[12px] bg-[var(--bgSurfaceRaised)] p-5">
      <div className="flex flex-col gap-[6px]">
        <span className="text-body-sm-medium text-[var(--textHeading)]">
          Have an issue or suggestions? We want to hear!
        </span>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          helpButtonClassName,
          "text-[var(--textHeading)]",
        )}
      >
        Give feedback
      </button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </section>
  );
}

export function HelpTab() {
  return (
    <div className="flex h-full w-full flex-col gap-4">
      <FaqSection />
      <AboutSection />
      <FeedbackPrompt />
      <ResetSettingsPrompt />
    </div>
  );
}
