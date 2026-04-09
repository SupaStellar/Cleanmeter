import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProgressBar } from "../ProgressBar";

const meta: Meta<typeof ProgressBar> = {
  title: "Components/ProgressBar",
  component: ProgressBar,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

function InteractiveProgressBar() {
  const [value, setValue] = useState(50);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 478 }}>
      <ProgressBar value={value} onChange={setValue} />
      <span className="text-body-sm-regular text-[var(--textParagraph2)]">
        Value: {value}%
      </span>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveProgressBar />,
};
