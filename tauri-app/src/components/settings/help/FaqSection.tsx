import type { ReactNode } from "react";

type FaqItem = {
  question: string;
  answer: ReactNode;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Is Cleanmeter resource-heavy?",
    answer:
      "No! Cleanmeter is designed to be lightweight and efficient, ensuring it runs smoothly without impacting your system's performance.",
  },
  {
    question: "Can I customize what stats are displayed?",
    answer:
      "Yes, you can refine the stats. All stats are completely customizable.",
  },
  {
    question: "Can Cleanmeter make me better at games?",
    answer:
      "No, but it'll make sure your PC isn't having a meltdown mid-match. And hey, if your skills are still lacking, at least your overlay will be clean and accurate.",
  },
  {
    question: "How do I contact support?",
    answer: (
      <>
        Join our{" "}
        <a
          href="https://discord.gg/CN2b7d4c9"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline"
        >
          discord server
        </a>{" "}
        and share your feedback.
      </>
    ),
  },
  {
    question: "What are the current limitations?",
    answer: "Does not support exclusive full screen.",
  },
];

export function FaqSection() {
  return (
    <section className="flex w-full flex-col gap-5 rounded-[12px] bg-[var(--bgSurfaceRaised)] px-5 pb-6 pt-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Frequently asked questions
      </h2>
      <ol className="flex flex-col gap-5">
        {FAQ_ITEMS.map((item, idx) => (
          <li key={item.question} className="flex flex-col gap-1.5">
            <p className="text-[14px] font-medium text-foreground">
              {idx + 1}. {item.question}
            </p>
            <p className="pl-5 text-[14px] font-normal text-muted-foreground">
              {item.answer}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
