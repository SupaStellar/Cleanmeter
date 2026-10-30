import { usePlatformStore } from "@/stores/platform-store";
import { CollapsibleCard } from "../style/CollapsibleCard";

type FaqItem = {
  question: string;
  answer: string;
};

// Content transcribed verbatim from Figma node 2662:3300. Answer line breaks
// are pinned to the Figma layout (fixed-width panel) via `\n` + pre-line.
const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What are the current limitations?",
    answer: "Cleanmeter currently doesn’t support fullscreen in games.",
  },
  {
    question: "Is Cleanmeter resource-heavy?",
    answer:
      "No! Cleanmeter is designed to be lightweight and efficient, ensuring it runs\nsmoothly without impacting your system’s performance.",
  },
  {
    question: "How is Cleanmeter built?",
    answer:
      "Interface is built with React and TypeScript. Rust handles the overlay,\nhotkeys, and settings. Hardware readings are done using LibreHardwareMonitor\nfor CPU, GPU, RAM, and network sensors. PresentMon for frames and frametime.",
  },
];

export function FaqSection() {
  const linux = usePlatformStore((s) => s.platform.os === "linux");
  const items = linux ? [
    {
      question: "How do I enable game FPS?",
      answer: "Install MangoHud 0.7.0 or newer. In Steam launch options, enter:\ncleanmeter-run %command%\n\nFor native games, run cleanmeter-run followed by the game command. With an AppImage, use its full path followed by --run and the game command.",
    },
    {
      question: "How do FPS lows and recording work?",
      answer: "Live lows cover the last 10 seconds and need five seconds to warm up. The recording shortcut starts a run, freezes the results, then returns to live readings. Change the shortcut in Settings.",
    },
    {
      question: "Why is a reading unavailable?",
      answer: "Available readings depend on your hardware and driver. A dash means the reading is unavailable.",
    },
    {
      question: "What are the current limitations?",
      answer: "Fullscreen overlay visibility depends on your desktop. Wayland overlay positioning requires layer-shell support; other desktops use a separate monitor window. Global shortcuts require your desktop?s Global Shortcuts portal. Steam Deck Game Mode support is still being validated.",
    },
  ] : FAQ_ITEMS;
  return (
    <CollapsibleCard title="Frequently asked questions">
      <ol className="flex flex-col gap-5">
        {items.map((item, idx) => (
          <li key={item.question} className="flex flex-col gap-1.5">
            <p className="text-[14px] font-medium text-foreground">
              {idx + 1}. {item.question}
            </p>
            <p className="whitespace-pre-line pl-5 text-[14px] font-normal text-muted-foreground">
              {item.answer}
            </p>
          </li>
        ))}
      </ol>
    </CollapsibleCard>
  );
}
