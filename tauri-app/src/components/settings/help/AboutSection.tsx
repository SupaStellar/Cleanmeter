import { CollapsibleCard } from "../style/CollapsibleCard";

// Copy transcribed verbatim from Figma node 2664:2793 (curly quotes and all).
// Line breaks are pinned to match the Figma layout exactly — this is a
// fixed-width (563px) panel, so each line is an explicit break; blank lines
// between paragraphs are the double newline.
const ABOUT_PARAGRAPHS: string[][] = [
  [
    "“Most performance monitoring overlays are cluttered, difficult to configure, and",
    "designed without much thought for the experience of using them. Cleanmeter",
    "started as an idea to change that.",
  ],
  [
    "It began as a design concept shared on the PCMR subreddit, simply exploring what",
    "a modern performance monitor could look like. I didn’t expect much from it, but the",
    "response was crazy . Hundreds of people wanted it to become a real product, and it",
    "quickly became clear that this was something the PC community genuinely wanted.",
  ],
  [
    "With help from a member from the community, the first version of Cleanmeter came",
    "to life. But today, it lives under our design studio, where me and my friends build",
    "experience first products.",
  ],
  [
    "We’re building Cleanmeter alongside the PC community, taking in all the feedback,",
    "feature request, and issues to create an overlay gamers, creators, and PC",
    "enthusiasts actually enjoy using. :) ”",
  ],
];
const ABOUT_BODY = ABOUT_PARAGRAPHS.map((lines) => lines.join("\n")).join("\n\n");

export function AboutSection() {
  return (
    <CollapsibleCard title="About">
      <div className="flex flex-col gap-5">
        <p className="whitespace-pre-line text-[14px] font-medium leading-[1.5] text-foreground">
          {ABOUT_BODY}
        </p>
        <div className="flex items-center gap-3">
          <img
            src="/mars-avatar.png"
            alt="Mars"
            width={44}
            height={44}
            className="size-11 shrink-0 rounded-full border border-[var(--borderBold)] object-cover"
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-medium text-foreground">Mars</span>
            <span className="text-[14px] font-normal leading-[1.5] text-muted-foreground">
              Founder &amp; Product Designer, Cleanmeter
            </span>
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
}
