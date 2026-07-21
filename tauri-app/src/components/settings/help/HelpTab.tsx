import * as React from "react";
import { cn } from "@/lib/utils";
import { FaqSection } from "./FaqSection";
import { AboutSection } from "./AboutSection";
import { FeedbackDialog } from "../settings/FeedbackDialog";

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

export function HelpTab() {
  return (
    <div className="flex h-full w-full flex-col gap-4">
      <FaqSection />
      <AboutSection />
      <FeedbackPrompt />
    </div>
  );
}
