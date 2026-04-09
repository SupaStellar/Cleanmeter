import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Radio } from "../Radio";

const meta: Meta<typeof Radio> = {
  title: "Components/Radio",
  component: Radio,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    checked: { table: { disable: true } },
    onCheckedChange: { table: { disable: true } },
    label: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof Radio>;

function RadioGroup() {
  const [selected, setSelected] = useState("option1");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Radio
        label="Option 1"
        checked={selected === "option1"}
        onCheckedChange={() => setSelected("option1")}
      />
      <Radio
        label="Option 2"
        checked={selected === "option2"}
        onCheckedChange={() => setSelected("option2")}
      />
      <Radio
        label="Option 3"
        checked={selected === "option3"}
        onCheckedChange={() => setSelected("option3")}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <RadioGroup />,
};

export const Unchecked: Story = {
  render: () => <Radio checked={false} />,
};

export const Checked: Story = {
  render: () => <Radio checked={true} />,
};

export const WithLabel: Story = {
  render: () => <Radio checked={true} label="Label" />,
};

export const Disabled: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16 }}>
      <Radio checked={false} disabled label="Disabled off" />
      <Radio checked={true} disabled label="Disabled on" />
    </div>
  ),
};
