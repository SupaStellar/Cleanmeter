import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "../Checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "Components/Checkbox",
  component: Checkbox,
  parameters: {
    layout: "centered",
    docs: { description: { component: "Uses the live app checkbox: transitions.dev stroke draw, rapid reversal and reduced motion. No sounds are played by the primitive; app action handlers own sound cues." } },
  },
  tags: ["autodocs"],
  argTypes: {
    checked: { table: { disable: true } },
    defaultChecked: { table: { disable: true } },
    onCheckedChange: { table: { disable: true } },
    label: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

function InteractiveCheckbox({ defaultChecked = false, label }: { defaultChecked?: boolean; label?: string }) {
  const [checked, setChecked] = useState(defaultChecked);
  return <Checkbox checked={checked} onCheckedChange={setChecked} label={label} aria-label={label ? undefined : "Example checkbox"} />;
}

export const Unchecked: Story = {
  render: () => <InteractiveCheckbox />,
};

export const Checked: Story = {
  render: () => <InteractiveCheckbox defaultChecked />,
};

export const Mixed: Story = {
  render: () => <Checkbox checked="indeterminate" label="Some metrics selected" />,
};

export const WithLabel: Story = {
  render: () => <InteractiveCheckbox defaultChecked label="Accept terms" />,
};

export const Disabled: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16 }}>
      <Checkbox checked={false} disabled label="Disabled off" />
      <Checkbox checked={true} disabled label="Disabled on" />
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">Off</span>
        <InteractiveCheckbox />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">On</span>
        <InteractiveCheckbox defaultChecked />
      </div>
    </div>
  ),
};
