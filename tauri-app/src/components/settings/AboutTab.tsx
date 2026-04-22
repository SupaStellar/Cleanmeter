import * as React from "react";
import { ChevronDown, Play } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shadcn/collapsible";

/** Set to a real URL to show the "Watch video" CTA; null/empty hides it. */
const WATCH_VIDEO_URL: string | null = null;

/**
 * About tab — matches Figma frame 2075:8887 ("Help" frame, tab renamed to About).
 * Three collapsible white cards:
 *   1. How to setup        — numbered steps + "Watch video" CTA
 *   2. Current limitations — bulleted list
 *   3. Frequently asked questions — Q/A pairs
 */
export function AboutTab() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <HowToSetupCard />
      <CurrentLimitationsCard />
      <FaqCard />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared collapsible card                                           */
/* ------------------------------------------------------------------ */

function CollapsibleCard({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="flex w-full flex-col rounded-[12px] bg-card"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between p-5 text-left"
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
        >
          <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </span>
          <ChevronDown
            className="size-5 text-muted-foreground transition-transform data-[state=open]:rotate-180"
            strokeWidth={2}
            data-state={open ? "open" : "closed"}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden">
        <div className="flex flex-col gap-5 px-5 pb-5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ------------------------------------------------------------------ */
/*  1. How to setup                                                   */
/* ------------------------------------------------------------------ */

function HowToSetupCard() {
  return (
    <CollapsibleCard title="How to setup">
      <ol className="flex flex-col gap-3">
        <Step n={1}>
          <a
            href="https://www.hwinfo.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2"
          >
            Download HWinfo
          </a>{" "}
          and launch it, make sure to turn off other overlay&rsquo;s.
        </Step>
        <Step n={2}>
          Under general setting, make sure to check the &ldquo;Shared Memory
          Support&rdquo; box
        </Step>
        <Step n={3}>That&rsquo;s it! it should run flawlessly now :D</Step>
      </ol>

      {WATCH_VIDEO_URL && (
        <>
          <div className="h-px w-full bg-divider" />
          <div className="flex items-center justify-between gap-5">
            <span className="text-[14px] font-medium text-muted-foreground">
              Still don&rsquo;t understand? Watch a video to see how!
            </span>
            <a
              href={WATCH_VIDEO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[14px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Play className="size-5 fill-current" strokeWidth={0} />
              <span>Watch video</span>
            </a>
          </div>
        </>
      )}
    </CollapsibleCard>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">
        {n}
      </span>
      <span className="pt-[5px] text-[14px] font-medium text-foreground">
        {children}
      </span>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  2. Current limitations                                            */
/* ------------------------------------------------------------------ */

function CurrentLimitationsCard() {
  return (
    <CollapsibleCard title="Current limitations">
      <ul className="flex list-disc flex-col gap-2 pl-5 text-[14px] font-medium text-foreground marker:text-foreground">
        <li>Doesn&rsquo;t work with exclusive fullscreen</li>
      </ul>
    </CollapsibleCard>
  );
}

/* ------------------------------------------------------------------ */
/*  3. FAQ                                                            */
/* ------------------------------------------------------------------ */

function FaqCard() {
  return (
    <CollapsibleCard title="Frequently asked questions">
      <ol className="flex list-decimal flex-col gap-4 pl-5 marker:text-foreground marker:font-medium">
        <FaqItem
          q="Why do I need to download a third party app to run it?"
          a="It’s a workaround for now, we will try to make it a stand alone app in the future."
        />
        <FaqItem
          q="Need more support?"
          a="You can join our discord server were we actively help and answer questions."
        />
        <FaqItem
          q="How do I get better in games?"
          a="Lol, you on your own on that one."
        />
      </ol>
    </CollapsibleCard>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <li className="flex flex-col gap-1.5">
      <span className="text-[14px] font-medium text-foreground">{q}</span>
      <span className="text-[14px] text-muted-foreground">{a}</span>
    </li>
  );
}
