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
    { question: "How do I enable game FPS?", answer: "Install MangoHud 0.7.0 or newer and set Steam launch options to cleanmeter-run %command%. For native games, use cleanmeter-run followed by the game command. AppImage users can use ./Cleanmeter.AppImage --run followed by the game command." },
    { question: "What are the Linux preview limitations?", answer: "FPS and frametime are sampled. Percentile lows and benchmark recording are unavailable. Overlay positioning and global shortcuts need X11/XWayland; native Wayland uses a separate monitor window. Fullscreen visibility depends on your desktop compositor. Flatpak Steam and Gamescope sessions are not validated." },
    { question: "Which hardware readings are available?", answer: "CPU, RAM, and network readings come from Linux. AMD GPU sensors come from the kernel; NVIDIA readings require nvidia-smi. Intel GPU readings depend on available kernel sensors. Missing temperature or power readings show a dash. CPU power is not collected in this preview." },
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
