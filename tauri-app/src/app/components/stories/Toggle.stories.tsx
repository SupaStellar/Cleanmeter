import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Toggle } from "../Toggle";

const meta: Meta<typeof Toggle> = {
  title: "Components/Toggle",
  component: Toggle,
  parameters: {
    layout: "centered",
    docs: { description: { component: "Re-exports the live app Switch. Uses transitions.dev double-bounce keyframes; no startup bounce, rapid reversals retarget and reduced motion disables animation." } },
  },
  tags: ["autodocs"],
  argTypes: {
    checked: { table: { disable: true } },
    defaultChecked: { table: { disable: true } },
    onCheckedChange: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof Toggle>;

function InteractiveToggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return <Toggle checked={checked} onCheckedChange={setChecked} aria-label="Example switch" />;
}

export const Off: Story = {
  render: () => <InteractiveToggle />,
};

export const On: Story = {
  render: () => <InteractiveToggle defaultChecked />,
};

export const Disabled: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16 }}>
      <Toggle checked={false} disabled aria-label="Disabled off" />
      <Toggle checked={true} disabled aria-label="Disabled on" />
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">Off</span>
        <InteractiveToggle />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">On</span>
        <InteractiveToggle defaultChecked />
      </div>
    </div>
  ),
};
