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
    question: "Do I need HWiNFO?",
    answer:
      "No. Sensors connect automatically through LibreHardwareMonitor, and FPS\ncomes from Cleanmeter’s PresentMon. HWiNFO is optional: run it yourself,\nenable Shared Memory Support, and choose Auto or HWiNFO in Settings.\nThe free HWiNFO64 edition turns shared memory off after 12 hours; Cleanmeter\nfalls back to LibreHardwareMonitor so the overlay keeps working.",
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
  return (
    <CollapsibleCard title="Frequently asked questions">
      <ol className="flex flex-col gap-5">
        {FAQ_ITEMS.map((item, idx) => (
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
