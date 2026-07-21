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
    question: "Why does Windows say that Cleanmeter is not secure?",
    answer:
      "Windows shows that warning for any app that isn't signed with a paid code-\nsigning certificate, it flags the missing signature, not anything in the app itself.",
  },
  {
    question: "Is Cleanmeter resource-heavy?",
    answer:
      "No! Cleanmeter is designed to be lightweight and efficient, ensuring it runs\nsmoothly without impacting your system’s performance.",
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
