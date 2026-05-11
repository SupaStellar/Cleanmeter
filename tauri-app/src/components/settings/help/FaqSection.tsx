type FaqItem = {
  question: string;
  answer: string;
};

// TODO: replace with API data
const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Need more support?",
    answer:
      "You can join our discord server were we actively help and answer questions.",
  },
  {
    question: "How do I get better in games?",
    answer: "Lol, you on your own on that one.",
  },
  {
    question: "What are the current limitations?",
    answer: "Lol, you on your own on that one.",
  },
];

export function FaqSection() {
  return (
    <section className="flex w-full flex-col gap-5 rounded-[12px] bg-card px-5 pb-6 pt-5">
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
